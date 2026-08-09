// Provider AnimeFLV para Zangetsu
var SOURCE_ID = 'animeflv';
var SITE = 'https://animeflv.or.at';
var REFERER = SITE + '/';

function getInfo() {
    return {
        name: 'AnimeFLV',
        lang: 'es',
        baseUrl: SITE,
        logo: SITE + '/wp-content/uploads/2026/06/cropped-animeflv-logo-new.jpg',
        type: 'anime',
        version: '1.0.0'
    };
}

function search(query, page, opts) {
    var q = String(query || '').toLowerCase();
    var url = SITE + '/?s=' + encodeURIComponent(q) + '&post_type=post';
    if (page > 1) url += '&paged=' + page;
    
    return fetch(url, {
        headers: { 'Referer': REFERER, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var items = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var articles = doc.querySelectorAll('article, .post, .ht_grid_1_4, .ht_grid_1_5, .Episode');
        articles.forEach(function(article) {
            var link = article.querySelector('a[href*="/anime/"], a[href*="/202"]');
            var title = article.querySelector('h2, h3, .Title, .entry-title');
            var img = article.querySelector('img');
            
            if (link && title) {
                var href = link.getAttribute('href');
                var fullUrl = href.startsWith('http') ? href : SITE + href;
                var isEpisode = href.includes('/202');
                
                items.push({
                    id: href.split('/').pop(),
                    title: title.textContent.trim(),
                    cover: img ? img.getAttribute('src') || img.getAttribute('data-src') : '',
                    coverHeaders: { Referer: REFERER },
                    url: fullUrl,
                    type: isEpisode ? 'episode' : 'anime',
                    sourceId: SOURCE_ID
                });
            }
        });
        
        return items;
    });
}

function getHome(opts) {
    return fetch(SITE, {
        headers: { 'Referer': REFERER, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var items = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var episodes = doc.querySelectorAll('.List-Episodes .Episode, .List-Episodes .ht_grid_1_4, .Episode');
        episodes.forEach(function(ep) {
            var link = ep.querySelector('a');
            var title = ep.querySelector('.Title, h2, .entry-title');
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
            var links = doc.querySelectorAll('#left-menu .sidebar-cat-item a, .left-navigation a');
            links.forEach(function(link) {
                var href = link.getAttribute('href');
                var title = link.querySelector('.sidebar-cat-name') || link;
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
    return fetch(url, {
        headers: { 'Referer': REFERER, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var title = doc.querySelector('.anime-title, h1, .Title, .entry-title, .Ficha .Title');
        var description = doc.querySelector('.anime-synopsis p, .Description, .sinopsis, .Ficha .Description');
        var cover = doc.querySelector('.poster-image, .anime-poster img, .Image img, .AnimeCover .Image img');
        var coverUrl = cover ? cover.getAttribute('src') : '';
        if (!coverUrl) {
            var metaCover = doc.querySelector('meta[property="og:image"]');
            coverUrl = metaCover ? metaCover.getAttribute('content') : '';
        }
        
        var genres = [];
        var genreElements = doc.querySelectorAll('.genre-tag, .genres a, .genre a, .generos a');
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
    return fetch(seriesUrl, {
        headers: { 'Referer': REFERER, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var episodes = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        var scriptData = doc.querySelector('.animeflv-episodes-data');
        if (scriptData) {
            try {
                var data = JSON.parse(scriptData.textContent);
                data.forEach(function(ep) {
                    episodes.push({
                        id: ep.post_id + '',
                        title: 'Episodio ' + ep.number,
                        number: ep.number,
                        url: ep.permalink,
                        date: ''
                    });
                });
            } catch(e) {}
        }
        
        if (episodes.length === 0) {
            var epLinks = doc.querySelectorAll('.episodes-grid .episode-number a, .ListCaps a, .episode a');
            epLinks.forEach(function(link) {
                var href = link.getAttribute('href');
                var num = link.textContent.trim();
                if (href && num && !isNaN(num)) {
                    episodes.push({
                        id: href.split('/').pop(),
                        title: 'Episodio ' + num,
                        number: parseInt(num) || 0,
                        url: href.startsWith('http') ? href : SITE + href,
                        date: ''
                    });
                }
            });
        }
        
        episodes.sort(function(a, b) { return a.number - b.number; });
        return episodes;
    });
}

function getVideoSources(episodeUrl) {
    return fetch(episodeUrl, {
        headers: { 'Referer': REFERER, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(response) { return response.text(); })
    .then(function(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var sources = [];
        
        var serverButtons = doc.querySelectorAll('.iframe_code[data-src]');
        serverButtons.forEach(function(button) {
            var encoded = button.getAttribute('data-src');
            var label = button.textContent.trim() || 'Servidor';
            if (encoded) {
                try {
                    var decoded = atob(encoded);
                    if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) {
                        sources.push({
                            url: decoded,
                            quality: 'default',
                            type: 'embed',
                            label: label
                        });
                    }
                } catch(e) {}
            }
        });
        
        if (sources.length === 0) {
            var iframe = doc.querySelector('#load, iframe[src]');
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
