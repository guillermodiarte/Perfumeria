import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthModal from '@/components/auth/AuthModal'
import Header from '@/components/layout/Header'
import CartDrawer from '@/components/cart/CartDrawer'
import Toast from '@/components/ui/Toast'
import SiteHeadSync from '@/components/layout/SiteHeadSync'
import { prisma } from '@/lib/prisma'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800', '900']
})

export async function generateMetadata(): Promise<Metadata> {
  let headerSettings: any = {};
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'site_header' } });
    if (setting?.value) {
      headerSettings = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
    }
  } catch (e) {
    // fallback
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ciarabonita.com';
  const title = headerSettings.siteTitle || 'Ciara Bonita | Catálogo';
  const description = headerSettings.siteDescription || 'Catálogo de fragancias, maquillaje y accesorios exclusivos.';
  const favicon = headerSettings.faviconUrl || '/uploads/Logo/logo.webp';
  const ogImage = headerSettings.ogImageUrl || headerSettings.logoUrl || '/uploads/Banners/1.webp';
  const ogTitle = headerSettings.ogTitle || title;

  const toAbsolute = (url: string) => {
    if (!url) return `${baseUrl}/uploads/Logo/logo.webp`;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const clean = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${clean}`;
  };

  const absoluteOgImage = toAbsolute(ogImage);
  const absoluteFavicon = toAbsolute(favicon);

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    icons: {
      icon: [{ url: absoluteFavicon }],
      shortcut: [{ url: absoluteFavicon }],
      apple: [{ url: absoluteFavicon }],
    },
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      url: baseUrl,
      siteName: title,
      title: ogTitle,
      description,
      images: [
        {
          url: absoluteOgImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [absoluteOgImage],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let faviconUrl = '/uploads/Logo/logo.webp';
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'site_header' } });
    if (setting?.value) {
      const val = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
      if (val.faviconUrl) faviconUrl = val.faviconUrl;
    }
  } catch {}

  return (
    <html lang="es" className={`${inter.variable}`}>
      <head>
        <link rel="icon" href={faviconUrl} />
        <link rel="apple-touch-icon" href={faviconUrl} />
        {/* Usamos el CDN para material symbols ya que es lo más directo basado en el HTML */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@100..700,0..1,-50..200,24&display=swap" rel="stylesheet" />
      </head>
      {/* 
        bg-background-light dark:bg-background-dark es la configuración base 
        usada tanto en index.html como catalog.html
      */}
      <body className={`bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen flex flex-col`}>
        <SiteHeadSync />
        <Header />
        <CartDrawer />
        <Toast />
        <AuthModal />
        {children}
      </body>
    </html>
  )
}
