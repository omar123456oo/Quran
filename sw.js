/**
 * Service worker — app shell offline + small API fallbacks.
 *
 * Responsibilities are deliberately narrow:
 *   - precache the application shell (HTML/CSS/JS/icons) under a versioned cache;
 *   - same-origin requests: network first, cached copy when offline;
 *   - icon/web fonts (cdnjs, Google Fonts): cache on first use;
 *   - api.alquran.cloud Surah list / meta: network first, cached fallback.
 * Downloaded audio and Mushaf pages are managed by the page (offline-audio.js,
 * mushaf-store.js) in their own caches; this worker never writes or deletes them.
 */
const VERSION = 'v1';
const SHELL = `quran-shell-${VERSION}`;
const STATIC = `quran-static-${VERSION}`;
const API = `quran-api-${VERSION}`;
const OWN_CACHES = [SHELL, STATIC, API];
const OWN_PREFIXES = ['quran-shell-', 'quran-static-', 'quran-api-'];

const SHELL_FILES = [
    './', 'index.html', 'manifest.json',
    'styles.css', 'adhkar-mushaf-styles.css', 'player-styles.css', 'offline-reader.css',
    'mushaf-meta.js', 'offline-db.js', 'offline-audio.js', 'mushaf-store.js',
    'api-service.js', 'app.js', 'quran-display.js', 'play-queue.js', 'playlists.js',
    'playback-store.js', 'audio-player.js', 'tafseer.js', 'translation.js', 'search.js',
    'bookmarks.js', 'settings.js', 'islamic-resources.js', 'adhkar.js', 'digital-mushaf.js',
    'playlists-ui.js', 'downloads-ui.js',
    'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const API_PATHS = [/^\/v1\/surah\/?$/, /^\/v1\/meta\/?$/];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL);
        // cache: 'reload' so a new version never precaches stale HTTP-cached files
        await cache.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' })));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter(n => OWN_PREFIXES.some(p => n.startsWith(p)) && !OWN_CACHES.includes(n))
            .map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

async function networkFirst(request, cacheName, fallbackUrl) {
    const cache = await caches.open(cacheName);
    try {
        const res = await fetch(request);
        if (res.ok && res.type !== 'opaque') cache.put(request, res.clone());
        return res;
    } catch (e) {
        const hit = await cache.match(request, { ignoreSearch: cacheName === SHELL });
        if (hit) return hit;
        if (fallbackUrl) {
            const shell = await cache.match(fallbackUrl);
            if (shell) return shell;
        }
        throw e;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(STATIC);
    const hit = await cache.match(request);
    if (hit) return hit;
    const res = await fetch(request);
    if (res.ok && (res.type === 'cors' || res.type === 'basic')) cache.put(request, res.clone());
    return res;
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (url.origin === self.location.origin) {
        if (req.headers.has('range')) return;                     // let media ranges pass through
        const navigation = req.mode === 'navigate';
        event.respondWith(networkFirst(req, SHELL, navigation ? 'index.html' : null));
        return;
    }
    if (STATIC_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(req));
        return;
    }
    if (url.hostname === 'api.alquran.cloud' && API_PATHS.some(r => r.test(url.pathname))) {
        event.respondWith(networkFirst(req, API));
    }
    // Everything else (audio, Mushaf data/fonts, search, tafseer) goes straight to the network.
});
