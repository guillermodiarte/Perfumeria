import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // Usar el faviconUrl (igual que el ícono de la pestaña del navegador)
  let iconUrl = '/uploads/Logo/favicon3.webp';
  let siteName = 'Ciara Bonita';
  let themeColor = '#7c3aed';

  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'site_header' } });
    if (setting?.value) {
      const val = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
      // Prioridad: faviconUrl → logoUrl → default
      if (val.faviconUrl) iconUrl = val.faviconUrl;
      else if (val.logoUrl) iconUrl = val.logoUrl;
      if (val.siteTitle) siteName = val.siteTitle;
    }
  } catch {}

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ciarabonita.com';

  const toAbsolute = (url: string) => {
    if (!url) return `${baseUrl}/uploads/Logo/favicon3.webp`;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const clean = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${clean}`;
  };

  const absoluteIcon = toAbsolute(iconUrl);

  const manifest = {
    name: siteName,
    short_name: siteName,
    description: `Panel de administración de ${siteName}`,
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0f1a',
    theme_color: themeColor,
    lang: 'es',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: absoluteIcon,
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'any maskable',
      },
      {
        src: absoluteIcon,
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'any maskable',
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
