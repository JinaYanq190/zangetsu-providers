// Provider Jkanime para Zangetsu
var SOURCE_ID = 'jkanime';
var SITE = 'https://jkanime.net';
var REFERER = SITE + '/';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getInfo() {
    return {
        name: 'Jkanime',
        lang: 'es',
        baseUrl: SITE,
        logo: SITE + '/images/logo.png',
        type: 'anime',
        version: '1.0.0'
    };
}

function _headers() {
    return {
        'Referer': REFERER,
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Connection': 'keep-alive'
    };
}

function search(query, page, opts) {
    var q = String(query || '').toLowerCase();
    var url = SITE + '/buscar/' + encodeURIComponent(q) + '/' + (page || 1);
    
    return fetch(url, { headers: _headers() })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var items = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var articles = doc.querySelectorAll('.anime-item, .list-anime .anime, article');
        articles.forEach(function(article) {
            var link = article.querySelector('a[href*="/anime/"]');
            var title = article.querySelector('h3, .title, .anime-title');
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

function getHome(opts) {
    return fetch(SITE, { headers: _headers() })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var items = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        // Últimos episodios agregados
        var episodes = doc.querySelectorAll('.episode-item, .list-episodes .episode, article');
        episodes.forEach(function(ep) {
            var link = ep.querySelector('a[href*="/ver/"]');
            var title = ep.querySelector('.title, h3, .episode-title');
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
        
        // Si no hay episodios, buscar animes populares
        if (items.length === 0) {
            var animeLinks = doc.querySelectorAll('.anime-popular a, .popular-anime a');
            animeLinks.forEach(function(link) {
                var href = link.getAttribute('href');
                var title = link.querySelector('.title') || link;
                if (href && href.includes('/anime/')) {
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

function getDetail(url) {
    return fetch(url, { headers: _headers() })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var title = doc.querySelector('h1, .anime-title, .title');
        var description = doc.querySelector('.description, .sinopsis, .anime-description');
        var cover = doc.querySelector('.anime-cover img, .poster img, .cover img');
        var coverUrl = cover ? cover.getAttribute('src') : '';
        if (!coverUrl) {
            var metaCover = doc.querySelector('meta[property="og:image"]');
            coverUrl = metaCover ? metaCover.getAttribute('content') : '';
        }
        
        var genres = [];
        var genreElements = doc.querySelectorAll('.genres a, .genre a, .generos a, .tags a');
        genreElements.forEach(function(g) {
            var text = g.textContent.trim();
            if (text) genres.push(text);
        });
        
        var status = 'ongoing';
        var bodyText = doc.body ? doc.body.textContent : '';
        if (bodyText.includes('Finalizado') || bodyText.includes('Completado')) {
            status = 'completed';
        }
        
        return getEpisodes(url).then(function(episodes) {
            return {
                id: url.split('/').pop(),
                title: title ? title.textContent.trim() : 'Sin título',
                url: url,
                cover: coverUrl,
                coverHeaders: { Referer: REFERER },
                description: description ? description.textContent.trim() : '',
                status: status,
                genres: genres,
                type: 'anime',
                sourceId: SOURCE_ID,
                episodes: episodes
            };
        });
    });
}

function getEpisodes(seriesUrl) {
    return fetch(seriesUrl, { headers: _headers() })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var episodes = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var epLinks = doc.querySelectorAll('.episode-list a, .episodes a, .lista-episodios a');
        epLinks.forEach(function(link) {
            var href = link.getAttribute('href');
            var num = link.textContent.trim().match(/\d+/);
            if (href && href.includes('/ver/')) {
                episodes.push({
                    id: href.split('/').pop(),
                    title: 'Episodio ' + (num ? num[0] : '?'),
                    number: num ? parseInt(num[0]) : 0,
                    url: href.startsWith('http') ? href : SITE + href,
                    date: ''
                });
            }
        });
        
        episodes.sort(function(a, b) { return a.number - b.number; });
        return episodes;
    });
}

function getVideoSources(episodeUrl) {
    return fetch(episodeUrl, { headers: _headers() })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var sources = [];
        
        // Buscar iframe del reproductor
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
        
        // Buscar enlaces de video
        var videoLinks = doc.querySelectorAll('source, video source, a[href*=".mp4"], a[href*=".m3u8"]');
        videoLinks.forEach(function(link) {
            var src = link.getAttribute('src') || link.getAttribute('href');
            if (src) {
                sources.push({
                    url: src,
                    quality: 'default',
                    type: src.includes('.m3u8') ? 'hls' : 'mp4',
                    label: 'Video'
                });
            }
        });
        
        return sources;
    });
                }
