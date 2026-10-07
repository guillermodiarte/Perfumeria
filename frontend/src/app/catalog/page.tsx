'use client';

import Image from 'next/image';
import Link from 'next/link';
import { API_URL } from '@/utils/api';
import { useStockFlowStore } from '@/store/useStockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { Filter, X, ArrowUpDown, Check, ChevronDown, Sparkles } from 'lucide-react';

function CatalogContent() {
  const storeProducts = useStockFlowStore(s => s.products);
  const user = useAuthStore(s => s.user);
  const searchParams = useSearchParams();
  const router = useRouter();

  const categoryFilter = searchParams.get('category');
  const searchQuery = searchParams.get('q') || '';

  const categoriesConfig = useStockFlowStore(s => s.categoriesConfig);

  // Determine expanded category group based on current URL
  const initialExpandedGroup = categoriesConfig.find(g => g.opciones.includes(categoryFilter || ''))?.grupo || null;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(initialExpandedGroup);

  const [mounted, setMounted] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'name_asc'>('default');

  // Extract unique filter options from storeProducts
  const allSizes = useMemo(() => Array.from(new Set(storeProducts.flatMap(p => p.variants.map(v => v.size)))).filter(s => s && s !== 'Unico' && s !== 'Único').sort(), [storeProducts]);
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

  // Lock scroll when mobile filters are open
  useEffect(() => {
    if (isMobileFiltersOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileFiltersOpen]);

  // Apply Filters & Search
  const filteredProducts = useMemo(() => {
    let result = storeProducts;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.categoryId && p.categoryId.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter(p => {
        if (categoryFilter === 'Perfumes de Mujer') {
          const isWomanOrUnisex = p.targetGender === 'Mujer' || p.targetGender === 'Unisex' || (!p.targetGender && p.categoryId === 'Perfumes de Mujer');
          return isWomanOrUnisex && p.targetGender !== 'Hombre';
        }
        if (categoryFilter === 'Perfumes de Hombre') {
          const isManOrUnisex = p.targetGender === 'Hombre' || p.targetGender === 'Unisex' || (!p.targetGender && p.categoryId === 'Perfumes de Hombre');
          return isManOrUnisex && p.targetGender !== 'Mujer';
        }
        if (categoryFilter === 'Unisex') {
          return p.targetGender === 'Unisex' || p.categoryId === 'Unisex';
        }
        return p.categoryId === categoryFilter;
      });
    }

    if (selectedSize) {
      result = result.filter(p => p.variants.some(v => v.size === selectedSize));
    }

    if (selectedColor) {
      result = result.filter(p => p.variants.some(v => v.color.toLowerCase() === selectedColor.toLowerCase()));
    }

    if (priceRange < highestPrice) {
      result = result.filter(p => (p.salePrice || 0) <= priceRange);
    }

    // Sorting
    const sorted = [...result];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
    } else if (sortBy === 'name_asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [storeProducts, searchQuery, categoryFilter, selectedSize, selectedColor, priceRange, highestPrice, sortBy]);

  const activeFiltersCount = (selectedSize ? 1 : 0) + (selectedColor ? 1 : 0) + (priceRange < highestPrice ? 1 : 0) + (categoryFilter ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedSize('');
    setSelectedColor('');
    setPriceRange(highestPrice);
    if (categoryFilter || searchQuery) {
      router.push('/catalog');
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-white dark:bg-slate-900">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex flex-1 px-4 sm:px-6 lg:px-20 py-4 sm:py-8 gap-8 lg:gap-10">

          {/* DESKTOP SIDEBAR FILTERS */}
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

                {categoriesConfig.map(g => {
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
                    Talle / Mililitros <span className={`material-symbols-outlined text-sm transition-transform ${expandedFilters.talle ? 'rotate-180' : ''}`}>expand_more</span>
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
                    Color / Tono <span className={`material-symbols-outlined text-sm transition-transform ${expandedFilters.color ? 'rotate-180' : ''}`}>expand_more</span>
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

          {/* MAIN PRODUCT GRID & CONTROLS */}
          <div className="flex-1 min-w-0">

            {/* QUICK CATEGORY CHIPS IN MOBILE */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-3 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              <Link
                href="/catalog"
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  !categoryFilter
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Todos
              </Link>
              <Link
                href="/catalog?category=Perfumes de Mujer"
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  categoryFilter === 'Perfumes de Mujer'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Mujer
              </Link>
              <Link
                href="/catalog?category=Perfumes de Hombre"
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  categoryFilter === 'Perfumes de Hombre'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Hombre
              </Link>
              <Link
                href="/catalog?category=Unisex"
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  categoryFilter === 'Unisex'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Unisex
              </Link>
            </div>

            {/* TOP BAR: Title, Search Info, Mobile Filter Trigger, Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{categoryFilter || (searchQuery ? `Búsqueda: "${searchQuery}"` : 'Catálogo Completo')}</span>
                </h1>
                <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                    {filteredProducts.length}
                  </span>
                  artículos disponibles
                </p>
              </div>

              {/* ACTION BUTTONS: Filters button on Mobile + Sort */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  <Filter className="w-4 h-4 text-primary" />
                  <span>Filtros</span>
                  {activeFiltersCount > 0 && (
                    <span className="size-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none text-xs sm:text-sm font-bold focus:ring-0 cursor-pointer pr-1"
                  >
                    <option value="default">Recomendados</option>
                    <option value="price_asc">Menor Precio</option>
                    <option value="price_desc">Mayor Precio</option>
                    <option value="name_asc">Nombre A-Z</option>
                  </select>
                </div>
              </div>
            </div>

            {/* RESPONSIVE PRODUCT GRID: 2 COLUMNS ON MOBILE */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {filteredProducts.map((product: any) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group flex flex-col justify-between bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                >
                  <div>
                    {/* Product Image */}
                    <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-slate-50 dark:bg-slate-800 mb-2.5">
                      {product.imageUrls && product.imageUrls.length > 0 ? (
                        <div
                          className="w-full h-full bg-center bg-cover transition-transform duration-700 group-hover:scale-105"
                          style={{
                            backgroundImage: `url("${product.imageUrls[0].startsWith('http') ? product.imageUrls[0] : `${API_URL}${product.imageUrls[0]}`}")`
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <span className="material-symbols-outlined text-3xl opacity-40">image</span>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                        {product.showTag && product.tag ? (
                          <span className="bg-primary text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                            {product.tag}
                          </span>
                        ) : (
                          <span className="bg-white/90 dark:bg-slate-900/90 text-primary text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                            Nuevo
                          </span>
                        )}
                        {product.targetGender && (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm ${
                            product.targetGender === 'Unisex'
                              ? 'bg-purple-600/90 text-white'
                              : product.targetGender === 'Hombre'
                              ? 'bg-blue-600/90 text-white'
                              : 'bg-pink-600/90 text-white'
                          }`}>
                            {product.targetGender}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Product Metadata */}
                    <div className="flex flex-col gap-1 px-1">
                      <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
                        {product.categoryId || 'Fragancia'}
                      </p>
                      <h3
                        className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold group-hover:text-primary transition-colors line-clamp-2 leading-tight"
                        title={product.name}
                      >
                        {product.name}
                      </h3>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 px-1 flex items-baseline justify-between">
                    {(() => {
                      const variantPrices = product.variants?.map((v: any) => v.manualSalePrice).filter((p: any): p is number => p !== undefined && p > 0) || [];
                      const minP = variantPrices.length > 0 ? Math.min(...variantPrices) : (product.salePrice || 0);
                      const maxP = variantPrices.length > 0 ? Math.max(...variantPrices) : (product.salePrice || 0);
                      const priceDisplay = variantPrices.length > 1 && minP !== maxP
                        ? `Desde $${minP.toLocaleString('es-AR')}`
                        : `$${(product.salePrice || minP).toLocaleString('es-AR')}`;
                      return (
                        <p className="text-primary font-black text-sm sm:text-base leading-none">
                          {priceDisplay}
                        </p>
                      );
                    })()}
                  </div>
                </Link>
              ))}
            </div>

            {/* EMPTY STATE */}
            {filteredProducts.length === 0 && (
              <div className="mt-8 p-8 sm:p-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 dark:text-slate-500 block">search_off</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">No se encontraron productos</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto text-xs sm:text-sm">
                  No hay artículos que coincidan con los filtros seleccionados o el término de búsqueda.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 text-xs sm:text-sm"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span> Limpiar Filtros
                </button>
              </div>
            )}
          </div>
        </main>

        {/* MOBILE FILTERS BOTTOM SHEET / DRAWER */}
        {isMobileFiltersOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileFiltersOpen(false)}
          />
        )}

        <div
          className={`fixed inset-x-0 bottom-0 max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl z-[140] lg:hidden flex flex-col transform transition-transform duration-300 ease-in-out ${
            isMobileFiltersOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Sheet Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Filtrar Productos</h3>
              {activeFiltersCount > 0 && (
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsMobileFiltersOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sheet Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {/* Categorías */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Categorías</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push('/catalog')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    !categoryFilter ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Todas las categorías
                </button>
                {categoriesConfig.flatMap(g => g.opciones).map(opt => (
                  <button
                    key={opt}
                    onClick={() => router.push(`/catalog?category=${encodeURIComponent(opt)}`)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      categoryFilter === opt ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Talles */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Talle / Mililitros</h4>
              <div className="flex flex-wrap gap-2">
                {allSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(selectedSize === size ? '' : size)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedSize === size ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Colores */}
            {allColors.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Color / Variante</h4>
                <div className="flex flex-wrap gap-2">
                  {allColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                        selectedColor === color ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Precio Máximo */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Precio Máximo</h4>
                <span className="text-xs font-black text-primary">${priceRange.toLocaleString('es-AR')}</span>
              </div>
              <input
                type="range"
                min={0}
                max={highestPrice}
                step={1000}
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Sheet Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3 shrink-0">
            <button
              onClick={clearAllFilters}
              className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Limpiar
            </button>
            <button
              onClick={() => setIsMobileFiltersOpen(false)}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all text-center"
            >
              Ver {filteredProducts.length} productos
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 lg:px-20 py-12">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Ciara Bonita. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <Link href="/catalog" className="hover:text-primary transition-colors">Catálogo</Link>
              <Link href="/donde-estamos" className="hover:text-primary transition-colors">¿Dónde estamos?</Link>
              <a href="https://wa.me/5493704747426" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">WhatsApp</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-primary font-bold"><span className="material-symbols-outlined animate-spin mr-2">refresh</span>Cargando catálogo...</div>}>
      <CatalogContent />
    </Suspense>
  );
}
