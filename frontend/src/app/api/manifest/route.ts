import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let logoUrl = '/uploads/Logo/logo.webp';
  let siteName = 'Ciara Bonita';
  let siteDescription = 'Catálogo de fragancias, maquillaje y accesorios exclusivos.';
  let themeColor = '#1a1a2e';

  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'site_header' } });
    if (setting?.value) {
      const val = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
      if (val.logoUrl) logoUrl = val.logoUrl;
      if (val.siteTitle) siteName = val.siteTitle;
      if (val.siteDescription) siteDescription = val.siteDescription;
    }
  } catch {}

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ciarabonita.com';

  const toAbsolute = (url: string) => {
    if (!url) return `${baseUrl}/uploads/Logo/logo.webp`;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const clean = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${clean}`;
  };

  const absoluteLogo = toAbsolute(logoUrl);

  const manifest = {
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0f1a',
    theme_color: themeColor,
    lang: 'es',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: absoluteLogo,
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'any maskable',
      },
      {
        src: absoluteLogo,
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'any maskable',
      },
    ],
    screenshots: [],
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
