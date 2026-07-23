import React from 'react';
import { Great_Vibes, Playfair_Display } from 'next/font/google';

const greatVibes = Great_Vibes({ weight: '400', subsets: ['latin'] });
const playfair = Playfair_Display({ weight: ['600', '700'], subsets: ['latin'] });

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/beso.webp" alt="Kiss" className="w-12 h-12 md:w-14 md:h-14 object-contain flex-shrink-0" />
      <div className="flex flex-col -space-y-2 lg:-space-y-3 items-center justify-center pt-1">
         <span className={`${greatVibes.className} text-[#d4af37] text-3xl md:text-4xl leading-none`}>Ciara</span>
         <span className={`${playfair.className} text-[#b02a66] text-2xl md:text-3xl font-bold leading-none`}>Bonita</span>
      </div>
    </div>
  )
}
