// sw.js — Absen Shalat PWA Service Worker
// Versi: 5  |  Strategi: Cache-First + Network-First per kategori
'use strict';

// ── VERSI CACHE ──
// Naikkan CACHE_VER setiap deploy yang mengubah aset statis.
// DYNAMIC_VER tidak perlu diubah manual — otomatis per-hari.
const CACHE_VER     = '6';
const CACHE_STATIC  = `absen-static-v${CACHE_VER}`;
const CACHE_CDN     = `absen-cdn-v${CACHE_VER}`;
const CACHE_API     = `absen-api-v1`;   // prayer times, dsb — tidak ikut versi app
const ALL_CACHES    = [CACHE_STATIC, CACHE_CDN, CACHE_API];

// App version (sync dengan APP_VERSION di index.html)
const APP_VERSION = '6';

// ── APP SHELL (wajib ada di cache untuk offline) ──
const SHELL_ASSETS = [
  './',
  './index.html',
  './daftar.html',
  './admin.html',
  './laporan-guru.html',
  './firebase.js',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ── CDN ASSETS (pre-cache saat install untuk first-load cepat) ──
// Ini adalah aset CDN yang PASTI dibutuhkan saat app dibuka.
const CDN_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://fonts.gstatic.com/s/dmsans/v15/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6z9mXgjU0.woff2',
  'https://fonts.gstatic.com/s/dmserifdisplay/v15/-nFnOHM81r4j6k0gjALR8uVciqFq.woff2',
  'https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs',
];

// ── PATTERN ROUTING ──
// Network-Only: data real-time yang TIDAK boleh di-cache
const NETWORK_ONLY = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'worldtimeapi.org',             // server time — akurasi detik penting
];

// Network-First + fallback cache (24 jam): data berubah harian
const NETWORK_FIRST = [
  'aladhan.com',                  // prayer times API
];

// CDN: font, library JS — Stale-While-Revalidate
const CDN_SWR = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
];

// Lottie JSON: Cache-First (file besar, jarang berubah)
const CACHE_FIRST_HOSTS = [
  'lottie.host',
];

// ════════════════════════════════════════════════════════
// ── INSTALL ──
// Pre-cache shell + CDN secara paralel.
// Pakai Promise.allSettled agar 1 aset gagal tidak block semua.
// ════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  console.log('[SW] Install v' + CACHE_VER);
  event.waitUntil((async () => {
    // Cache shell dan CDN paralel — tidak saling tunggu
    const [staticCache, cdnCache] = await Promise.all([
      caches.open(CACHE_STATIC),
      caches.open(CACHE_CDN),
    ]);

    const [shellResults, cdnResults] = await Promise.all([
      Promise.allSettled(SHELL_ASSETS.map(url =>
        staticCache.add(url).catch(e => console.warn('[SW] Shell cache gagal:', url, e.message))
      )),
      Promise.allSettled(CDN_PRECACHE.map(url =>
        fetch(url, { mode: 'cors' })
          .then(res => { if (res.ok) cdnCache.put(url, res); })
          .catch(e => console.warn('[SW] CDN cache gagal:', url, e.message))
      )),
    ]);

    const shellFailed = shellResults.filter(r => r.status === 'rejected').length;
    const cdnFailed   = cdnResults.filter(r => r.status === 'rejected').length;
    console.log(`[SW] Shell: ${SHELL_ASSETS.length - shellFailed}/${SHELL_ASSETS.length} cached`);
    console.log(`[SW] CDN pre-cache: ${CDN_PRECACHE.length - cdnFailed}/${CDN_PRECACHE.length} cached`);
  })());

  // Aktif langsung — tidak tunggu tab lama ditutup
  self.skipWaiting();
});

// ════════════════════════════════════════════════════
// ── ACTIVATE ──
// Hapus semua cache versi lama, claim semua client.
// ════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log('[SW] Activate v' + CACHE_VER);
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => !ALL_CACHES.includes(k))
        .map(k => { console.log('[SW] Hapus cache lama:', k); return caches.delete(k); })
    );
    await self.clients.claim();
    // Beritahu semua client bahwa SW baru sudah aktif
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: APP_VERSION, cacheVer: CACHE_VER }));
  })());
});

