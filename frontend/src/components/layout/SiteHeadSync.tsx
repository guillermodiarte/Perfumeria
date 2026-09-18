'use client';

import { useEffect } from 'react';
import { useSiteSettingsStore } from '@/store/useSiteSettingsStore';

export default function SiteHeadSync() {
  const { header, loaded, fetchHeaderSettings } = useSiteSettingsStore();

  useEffect(() => {
    if (!loaded) {
      fetchHeaderSettings();
    }
  }, [loaded, fetchHeaderSettings]);

  useEffect(() => {
    // Dynamic Browser Title update
    if (header.siteTitle) {
      document.title = header.siteTitle;
    }

    // Dynamic Favicon update
    if (header.faviconUrl) {
      const iconUrl = header.faviconUrl.startsWith('http') || header.faviconUrl.startsWith('/')
        ? header.faviconUrl
        : `/${header.faviconUrl}`;

      // Update standard favicon link
      let linkIcon: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!linkIcon) {
        linkIcon = document.createElement('link');
        linkIcon.rel = 'icon';
        document.head.appendChild(linkIcon);
      }
      linkIcon.href = iconUrl;

      // Update apple touch icon
      let linkApple: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (!linkApple) {
        linkApple = document.createElement('link');
        linkApple.rel = 'apple-touch-icon';
        document.head.appendChild(linkApple);
      }
      linkApple.href = iconUrl;
    }
  }, [header.siteTitle, header.faviconUrl]);

  return null;
}
