// Ta'til Quest — service worker: ilova qobig'ini keshlaydi, internetsiz ham ochiladi.
// Ma'lumotlar (Google Sheets API) bu yerda keshlanmaydi — ular ilova ichida localStorage'da saqlanadi.
const V = 'tq-v2';
const FONTS = 'tq-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    // Sahifa: avval tarmoq (yangi versiya darhol keladi), bo'lmasa kesh
    if (r.mode === 'navigate') {
      e.respondWith(fetch(r).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put('./index.html', cp)); }
        return res;
      }).catch(() => caches.match('./index.html')));
      return;
    }
    // Statik fayllar: kesh, keyin tarmoq
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    })));
    return;
  }

  // Google Fonts: keshdan darhol, fonda yangilash
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(FONTS).then(c => c.match(r).then(m => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; })
        .catch(() => m || Response.error());
      return m || net;
    })));
  }
});
