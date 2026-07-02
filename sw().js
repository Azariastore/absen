// sw.js - Service Worker untuk Absen Shalat
// FIX: Cache-First + Network Fallback per kategori aset
const CACHE_NAME = 'absen-shalat-v4'; // Naikkan versi setiap ada perubahan besar

// Aset yang WAJIB di-precache saat install
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './daftar.html',
  './laporan-guru.html',
  './firebase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './logo.png',
];

// Aset CDN yang boleh di-cache (bukan Firebase)
const CACHEABLE_CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'lottie.host',
];

// Domain yang TIDAK boleh di-cache (selalu network)
const NETWORK_ONLY_PATTERNS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'worldtimeapi.org',
  'aladhan.com',
];

// ── INSTALL ──
// Pakai allSettled (bukan addAll) agar 1 aset gagal tidak block semua
self.addEventListener('install', event => {
  console.log('[SW] Installing v4...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const results = await Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(e => {
            console.warn('[SW] Gagal cache:', url, e.message);
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) console.warn(`[SW] ${failed} aset gagal di-cache`);
    })
  );
  // Aktif langsung tanpa tunggu tab lama ditutup
  self.skipWaiting();
});

// ── ACTIVATE ──
// Hapus cache versi lama otomatis
self.addEventListener('activate', event => {
  console.log('[SW] Activating v4...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Menghapus cache lama:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  // Skip non-GET (POST ke Firestore, dll.)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const hostname = url.hostname;

  // 1. Firebase & API data → Network Only (jangan pernah cache)
  if (NETWORK_ONLY_PATTERNS.some(p => hostname.includes(p))) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Kalau offline dan request ini adalah navigasi, kasih fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // Untuk API request yang gagal offline, return 503
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. CDN assets (font, chart.js, lottie) → Stale-While-Revalidate
  //    Serve dari cache dulu (cepat), update cache di background
  if (CACHEABLE_CDN_PATTERNS.some(p => hostname.includes(p))) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 3. Aset lokal (HTML, JS, CSS, icons) → Cache First + Network Fallback
  event.respondWith(cacheFirstWithFallback(event.request));
});

// Cache First: ambil dari cache, kalau tidak ada baru ke network, simpan ke cache
async function cacheFirstWithFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const clone = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, clone);
    }
    return networkResponse;
  } catch (e) {
    // Offline fallback untuk halaman navigasi
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}

// Stale-While-Revalidate: serve cached langsung, update di background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Update cache di background (tidak tunggu selesai)
  const networkPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached version langsung, atau tunggu network kalau belum ada cache
  return cached || networkPromise;
}

// ── MESSAGE HANDLER ──
// Untuk force update dari app (setelah update detected)
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Bisa tambahkan: 'CACHE_URLS' untuk cache on-demand
});
