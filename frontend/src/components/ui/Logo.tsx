'use client';

import React, { useEffect, useState } from 'react';
import { useSiteSettingsStore } from '@/store/useSiteSettingsStore';

interface LogoProps {
  className?: string;
  height?: number;
  src?: string;
  alt?: string;
}

export default function Logo({
  className = '',
  height,
  src,
  alt = 'Ciara Bonita',
}: LogoProps) {
  const { header, loaded, fetchHeaderSettings } = useSiteSettingsStore();
  const [imgSrc, setImgSrc] = useState<string>(src || header.logoUrl || '/uploads/Logo/logo.webp');

  useEffect(() => {
    if (!loaded) {
      fetchHeaderSettings();
    }
  }, [loaded, fetchHeaderSettings]);

  useEffect(() => {
    setImgSrc(src || header.logoUrl || '/uploads/Logo/logo.webp');
  }, [src, header.logoUrl]);

  const finalHeight = height || header.logoHeight || 48;

  return (
    <div className={`flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={imgSrc}
        alt={alt}
        style={{
          height: `${finalHeight}px`,
          width: 'auto',
          maxHeight: '100px',
        }}
        className="object-contain transition-all duration-200 select-none drop-shadow-sm"
        onError={() => {
          // Fallback en caso de que la URL no cargue
          if (imgSrc !== '/logo.webp') {
            setImgSrc('/logo.webp');
          }
        }}
      />
    </div>
  );
}
