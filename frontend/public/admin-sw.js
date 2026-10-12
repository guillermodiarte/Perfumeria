// Service Worker para el Panel Admin - Ciara Bonita Admin
const CACHE_NAME = 'ciara-bonita-admin-v1';

// Solo gestionar recursos del scope /admin
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('ciara-bonita-admin-'))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-first para admin (siempre datos frescos)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar GET
  if (request.method !== 'GET') return;

  // No interceptar rutas de API internas de Next.js
  if (url.pathname.startsWith('/_next/') || url.pathname.includes('__nextjs')) {
    return;
  }

  // Para rutas de API: siempre red (no cachear datos admin)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Imágenes: Cache-first para mejor rendimiento en admin
  if (
    url.pathname.startsWith('/uploads/') ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  // Páginas admin: Network-first con fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/admin'))
      )
  );
});

// Escuchar mensajes (por si se quiere forzar update desde el cliente)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
