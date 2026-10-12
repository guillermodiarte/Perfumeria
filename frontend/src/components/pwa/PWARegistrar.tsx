'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Registra el service worker adecuado según la ruta actual:
 * - En /admin → admin-sw.js (scope /admin)
 * - En cualquier otra ruta → sw.js (scope /)
 *
 * Esto permite tener dos PWAs separadas e instalables desde Chrome.
 */
export default function PWARegistrar() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const swPath = isAdmin ? '/admin-sw.js' : '/sw.js';
    const scope = isAdmin ? '/admin/' : '/';

    navigator.serviceWorker
      .register(swPath, { scope })
      .then((registration) => {
        console.log(`[PWA] Service worker registrado: ${swPath} (scope: ${scope})`);

        // Escuchar actualizaciones
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nueva versión disponible, actualizando...');
                newWorker.postMessage('skipWaiting');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('[PWA] Error al registrar service worker:', err);
      });
  }, [isAdmin]);

  return null;
}
