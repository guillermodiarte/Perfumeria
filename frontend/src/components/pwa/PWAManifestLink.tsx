'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Inyecta el <link rel="manifest"> correcto en el <head> según la ruta.
 * Chrome/Android usa este tag para saber qué manifest aplicar al instalar.
 *
 * - En /admin → /api/admin-manifest (scope: /admin, nombre: "Admin")
 * - En otras rutas → /api/manifest (scope: /, nombre tienda)
 */
export default function PWAManifestLink() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  useEffect(() => {
    const manifestUrl = isAdmin ? '/api/admin-manifest' : '/api/manifest';

    // Eliminar cualquier link de manifest existente
    const existing = document.querySelectorAll('link[rel="manifest"]');
    existing.forEach((el) => el.remove());

    // Crear nuevo link
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);

    // Limpiar al desmontar
    return () => {
      link.remove();
    };
  }, [isAdmin]);

  return null;
}
