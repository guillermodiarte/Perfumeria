import React from 'react';

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-primary via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-primary/20 flex-shrink-0">
        <span className="material-symbols-outlined text-2xl md:text-3xl select-none">sports_score</span>
      </div>
      <div className="flex flex-col justify-center leading-none">
        <span className="font-black text-slate-900 dark:text-white text-base md:text-lg tracking-tight uppercase">
          Tienda Deportiva
        </span>
        <span className="text-primary text-[10px] md:text-xs font-bold tracking-widest uppercase mt-0.5">
          y Accesorios
        </span>
      </div>
    </div>
  );
}
