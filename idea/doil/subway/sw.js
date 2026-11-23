/* SubStamp GO service worker
 * - app shell: network first (so redeploys show up), cache as offline fallback
 * - CDN files (Tesseract engine/language data, fonts): cache first after the first download */
const VER = 'substamp-v2';
const SHELL = ['./', 'index.html', 'ocr.js', 'vendor/three.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    e.respondWith(fetch(req).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch:true }).then(r => r || caches.match('index.html'))));
  } else if (CDN.test(req.url)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque'){ const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