// ════════════════════════════════════════════════════
// ── FETCH ──
// Routing per host/path ke strategi yang tepat.
// ════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url      = new URL(event.request.url);
  const hostname = url.hostname;

  // 1. Network-Only (Firebase + WorldTime — jangan pernah cache)
  if (NETWORK_ONLY.some(p => hostname.includes(p))) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return _offlineFallback();
        return new Response(JSON.stringify({ error: 'offline', cached: false }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Network-First + cache 24 jam (Aladhan prayer times)
  if (NETWORK_FIRST.some(p => hostname.includes(p))) {
    event.respondWith(_networkFirstWithCache(event.request, CACHE_API, 86_400_000));
    return;
  }

  // 3. Lottie JSON — Cache-First (aset besar, statis)
  if (CACHE_FIRST_HOSTS.some(p => hostname.includes(p))) {
    event.respondWith(_cacheFirst(event.request, CACHE_CDN));
    return;
  }

  // 4. CDN Font / Library JS — Stale-While-Revalidate
  if (CDN_SWR.some(p => hostname.includes(p))) {
    event.respondWith(_staleWhileRevalidate(event.request, CACHE_CDN));
    return;
  }

  // 5. App Shell lokal (HTML, JS, CSS, icons) — Cache-First
  event.respondWith(_cacheFirst(event.request, CACHE_STATIC));
});

// ════════════════════════════════════════════════════
// ── STRATEGI FETCH ──
// ════════════════════════════════════════════════════

// Cache-First: cache → network → simpan → return
async function _cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch (e) {
    if (request.mode === 'navigate') return _offlineFallback();
    throw e;
  }
}

// Stale-While-Revalidate: serve cache langsung, update di background
async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then(res => { if (res && res.status === 200) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || networkFetch;
}

// Network-First + cache fallback dengan TTL (maxAge ms)
async function _networkFirstWithCache(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.status === 200) {
      // Simpan dengan timestamp untuk TTL check
      const headers = new Headers(res.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const blob = await res.blob();
      cache.put(request, new Response(blob, { status: 200, headers }));
      return new Response(blob, { status: 200, headers: res.headers });
    }
    return res;
  } catch (e) {
    // Fallback ke cache — cek TTL
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0');
      if (Date.now() - cachedAt < maxAgeMs) return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Offline fallback: index.html dari cache
async function _offlineFallback() {
  const cache    = await caches.open(CACHE_STATIC);
  const fallback = await cache.match('./index.html');
  return fallback || new Response('<h1>Offline</h1><p>Buka aplikasi saat ada koneksi.</p>', {
    status: 200, headers: { 'Content-Type': 'text/html' }
  });
}

// ════════════════════════════════════════════════════
// ── MESSAGE HANDLER ──
// Terima pesan dari app untuk cache on-demand dan skip waiting.
// ════════════════════════════════════════════════════
self.addEventListener('message', event => {
  const { type, urls, cacheName } = event.data || {};

  // Force update SW
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Cache URL tertentu on-demand (dari daftar.html setelah daftar)
  // Contoh: SW kirim daftar URL siswa yang baru dibuat
  if (type === 'CACHE_URLS' && Array.isArray(urls)) {
    const target = cacheName || CACHE_STATIC;
    event.waitUntil(
      caches.open(target).then(cache =>
        Promise.allSettled(
          urls.map(url =>
            fetch(url).then(res => { if (res.ok) cache.put(url, res); })
              .catch(e => console.warn('[SW] CACHE_URLS gagal:', url, e.message))
          )
        )
      )
    );
    return;
  }

  // Warm-up cache prayer times untuk hari ini (dipanggil setelah login)
  if (type === 'WARM_PRAYER_CACHE' && event.data.url) {
    event.waitUntil(
      caches.open(CACHE_API).then(cache =>
        fetch(event.data.url)
          .then(res => { if (res.ok) cache.put(event.data.url, res.clone()); })
          .catch(() => {})
      )
    );
    return;
  }

  // Prefetch kelas list (dipanggil dari daftar.html saat siswa baru daftar)
  if (type === 'PREFETCH_KELAS') {
    // Tidak bisa cache Firestore langsung, tapi bisa warm-up firebase.js
    event.waitUntil(
      caches.open(CACHE_STATIC).then(cache =>
        cache.match('./firebase.js').then(hit => {
          if (!hit) return fetch('./firebase.js').then(res => { if(res.ok) cache.put('./firebase.js', res); });
        })
      )
    );
    return;
  }
});
