'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useCartStore } from '@/store/useCartStore';
import { useCartUIStore } from '@/store/useCartUIStore';
import { User, ShoppingBag, Search, LogOut, Package, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Header() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const openAuthModal = useAuthModalStore(s => s.openModal);
  const { items } = useCartStore();
  const openCart = useCartUIStore(s => s.openCart);
  
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!mounted) return null;

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg shadow-sm h-[70px]' : 'bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-[80px]'}`}>
      <div className="px-6 lg:px-12 h-full flex items-center justify-between">
        
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 text-primary group">
            <span className="material-symbols-outlined text-3xl font-bold transition-transform group-hover:scale-110">spa</span>
            <h2 className="text-slate-900 dark:text-slate-100 text-xl md:text-2xl font-black leading-tight tracking-tighter italic">
              Essence
            </h2>
          </Link>
        </div>

        {/* Center: Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center justify-center gap-8 xl:gap-12 flex-1 px-8">
          <Link href="/catalog" className="text-slate-900 dark:text-slate-100 hover:text-primary transition-colors text-sm font-bold relative group uppercase tracking-widest">
            Colecciones
            <span className="absolute -bottom-2 left-1/2 w-0 h-0.5 bg-primary transition-all group-hover:w-1/2 group-hover:-translate-x-1/2"></span>
          </Link>
          <Link href="/catalog?category=Perfumes de Mujer" className="text-slate-900 dark:text-slate-100 hover:text-primary transition-colors text-sm font-bold relative group uppercase tracking-widest">
            Mujer
            <span className="absolute -bottom-2 left-1/2 w-0 h-0.5 bg-primary transition-all group-hover:w-1/2 group-hover:-translate-x-1/2"></span>
          </Link>
          <Link href="/catalog?category=Perfumes de Hombre" className="text-slate-900 dark:text-slate-100 hover:text-primary transition-colors text-sm font-bold relative group uppercase tracking-widest">
            Hombre
            <span className="absolute -bottom-2 left-1/2 w-0 h-0.5 bg-primary transition-all group-hover:w-1/2 group-hover:-translate-x-1/2"></span>
          </Link>
          <Link href="/donde-estamos" className="text-slate-900 dark:text-slate-100 hover:text-primary transition-colors text-sm font-bold relative group uppercase tracking-widest">
            ¿Dónde estamos?
            <span className="absolute -bottom-2 left-1/2 w-0 h-0.5 bg-primary transition-all group-hover:w-1/2 group-hover:-translate-x-1/2"></span>
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
          
          {/* Search Bar */}
          <div className="hidden xl:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 w-48 focus-within:w-64 transition-all duration-300">
            <Search className="w-4 h-4 text-slate-500 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="https://wa.me/5493704048860" target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </a>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

          {/* User Account */}
          <div className="relative">
            {user ? (
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 p-2 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors font-bold text-sm"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">Mi Cuenta</span>
              </button>
            ) : (
              <button 
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-2 p-2 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors font-bold text-sm"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">Ingresar</span>
              </button>
            )}

            {/* Dropdown */}
            {isDropdownOpen && user && (
              <div className="absolute top-full mt-4 right-0 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <Link onClick={() => setIsDropdownOpen(false)} href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors">
                  <User className="w-4 h-4" /> Perfil
                </Link>
                <Link onClick={() => setIsDropdownOpen(false)} href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors">
                  <Package className="w-4 h-4" /> Mis Pedidos
                </Link>
                {user.role === 'admin' && (
                  <Link onClick={() => setIsDropdownOpen(false)} href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors">
                    <ShieldCheck className="w-4 h-4" /> Panel Admin
                  </Link>
                )}
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                <button onClick={() => { logout(); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>

          {/* Cart Toggle */}
          <button 
            onClick={openCart}
            className="relative p-2 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 -translate-y-1 translate-x-1 flex items-center justify-center w-4 h-4 bg-primary text-white text-[9px] font-black rounded-full shadow-sm animate-in zoom-in">
                {totalItems}
              </span>
            )}
          </button>
          
          {/* Mobile Menu Toggle */}
          <button className="lg:hidden p-2 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">
             <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}
