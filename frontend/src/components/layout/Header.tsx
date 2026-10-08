'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useCartStore } from '@/store/useCartStore';
import { useCartUIStore } from '@/store/useCartUIStore';
import Logo from '@/components/ui/Logo';
import { User, ShoppingBag, Search, LogOut, Package, ShieldCheck, Menu, X, ChevronRight, Phone, MessageCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const openAuthModal = useAuthModalStore(s => s.openModal);
  const { items } = useCartStore();
  const openCart = useCartUIStore(s => s.openCart);
  const company = useCompanyInfo();

  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  if (!mounted) return null;
  if (pathname?.startsWith('/admin')) return null;

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
    }
  };

  const rawWhatsapp = (company.whatsapp || '5493704747426').replace(/[^0-9]/g, '');

  return (
    <>
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg shadow-sm h-[70px]' : 'bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-[76px] sm:h-[80px]'}`}>
        <div className="px-4 sm:px-6 lg:px-12 h-full flex items-center justify-between">

          {/* Left: Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center group">
              <Logo className="transition-transform group-hover:scale-105" />
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
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">

            {/* Desktop Search Bar */}
            <form onSubmit={handleSearchSubmit} className="hidden xl:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 w-48 focus-within:w-64 transition-all duration-300">
              <Search className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar perfume..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
              />
            </form>

            {/* Desktop Socials */}
            <div className="hidden md:flex items-center gap-2">
              <a href={`https://wa.me/${rawWhatsapp}`} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors" title="WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </a>
              {company.instagramUrl && company.instagramUrl !== '#' && (
                <a href={company.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-full transition-colors" title="Instagram">
                  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </a>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

            {/* User Account (Desktop & Mobile) */}
            <div className="relative" ref={dropdownRef}>
              {user ? (
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors font-bold text-sm"
                  aria-label="Menú de usuario"
                >
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/20">
                    {user.name ? user.name.charAt(0) : <User className="w-4 h-4" />}
                  </div>
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.name?.split(' ')[0] || 'Mi Cuenta'}</span>
                </button>
              ) : (
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors font-bold text-sm"
                  aria-label="Iniciar sesión"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden sm:inline">Ingresar</span>
                </button>
              )}

              {/* Desktop User Dropdown */}
              {isDropdownOpen && user && (
                <div className="absolute top-full mt-3 right-0 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-1 bg-slate-50/50 dark:bg-slate-800/40">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    {user.is_wholesale && (
                      <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full">
                        Mayorista Activo
                      </span>
                    )}
                  </div>
                  <Link onClick={() => setIsDropdownOpen(false)} href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors">
                    <User className="w-4 h-4" /> Mis Datos Personales
                  </Link>
                  <Link onClick={() => setIsDropdownOpen(false)} href="/profile/orders" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors">
                    <Package className="w-4 h-4" /> Mis Pedidos Realizados
                  </Link>
                  <button 
                    onClick={() => { setIsDropdownOpen(false); openCart(); }} 
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors text-left"
                  >
                    <span className="flex items-center gap-3">
                      <ShoppingBag className="w-4 h-4" /> Carrito de Compras
                    </span>
                    {totalItems > 0 && (
                      <span className="flex items-center justify-center px-1.5 py-0.5 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-black rounded-full shadow-sm">
                        {totalItems}
                      </span>
                    )}
                  </button>
                  {user.role === 'admin' && (
                    <Link onClick={() => setIsDropdownOpen(false)} href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors">
                      <ShieldCheck className="w-4 h-4" /> Panel de Control Admin
                    </Link>
                  )}
                  <div className="h-px bg-slate-100 dark:border-slate-800 my-1" />
                  <button onClick={() => { logout(); setIsDropdownOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <LogOut className="w-4 h-4" /> Cerrar Sesión
                  </button>
                </div>
              )}
            </div>

            {/* Cart Toggle */}
            <button
              onClick={openCart}
              className="relative p-2.5 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-black rounded-full shadow-sm animate-in zoom-in">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-900 dark:text-slate-100 hover:text-primary transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE NAVIGATION DRAWER */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[85%] max-w-[360px] bg-white dark:bg-slate-900 shadow-2xl z-[120] lg:hidden flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
            <Logo />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

          {/* Mobile Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Buscar perfumes, fragancias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 border border-transparent focus:border-primary focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </form>

          {/* User Account Card */}
          {user ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm uppercase shrink-0 border border-primary/20">
                  {user.name ? user.name.charAt(0) : <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>

              {user.is_wholesale && (
                <div className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-purple-200 dark:border-purple-800">
                  <span className="material-symbols-outlined text-[15px]">verified</span>
                  Cuenta Mayorista Activa
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-primary transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-primary" />
                  Mis Datos
                </Link>
                <Link
                  href="/profile/orders"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-primary transition-colors"
                >
                  <Package className="w-3.5 h-3.5 text-primary" />
                  Mis Pedidos
                </Link>
              </div>

              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2 px-3 w-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Panel de Administración
                </Link>
              )}

              <button
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col gap-3">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">¡Bienvenido a Ciara Bonita!</p>
                <p className="text-xs text-slate-500 mt-0.5">Iniciá sesión o registrate para gestionar tus pedidos y acceder a precios exclusivos.</p>
              </div>
              <button
                onClick={() => { setIsMobileMenuOpen(false); openAuthModal('login'); }}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                Ingresar / Registrarse
              </button>
            </div>
          )}

          {/* Navigation Links in Mobile */}
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-3 block mb-2">
              Secciones
            </span>

            <Link
              href="/catalog"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-2xl text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">grid_view</span>
                Todas las Colecciones
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/catalog?category=Perfumes de Mujer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-2xl text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-pink-500 text-xl">female</span>
                Perfumes de Mujer
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/catalog?category=Perfumes de Hombre"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-2xl text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500 text-xl">male</span>
                Perfumes de Hombre
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/donde-estamos"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between p-3 rounded-2xl text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-colors text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-500 text-xl">location_on</span>
                ¿Dónde estamos?
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Quick Cart Button */}
          <div className="pt-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); openCart(); }}
              className="w-full flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary rounded-2xl font-bold text-sm text-slate-800 dark:text-white transition-colors"
            >
              <span className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Mi Carrito
              </span>
              {totalItems > 0 ? (
                <span className="bg-primary text-white text-xs px-2.5 py-0.5 rounded-full font-black">
                  {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Vacío</span>
              )}
            </button>
          </div>

        </div>

        {/* Drawer Footer with Contact */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <a
            href={`https://wa.me/${rawWhatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>

          {company.phone && (
            <a
              href={`tel:${company.phone.replace(/\s+/g, '')}`}
              className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors flex items-center justify-center"
              title="Llamar"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
