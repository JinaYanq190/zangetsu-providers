// TioAnime provider — https://tioanime.com
var SOURCE_ID = 'tioanime';
var SITE = 'https://tioanime.com';
var REFERER = SITE + '/';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getInfo() {
    return {
        name: 'TioAnime',
        lang: 'es',
        baseUrl: SITE,
        logo: SITE + '/assets/img/icon-32x32.png',
        type: 'anime',
        version: '1.0.3'
    };
}

// Headers más realistas para evitar bloqueos
function _headers() {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': REFERER,
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1'
    };
}

function _get(url) {
    return fetch(url, { headers: _headers() })
        .then(function(r) { return r.text(); })
        .catch(function() { return ''; });
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
function search(query, page, opts) {
    var q = String(query || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    var url = SITE + '/directorio?q=' + encodeURIComponent(q) + '&p=' + (page || 1);
    
    return _get(url).then(function(html) {
        var items = [];
        if (!html) return items;
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var articles = doc.querySelectorAll('.animes .anime, .list-unstyled .anime');
        articles.forEach(function(article) {
            var link = article.querySelector('a[href*="/anime/"]');
            var title = article.querySelector('.title, h3');
            var img = article.querySelector('img');
            
            if (link && title) {
                var href = link.getAttribute('href');
                var fullUrl = href.startsWith('http') ? href : SITE + href;
                
                items.push({
                    id: href.split('/').pop(),
                    title: title.textContent.trim(),
                    cover: img ? img.getAttribute('src') || img.getAttribute('data-src') : '',
                    coverHeaders: { Referer: REFERER },
                    url: fullUrl,
                    type: 'anime',
                    sourceId: SOURCE_ID
                });
            }
        });
        
        return items;
    });
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function getHome(opts) {
    return _get(SITE + '/').then(function(html) {
        var items = [];
        if (!html) return [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        // Últimos episodios
        var episodes = doc.querySelectorAll('.episodes .episode, .list-unstyled .episode');
        episodes.forEach(function(ep) {
            var link = ep.querySelector('a[href*="/ver/"]');
            var title = ep.querySelector('.title, h3');
            var img = ep.querySelector('img');
            
            if (link) {
                var href = link.getAttribute('href');
                var fullUrl = href.startsWith('http') ? href : SITE + href;
                var titleText = title ? title.textContent.trim() : 'Episodio';
                
                items.push({
                    id: href.split('/').pop(),
                    title: titleText,
                    cover: img ? img.getAttribute('src') || img.getAttribute('data-src') : '',
                    coverHeaders: { Referer: REFERER },
                    url: fullUrl,
                    type: 'episode',
                    sourceId: SOURCE_ID
                });
            }
        });
        
        // Si no hay episodios, buscar animes
        if (items.length === 0) {
            var animeLinks = doc.querySelectorAll('.anime a[href*="/anime/"]');
            animeLinks.forEach(function(link) {
                var href = link.getAttribute('href');
                var title = link.querySelector('.title, h3') || link;
                if (href) {
                    items.push({
                        id: href.split('/').pop(),
                        title: title.textContent.trim(),
                        cover: '',
                        coverHeaders: { Referer: REFERER },
                        url: SITE + href,
                        type: 'anime',
                        sourceId: SOURCE_ID
                    });
                }
            });
        }
        
        return [
            { title: 'Últimos Episodios', items: items.slice(0, 12) },
            { title: 'Animes Destacados', items: items.slice(12, 24) }
        ];
    });
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function getDetail(url) {
    var slug = String(url).split('/').pop();
    return _get(url).then(function(html) {
        if (!html) return { id: slug, title: 'Sin título', url: url, episodes: [] };
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var title = doc.querySelector('h1.title, .anime-single h1.title');
        var description = doc.querySelector('.sinopsis, .anime-single .sinopsis');
        var cover = doc.querySelector('.thumb img, .anime-single .thumb img');
        var coverUrl = cover ? cover.getAttribute('src') : '';
        if (!coverUrl) {
            var metaCover = doc.querySelector('meta[property="og:image"]');
            coverUrl = metaCover ? metaCover.getAttribute('content') : '';
        }
        
        var genres = [];
        var genreElements = doc.querySelectorAll('.genres .btn-light, .genres a, .generos a');
        genreElements.forEach(function(g) {
            var text = g.textContent.trim();
            if (text) genres.push(text);
        });
        
        return getEpisodes(url).then(function(episodes) {
            return {
                id: slug,
                title: title ? title.textContent.trim() : 'Sin título',
                url: url,
                cover: coverUrl,
                coverHeaders: { Referer: REFERER },
                description: description ? description.textContent.trim() : '',
                status: 'ongoing',
                genres: genres,
                type: 'Anime',
                sourceId: SOURCE_ID,
                episodes: episodes
            };
        });
    });
}

// ── EPISODES ──────────────────────────────────────────────────────────────────
function getEpisodes(seriesUrl) {
    return _get(seriesUrl).then(function(html) {
        var episodes = [];
        if (!html) return episodes;
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var epLinks = doc.querySelectorAll('.episodes-list a, .episodes a, a[href*="/ver/"]');
        epLinks.forEach(function(link) {
            var href = link.getAttribute('href');
            var text = link.textContent.trim();
            var numMatch = text.match(/\d+/);
            if (href && href.includes('/ver/')) {
                var num = numMatch ? parseInt(numMatch[0]) : 0;
                episodes.push({
                    id: href.split('/').pop(),
                    title: 'Episodio ' + (num || '?'),
                    number: num,
                    url: href.startsWith('http') ? href : SITE + href,
                    date: ''
                });
            }
        });
        
        episodes.sort(function(a, b) { return a.number - b.number; });
        return episodes;
    });
}

// ── VIDEO SOURCES ─────────────────────────────────────────────────────────────
function getVideoSources(episodeUrl) {
    return _get(episodeUrl).then(function(html) {
        var sources = [];
        if (!html) return sources;
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        // Buscar la variable videos en scripts
        var scripts = doc.querySelectorAll('script');
        scripts.forEach(function(script) {
            var content = script.textContent;
            if (content && content.indexOf('var videos =') !== -1) {
                try {
                    var match = content.match(/var videos = (\[[\s\S]*?\]);/);
                    if (match) {
                        var videoData = match[1].match(/\["([^"]+)","([^"]+)",\d+,\d+\]/g);
                        if (videoData) {
                            videoData.forEach(function(item) {
                                var parts = item.match(/\["([^"]+)","([^"]+)",\d+,\d+\]/);
                                if (parts) {
                                    var serverName = parts[1];
                                    var videoUrl = parts[2];
                                    if (videoUrl && videoUrl.startsWith('http')) {
                                        sources.push({
                                            url: videoUrl,
                                            quality: 'default',
                                            type: 'embed',
                                            label: serverName
                                        });
                                    }
                                }
                            });
                        }
                    }
                } catch(e) {}
            }
        });
        
        // Buscar iframe
        if (sources.length === 0) {
            var iframe = doc.querySelector('iframe[src*="player"], iframe[src*="embed"], iframe[src*="mega"], iframe[src*="voe"]');
            if (iframe) {
                var src = iframe.getAttribute('src');
                if (src) {
                    sources.push({
                        url: src,
                        quality: 'default',
                        type: 'embed',
                        label: 'Servidor'
                    });
                }
            }
        }
        
        return sources;
    });
                          }
