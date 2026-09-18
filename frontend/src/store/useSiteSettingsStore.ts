import { create } from 'zustand';

export interface SiteHeaderSettings {
  logoUrl: string;
  logoHeight: number;
  showSocials?: boolean;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsapp?: string;
  faviconUrl?: string;
  siteTitle?: string;
  siteDescription?: string;
  ogImageUrl?: string;
  ogTitle?: string;
}

interface SiteSettingsState {
  header: SiteHeaderSettings;
  loaded: boolean;
  fetchHeaderSettings: () => Promise<void>;
  setHeaderSettings: (settings: Partial<SiteHeaderSettings>) => void;
}

export const useSiteSettingsStore = create<SiteSettingsState>((set, get) => ({
  header: {
    logoUrl: '/uploads/Logo/logo.webp',
    logoHeight: 48,
    showSocials: true,
    facebookUrl: '#',
    instagramUrl: '#',
    whatsapp: '5493704747426',
    faviconUrl: '/uploads/Logo/logo.webp',
    siteTitle: 'Ciara Bonita | Catálogo de Fragancias',
    siteDescription: 'Catálogo de fragancias exclusivas, maquillaje y accesorios.',
    ogImageUrl: '/uploads/Banners/1.webp',
    ogTitle: 'Ciara Bonita | Fragancias Exclusivas',
  },
  loaded: false,
  fetchHeaderSettings: async () => {
    try {
      const res = await fetch('/api/settings/site_header', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const val = data.value || {};
        set((state) => ({
          header: {
            ...state.header,
            logoUrl: val.logoUrl || state.header.logoUrl,
            logoHeight: Number(val.logoHeight) || state.header.logoHeight,
            showSocials: val.showSocials !== undefined ? val.showSocials : state.header.showSocials,
            facebookUrl: val.facebookUrl ?? state.header.facebookUrl,
            instagramUrl: val.instagramUrl ?? state.header.instagramUrl,
            whatsapp: val.whatsapp ?? state.header.whatsapp,
            faviconUrl: val.faviconUrl ?? state.header.faviconUrl,
            siteTitle: val.siteTitle ?? state.header.siteTitle,
            siteDescription: val.siteDescription ?? state.header.siteDescription,
            ogImageUrl: val.ogImageUrl ?? state.header.ogImageUrl,
            ogTitle: val.ogTitle ?? state.header.ogTitle,
          },
          loaded: true,
        }));
      }
    } catch (e) {
      console.warn('Could not fetch site_header settings:', e);
    }
  },
  setHeaderSettings: (newSettings) =>
    set((state) => ({
      header: {
        ...state.header,
        ...newSettings,
      },
    })),
}));
