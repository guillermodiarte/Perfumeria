// Service Worker para la tienda (usuarios finales) - Ciara Bonita
const CACHE_NAME = 'ciara-bonita-store-v1';
const STATIC_ASSETS = [
  '/',
  '/catalog',
  '/offline',
];

// Instalar: pre-cachear assets esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignorar errores en pre-cache para no bloquear la instalación
      });
    })
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('ciara-bonita-'))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: estrategia Network-first para páginas, Cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar rutas de API, autenticación o admin
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('__nextjs')
  ) {
    return;
  }

  // Solo manejar GET
  if (request.method !== 'GET') return;

  // Imágenes: Cache-first
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

  // Páginas: Network-first con fallback a caché
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
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
  );
});
