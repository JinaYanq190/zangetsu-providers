// TioAnime provider — https://tioanime.com
var SOURCE_ID = 'tioanime';
var SITE = 'https://tioanime.com';
var REFERER = SITE + '/';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getInfo() {
    return {
        name: 'TioAnime',
        lang: 'es',
        baseUrl: SITE,
        logo: SITE + '/assets/img/icon-32x32.png',
        type: 'anime',
        version: '1.0.1'
    };
}

function _headers() {
    return {
        'Referer': REFERER,
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8',
        'Connection': 'keep-alive'
    };
}

function _get(url) {
    return fetch(url, { headers: _headers() })
        .then(function(r) { return r.text(); })
        .catch(function() { return ''; });
}

// ── SEARCH: usa el directorio con query ──────────────────────────────────────
function search(query, page, opts) {
    var q = String(query || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    var url = SITE + '/directorio?q=' + encodeURIComponent(q) + '&p=' + (page || 1);
    
    return _get(url).then(function(html) {
        var items = [];
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

// ── HOME: página principal ────────────────────────────────────────────────────
function getHome(opts) {
    return _get(SITE + '/').then(function(html) {
        var items = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
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

// ── DETAIL: página del anime ──────────────────────────────────────────────────
function getDetail(url) {
    var slug = String(url).split('/').pop();
    return _get(url).then(function(html) {
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
        
        var yearElem = doc.querySelector('.year');
        var year = yearElem ? yearElem.textContent.trim() : '';
        
        var typeElem = doc.querySelector('.anime-type-peli');
        var type = typeElem ? typeElem.textContent.trim() : 'Anime';
        
        var statusElem = doc.querySelector('.status');
        var status = 'ongoing';
        if (statusElem) {
            var statusText = statusElem.textContent.trim().toLowerCase();
            if (statusText.includes('finalizado') || statusText.includes('completed')) {
                status = 'completed';
            } else if (statusText.includes('próximamente') || statusText.includes('upcoming')) {
                status = 'upcoming';
            }
        }
        
        return getEpisodes(url).then(function(episodes) {
            var result = {
                id: slug,
                title: title ? title.textContent.trim() : 'Sin título',
                url: url,
                cover: coverUrl,
                coverHeaders: { Referer: REFERER },
                description: description ? description.textContent.trim() : '',
                status: status,
                genres: genres,
                type: type,
                sourceId: SOURCE_ID,
                year: year,
                episodes: episodes
            };
            
            if (episodes.length > 0) {
                result.subCount = episodes.length;
                result.dubCount = 0;
            }
            
            return result;
        });
    });
}

// ── EPISODES: lista de episodios del anime ────────────────────────────────────
function getEpisodes(seriesUrl) {
    return _get(seriesUrl).then(function(html) {
        var episodes = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var epLinks = doc.querySelectorAll('.episodes-list a, .episodes a, a[href*="/ver/"]');
        epLinks.forEach(function(link) {
            var href = link.getAttribute('href');
            var text = link.textContent.trim();
            var numMatch = text.match(/\d+/);
            if (href && href.includes('/ver/')) {
                var num = numMatch ? parseInt(numMatch[0]) : 0;
                var exists = episodes.some(function(e) { return e.number === num; });
                if (!exists) {
                    episodes.push({
                        id: href.split('/').pop(),
                        title: 'Episodio ' + (num || '?'),
                        number: num,
                        url: href.startsWith('http') ? href : SITE + href,
                        date: ''
                    });
                }
            }
        });
        
        episodes.sort(function(a, b) { return a.number - b.number; });
        return episodes;
    });
}

// ── VIDEO SOURCES: obtiene los servidores de video ──────────────────────────
function getVideoSources(episodeUrl) {
    return _get(episodeUrl).then(function(html) {
        var sources = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        // Buscar el script con la variable videos
        var scripts = doc.querySelectorAll('script');
        var videoData = null;
        scripts.forEach(function(script) {
            var content = script.textContent;
            if (content && content.indexOf('var videos = [') !== -1) {
                var match = content.match(/var videos = (\[[\s\S]*?\]);/);
                if (match) {
                    try {
                        videoData = JSON.parse(match[1]);
                    } catch(e) {
                        // Si falla el JSON.parse, intentar con un método más simple
                        videoData = match[1].match(/\["([^"]+)","([^"]+)",\d+,\d+\]/g);
                        if (videoData) {
                            var parsed = [];
                            videoData.forEach(function(item) {
                                var parts = item.match(/\["([^"]+)","([^"]+)",\d+,\d+\]/);
                                if (parts) {
                                    parsed.push([parts[1], parts[2], 0, 0]);
                                }
                            });
                            videoData = parsed;
                        }
                    }
                }
            }
        });
        
        // Si encontramos datos de video, procesarlos
        if (videoData && Array.isArray(videoData)) {
            videoData.forEach(function(video) {
                if (video && video.length >= 2) {
                    var serverName = video[0] || 'Servidor';
                    var videoUrl = video[1] || '';
                    if (videoUrl) {
                        // Si es un enlace de Mega, usar extractVideo
                        if (videoUrl.includes('mega.nz')) {
                            // Usar extractVideo para Mega
                            sources.push({
                                url: videoUrl,
                                quality: 'default',
                                type: 'embed',
                                label: serverName
                            });
                        } else {
                            sources.push({
                                url: videoUrl,
                                quality: 'default',
                                type: 'embed',
                                label: serverName
                            });
                        }
                    }
                }
            });
        }
        
        // Si no hay datos del script, buscar iframe
        if (sources.length === 0) {
            var iframe = doc.querySelector('iframe[src*="player"], iframe[src*="embed"], iframe[src*="mega"]');
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
        
        // Si no hay fuentes, buscar enlaces de descarga
        if (sources.length === 0) {
            var downloadLinks = doc.querySelectorAll('.table-downloads a[href]');
            downloadLinks.forEach(function(link) {
                var href = link.getAttribute('href');
                if (href && (href.includes('mega.nz') || href.includes('drive.google') || href.includes('mediafire'))) {
                    sources.push({
                        url: href,
                        quality: 'default',
                        type: 'embed',
                        label: 'Descarga'
                    });
                }
            });
        }
        
        return sources;
    });
        }
