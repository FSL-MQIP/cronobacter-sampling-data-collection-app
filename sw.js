const CACHE = 'crono-v4';
const SHELL = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/sample-id.js', './js/session.js', './js/storage.js',
  './js/geo.js', './js/weather.js', './js/voice.js',
  './js/photos-db.js', './js/photos-ui.js', './js/backup.js', './js/export.js',
  './manifest.json',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
