/* 자림 허브 PWA 서비스 워커 — 껍데기 네트워크 우선, CDN·Supabase 통과 */
const CACHE = 'jalim-hub-v9';
const SHELL = ['./', 'index.html', 'hub-auth.js', 'hub-today.js', 'jalim-base.css', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, net.clone());
      return net;
    } catch (err) {
      const cached = await caches.match(req);
      return cached || caches.match('index.html');
    }
  })());
});
