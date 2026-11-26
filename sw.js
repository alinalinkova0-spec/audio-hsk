const CACHE = 'hsk-audio-live-v127';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/data.js',
  './js/srs.js',
  './js/audio.js',
  './js/feedback.js',
  './js/screens/card.js',
  './js/screens/segment.js',
  './js/screens/settings.js',
  './js/screens/onboarding.js',
  './js/screens/stats.js',
  './js/screens/live.js',
  './js/screens/tests.js',
  './manifest.json',
  './js/geese/goose.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          fetch(url, { cache: 'no-store' })
            .then(res => (res && res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'hsk_state_cache_v1').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const cleanReq = new Request(url.origin + url.pathname);
  const isMedia = /\.(jpg|jpeg|png|gif|webp|mp3|wav|svg|ico)$/i.test(url.pathname);

  if (isMedia) {
    event.respondWith(
      caches.match(cleanReq, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(cleanReq).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(cleanReq, copy));
          }
          return res;
        }).catch(() => Response.error());
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(res => {
        if (res && res.ok) {
          const copy1 = res.clone();
          const copy2 = res.clone();
          caches.open(CACHE).then(cache => {
            cache.put(event.request, copy1);
            cache.put(cleanReq, copy2);
          }).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true })
          .then(cached => cached || caches.match(cleanReq, { ignoreSearch: true }))
          .then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
  );
});
