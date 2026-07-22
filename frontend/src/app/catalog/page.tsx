'use client';

import Image from 'next/image'
import Link from 'next/link'
import { useStockFlowStore, CATEGORIAS_PERFUMERIA } from '@/store/useStockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense, useMemo } from 'react';

function CatalogContent() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
  const storeProducts = useStockFlowStore(s => s.products);
  const user = useAuthStore(s => s.user);
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryFilter = searchParams.get('category');

  // Determine expanded category group based on current URL
  const initialExpandedGroup = CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(categoryFilter || ''))?.grupo || null;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(initialExpandedGroup);

  const [mounted, setMounted] = useState(false);

  // Extract unique filter options from storeProducts
  const allSizes = useMemo(() => Array.from(new Set(storeProducts.flatMap(p => p.variants.map(v => v.size)))).filter(s => s && s !== 'Unico').sort(), [storeProducts]);
  const allColors = useMemo(() => Array.from(new Set(storeProducts.flatMap(p => p.variants.map(v => v.color)))).filter(Boolean).sort(), [storeProducts]);
  const highestPrice = useMemo(() => storeProducts.length > 0 ? Math.max(...storeProducts.map(p => p.salePrice || 0)) : 100000, [storeProducts]);

  // Filter States
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [priceRange, setPriceRange] = useState<number>(highestPrice);

  // Expanded Filter Sections State
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    talle: true,
    color: false,
    precio: true
  });

  const toggleFilter = (filter: string) => {
    setExpandedFilters(prev => ({ ...prev, [filter]: !prev[filter] }));
  };

  useEffect(() => {
    setMounted(true);
    setPriceRange(highestPrice);
  }, [highestPrice]);

  // Apply Filters
  const filteredProducts = useMemo(() => {
    let result = categoryFilter
      ? storeProducts.filter(p => p.categoryId === categoryFilter)
      : storeProducts;

    if (selectedSize) {
      result = result.filter(p => p.variants.some(v => v.size === selectedSize));
    }

    if (selectedColor) {
      result = result.filter(p => p.variants.some(v => v.color.toLowerCase() === selectedColor.toLowerCase()));
    }

    if (priceRange < highestPrice) {
      result = result.filter(p => (p.salePrice || 0) <= priceRange);
    }

    return result;
  }, [storeProducts, categoryFilter, selectedSize, selectedColor, priceRange, highestPrice]);

  if (!mounted) return null;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-white dark:bg-slate-900">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex flex-1 px-6 lg:px-20 py-8 gap-10">
          {/* Sidebar Filters */}
          <aside className="hidden lg:flex flex-col w-72 shrink-0 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Categorías</h3>
                <p className="text-slate-500 text-sm">Explora nuestras fragancias</p>
              </div>
              <div className="flex flex-col gap-1 pr-2">
                <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${!categoryFilter ? 'bg-primary text-white shadow-md shadow-primary/20' : 'hover:bg-primary/10 text-slate-700 dark:text-slate-300'}`} href="/catalog">
                  <span className="material-symbols-outlined">grid_view</span>
                  <span>Todos los Productos</span>
                </Link>

                {CATEGORIAS_PERFUMERIA.map(g => {
                  const isExpanded = expandedGroup === g.grupo;
                  const hasActiveChild = g.opciones.includes(categoryFilter || '');

                  return (
                    <div key={g.grupo} className="mt-1">
                      <button
                        onClick={() => setExpandedGroup(isExpanded ? null : g.grupo)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors font-medium text-sm ${isExpanded || hasActiveChild ? 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>{g.grupo}</span>
                        <span className={`material-symbols-outlined transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          expand_more
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="flex flex-col gap-1 mt-1 pl-4 animate-in slide-in-from-top-2 duration-200">
                          {g.opciones.map(opt => (
                            <Link
                              key={opt}
                              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-sm ${categoryFilter === opt ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                              href={`/catalog?category=${encodeURIComponent(opt)}`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${categoryFilter === opt ? 'bg-primary' : 'bg-transparent'}`}></div>
                              <span>{opt}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Filtros</h3>
                {(selectedSize || selectedColor || priceRange < highestPrice) && (
                  <button
                    onClick={() => {
                      setSelectedSize('');
                      setSelectedColor('');
                      setPriceRange(highestPrice);
                    }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {/* Talle Filter */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFilter('talle')}
                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-300"
                  >
                    Talle <span className={`material-symbols-outlined text-sm transition-transform ${expandedFilters.talle ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {expandedFilters.talle && (
                    <div className="p-4 bg-white dark:bg-slate-900">
                      <div className="flex flex-wrap gap-2">
                        {allSizes.length > 0 ? allSizes.map(size => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(selectedSize === size ? '' : size)}
                            className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${selectedSize === size ? 'border-primary bg-primary text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'}`}
                          >
                            {size}
                          </button>
                        )) : (
                          <p className="text-xs text-slate-400">No hay talles disponibles</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Filter */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFilter('color')}
                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-300"
                  >
                    Color <span className={`material-symbols-outlined text-sm transition-transform ${expandedFilters.color ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {expandedFilters.color && (
                    <div className="p-4 bg-white dark:bg-slate-900">
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {allColors.length > 0 ? allColors.map(color => (
                          <label key={color} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedColor === color ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary'}`}>
                              {selectedColor === color && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors capitalize">{color}</span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={selectedColor === color}
                              onChange={() => setSelectedColor(selectedColor === color ? '' : color)}
                            />
                          </label>
                        )) : (
                          <p className="text-xs text-slate-400">No hay colores disponibles</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Filter */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFilter('precio')}
                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-300"
                  >
                    Precio Máximo <span className={`material-symbols-outlined text-sm transition-transform ${expandedFilters.precio ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {expandedFilters.precio && (
                    <div className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-4">
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>$0</span>
                        <span>${priceRange.toLocaleString('es-AR')}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={highestPrice}
                        step={1000}
                        value={priceRange}
                        onChange={(e) => setPriceRange(Number(e.target.value))}
                        className="w-full accent-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Product Grid Content */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{categoryFilter || 'Catálogo Completo'}</h1>
                <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-bold">{filteredProducts.length}</span>
                  artículos encontrados
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">sort</span>
                  Ordenar por
                  <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
                </button>
              </div>
            </div>

            {/* Grid Layout (Zustand Render) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product: any) => (
                <Link key={product.id} href={`/product/${product.id}`} className="group flex flex-col gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                  <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-slate-50 dark:bg-slate-800">
                    {product.imageUrls && product.imageUrls.length > 0 ? (
                      <div
                        className="w-full h-full bg-center bg-cover transition-transform duration-700 group-hover:scale-110"
                        style={{ backgroundImage: `url("${product.imageUrls[0].startsWith('http') ? product.imageUrls[0] : `${API_URL}${product.imageUrls[0]}`}")` }}
                      ></div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 transition-transform duration-500 group-hover:scale-105">
                        <span className="material-symbols-outlined text-4xl opacity-40 mb-2">image</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm">
                      Nuevo
                    </div>

                    <button className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-white text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:text-red-500 hover:scale-110 shadow-lg">
                      <span className="material-symbols-outlined text-[20px]">favorite</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 px-1">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider truncate">{product.categoryId}</p>
                    <h3 className="text-slate-900 dark:text-slate-100 text-sm font-bold group-hover:text-primary transition-colors line-clamp-2 leading-tight">{product.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-primary font-black text-lg">${(product.salePrice || 0).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination Placeholder */}
            {filteredProducts.length > 0 && (
              <div className="mt-16 flex justify-center items-center gap-2">
                <button className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-white font-bold shadow-md shadow-primary/20">1</button>
                <button className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            )}

            {filteredProducts.length === 0 && (
              <div className="mt-8 p-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100 dark:border-slate-700">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-500 block">search_off</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No se encontraron productos</h3>
                <p className="text-slate-500 mb-8 max-w-md mx-auto">No hay artículos que coincidan con los filtros seleccionados. Intenta ajustar los criterios de búsqueda.</p>
                <button
                  onClick={() => {
                    setSelectedSize('');
                    setSelectedColor('');
                    setPriceRange(highestPrice);
                    router.push('/catalog');
                  }}
                  className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined">restart_alt</span> Limpiar Filtros
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer Section */}
        <footer className="mt-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 lg:px-20 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-3xl">spa</span>
                <h2 className="text-xl font-black tracking-tight leading-none text-slate-900 dark:text-white">Essence <br /><span className="text-sm font-bold text-primary">Perfumería Exclusiva</span></h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                Descubre la esencia que mejor te representa con nuestra selección exclusiva de fragancias y accesorios.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-sm">Tienda</h4>
              <ul className="flex flex-col gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                <li><Link className="hover:text-primary transition-colors" href="#">Perfumes</Link></li>
                <li><Link className="hover:text-primary transition-colors" href="#">Maquillaje</Link></li>
                <li><Link className="hover:text-primary transition-colors" href="#">Cuidado Personal</Link></li>
                <li><Link className="hover:text-primary transition-colors" href="#">Accesorios</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-sm">Soporte</h4>
              <ul className="flex flex-col gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                <li><Link className="hover:text-primary transition-colors" href="#">Guía de Talles</Link></li>
                <li><Link className="hover:text-primary transition-colors" href="#">Política de Envíos</Link></li>
                <li><Link className="hover:text-primary transition-colors" href="#">Cambios y Devoluciones</Link></li>
                <li><Link className="hover:text-primary transition-colors" href="#">Contáctanos</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider text-sm">Mantente Inspirada</h4>
              <div className="flex flex-col gap-4">
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <input className="bg-transparent border-none focus:ring-0 text-sm px-4 py-2 w-full text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="Tu correo electrónico" type="email" />
                  <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-dark transition-colors"><span className="material-symbols-outlined text-sm">send</span></button>
                </div>
                <div className="flex gap-4 mt-2">
                  <Link className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-colors" href="#"><span className="material-symbols-outlined text-[18px]">public</span></Link>
                  <Link className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-colors" href="#"><span className="material-symbols-outlined text-[18px]">share</span></Link>
                  <Link className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-colors" href="#"><span className="material-symbols-outlined text-[18px]">photo_camera</span></Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
            © {new Date().getFullYear()} Essence Perfumería. Todos los derechos reservados.
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-primary font-bold"><span className="material-symbols-outlined animate-spin mr-2">refresh</span>Cargando catálogo...</div>}>
      <CatalogContent />
    </Suspense>
  );
}
