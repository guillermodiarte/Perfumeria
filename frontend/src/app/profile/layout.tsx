'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useState } from 'react';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!user) {
    router.push('/');
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-6 sm:pt-12 pb-16 px-3 sm:px-6 lg:px-12">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-4 sm:gap-6 lg:gap-8">
        
        {/* MOBILE COMPACT HEADER & TABS */}
        <div className="md:hidden flex flex-col gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-11 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold uppercase shrink-0 border border-primary/20">
                {user.name?.charAt(0) || <span className="material-symbols-outlined">person</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-black text-slate-900 dark:text-white text-sm truncate">{user.name}</h2>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors shrink-0"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>

          {/* Navigation Tabs on Mobile */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-1.5 shadow-sm border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-1.5">
            <Link 
              href="/profile" 
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                pathname === '/profile' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              Mis Datos
            </Link>
            <Link 
              href="/profile/orders" 
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                pathname.includes('/orders') 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              Mis Compras
            </Link>
          </div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <div className="hidden md:block w-64 lg:w-72 xl:w-80 shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sticky top-24">
            <div className="mb-6 text-center md:text-left">
              <div className="size-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 mx-auto md:mx-0">
                <span className="material-symbols-outlined text-3xl">person</span>
              </div>
              <h2 className="font-black text-slate-900 dark:text-white text-lg">{user.name}</h2>
              <p className="text-sm text-slate-500 truncate">{user.email}</p>
              
              {!user.is_approved && (
                <div className="mt-3 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 justify-center md:justify-start">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  Cuenta pendiente de aprobación
                </div>
              )}
            </div>

            <nav className="space-y-2">
              <Link 
                href="/profile" 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${pathname === '/profile' ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
              >
                <span className="material-symbols-outlined">manage_accounts</span>
                Mis Datos
              </Link>
              <Link 
                href="/profile/orders" 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${pathname.includes('/orders') ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                Mis Compras
              </Link>
            </nav>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-red-500 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                <span className="material-symbols-outlined">logout</span>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

      </div>
    </div>
  );
}
