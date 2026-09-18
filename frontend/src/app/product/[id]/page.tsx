'use client';

import Link from 'next/link'
import { useStockFlowStore } from '@/store/useStockStore';
import { useCartStore } from '@/store/useCartStore';
import { API_URL } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useCartUIStore } from '@/store/useCartUIStore';
import { useToastStore } from '@/store/useToastStore';
import { Wind, Clock, Sparkles, Droplets } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

/* ─── Lightbox ─────────────────────────────────────────────────────── */
function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 size-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
        onClick={onClose}
      >
        <span className="material-symbols-outlined text-xl">close</span>
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-sm font-bold px-4 py-1.5 rounded-full backdrop-blur-md">
          {current + 1} / {images.length}
        </div>
      )}

      {/* Prev */}
      {images.length > 1 && (
        <button
          className="absolute left-4 size-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          onClick={e => { e.stopPropagation(); prev(); }}
        >
          <span className="material-symbols-outlined text-3xl">chevron_left</span>
        </button>
      )}

      {/* Main image */}
      <img
        src={images[current]}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
        alt="Imagen del producto"
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          className="absolute right-4 size-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          onClick={e => { e.stopPropagation(); next(); }}
        >
          <span className="material-symbols-outlined text-3xl">chevron_right</span>
        </button>
      )}

      {/* Strip */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2.5 max-w-[80vw] overflow-x-auto px-2 pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrent(i); }}
              className={`size-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${i === current ? 'border-white scale-110' : 'border-white/25 opacity-50 hover:opacity-90'}`}
            >
              <img src={img} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */
export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const products = useStockFlowStore(s => s.products);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const categoriesConfig = useStockFlowStore(s => s.categoriesConfig);
  const addItem = useCartStore(s => s.addItem);
  const user = useAuthStore(s => s.user);
  const openModal = useAuthModalStore(s => s.openModal);
  const openCart = useCartUIStore(s => s.openCart);
  const addToast = useToastStore(s => s.addToast);
  const [mounted, setMounted] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [descOpen, setDescOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const product = products.find(p => p.id === params.id);
  const uniqueSizes = product ? Array.from(new Set(product.variants.map(v => v.size))).filter(Boolean) : [];
  const uniqueColors = product ? Array.from(new Set(product.variants.map(v => v.color))).filter(s => s && s.trim()) : [];

  useEffect(() => {
    if (uniqueSizes.length > 0 && !selectedSize) setSelectedSize(uniqueSizes[0]);
    if (uniqueColors.length > 0 && !selectedColor) setSelectedColor(uniqueColors[0]);
  }, [uniqueSizes, uniqueColors, selectedSize, selectedColor]);

  if (!mounted) return null;

  if (!product) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 text-slate-900 bg-background-light dark:bg-background-dark dark:text-slate-100 font-display">
        <span className="material-symbols-outlined text-6xl text-slate-300">error</span>
        <h1 className="text-2xl font-black">Producto no encontrado</h1>
        <Link href="/catalog" className="px-6 py-3 bg-primary text-white font-bold rounded-xl mt-4 hover:scale-105 transition-transform">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const parseImageUrl = (imgUrl: string) => imgUrl.startsWith('http') ? imgUrl : `${API_URL}${imgUrl}`;
  const images = (product.imageUrls && product.imageUrls.length > 0)
    ? product.imageUrls.map(parseImageUrl)
    : [];

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5493704747426";
  const whatsappUrl = `https://wa.me/${phone}?text=Hola,%20quisiera%20consultar%20disponibilidad%20sobre%20el%20producto:%20${encodeURIComponent(product.name)}%20(SKU:%20${product.sku || 'N/A'})`;

  const sizeToMatch = selectedSize || (uniqueSizes.length > 0 ? uniqueSizes[0] : (product.variants[0]?.size || ''));
  const colorToMatch = selectedColor || (uniqueColors.length > 0 ? uniqueColors[0] : (product.variants[0]?.color || ''));
  const currentVariant = product.variants.find(v => 
    (!sizeToMatch || v.size === sizeToMatch) && 
    (!colorToMatch || v.color === colorToMatch)
  ) || product.variants[0];
  const maxStock = currentVariant?.stock || 0;

  const minWholesaleQty = wholesaleConfig?.minQuantity || 6;
  const wholesaleDiscountPrc = wholesaleConfig?.discountPercentage || 20;
  const isUserWholesale = !!(user?.is_wholesale || (user?.wholesale_until && new Date(user.wholesale_until) > new Date()));
  const isWholesale = Boolean(isUserWholesale || (quantity >= minWholesaleQty));

  // Use per-variant price if available, otherwise fall back to product-level price
  const variantSalePrice = currentVariant?.manualSalePrice;
  const basePrice = (variantSalePrice != null && variantSalePrice > 0) ? variantSalePrice : (product.salePrice || 0);

  const currentPrice = isWholesale ? basePrice * (1 - wholesaleDiscountPrc / 100) : basePrice;
  const oldPrice = isWholesale ? basePrice : null;

  // Determine variant label based on category
  const catGroup = categoriesConfig.find(g => g.opciones.includes(product.categoryId));
  const isPerfumery = catGroup?.variantGroupId === 'perfumes' || catGroup?.grupo === 'Perfumería' || catGroup?.grupo === 'Cuidado Personal';
  const colorLabel = isPerfumery ? null : (uniqueColors.length > 0 ? 'Color / Variante' : null);

  const handleAddToCart = () => {
    const action = () => {
      const variant = currentVariant || product.variants[0];
      if (variant) {
        addItem(product, variant.id, variant.size, variant.color, quantity);
        setAdded(true);
        addToast(`${quantity}x ${product.name} (${variant.size}) añadido al carrito`, 'success');
        setTimeout(() => setAdded(false), 2000);
        openCart();
      }
    };
    if (uniqueSizes.length > 0 && !selectedSize) { alert('Por favor selecciona un talle.'); return; }
    if (uniqueColors.length > 0 && !selectedColor) { alert('Por favor selecciona un color/variante.'); return; }
    if (!user) { openModal('login', action); return; }
    action();
  };

  // Feature cards config
  const featureCards = [
    { label: 'Notas Olfativas', value: product.olfactoryNotes, Icon: Wind },
    { label: 'Duración', value: product.duration, Icon: Clock },
    { label: 'Intensidad', value: product.intensity, Icon: Sparkles },
    { label: 'Familia', value: product.family, Icon: Droplets },
  ].filter(f => f.value && f.value.trim());

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-white dark:bg-slate-950">
      {lightboxIndex !== null && (
        <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      <div className="layout-container flex h-full grow flex-col">
        {/* Breadcrumbs */}
        <div className="px-6 lg:px-20 py-4 hidden md:flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <Link href="/" className="hover:text-primary transition-colors">Inicio</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link href="/catalog" className="hover:text-primary transition-colors">Colección</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-slate-600 dark:text-slate-300">{product.categoryId}</span>
        </div>

        <main className="flex-1 px-4 lg:px-20 py-6 lg:py-10">
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">

            {/* ── Image Gallery ─────────────────────────────── */}
            <div className="w-full lg:w-1/2 xl:w-[52%] flex flex-col gap-4">
              {images.length > 0 ? (
                <div className="flex flex-col-reverse md:flex-row gap-4">
                  {/* Thumbnails */}
                  {images.length > 1 && (
                    <div className="flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto md:max-h-[540px] pb-2 md:pb-0 scrollbar-hide flex-shrink-0">
                      {images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImageIndex(i)}
                          className={`w-16 h-20 md:w-20 md:h-24 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${selectedImageIndex === i ? 'border-primary shadow-lg shadow-primary/20' : 'border-transparent opacity-55 hover:opacity-90 hover:border-slate-200 dark:hover:border-slate-600'}`}
                        >
                          <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-contain bg-slate-50 dark:bg-slate-900" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Main Image */}
                  <div
                    className="flex-1 min-h-[380px] sm:min-h-[480px] lg:min-h-[540px] overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900 relative group cursor-zoom-in flex items-center justify-center"
                    onClick={() => setLightboxIndex(selectedImageIndex)}
                  >
                    <img
                      src={images[selectedImageIndex]}
                      alt={product.name}
                      className="w-full h-full max-h-[540px] object-contain transition-transform duration-500 group-hover:scale-105 p-3"
                    />
                    {/* Zoom hint */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-end justify-end p-4 opacity-0 group-hover:opacity-100">
                      <div className="bg-black/50 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                        Ver en pantalla completa
                      </div>
                    </div>
                    {/* Dot indicator */}
                    {images.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                          <span
                            key={i}
                            className={`block rounded-full transition-all duration-300 ${selectedImageIndex === i ? 'w-5 h-2 bg-primary' : 'w-2 h-2 bg-slate-300 dark:bg-slate-600'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full min-h-[480px] overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-7xl opacity-30">image</span>
                    <p className="text-sm opacity-50">Sin imagen</p>
                  </div>
                </div>
              )}

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: 'verified', label: '100% Original' },
                  { icon: 'local_shipping', label: 'Envío seguro' },
                  { icon: 'forum', label: 'Asesoramiento' },
                ].map(b => (
                  <div key={b.icon} className="flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-2">
                    <span className="material-symbols-outlined text-primary text-xl">{b.icon}</span>
                    <span className="text-[10px] font-bold text-slate-500 text-center">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Product Info ───────────────────────────────── */}
            <div className="w-full lg:w-1/2 xl:w-[48%] flex flex-col">
              <div className="sticky top-24 flex flex-col gap-6">

                {/* Header */}
                <div className="flex flex-col gap-2">
                  {/* Tag / Badge */}
                  {product.showTag && product.tag && (
                    <div className="inline-flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest w-fit">
                      <span className="material-symbols-outlined text-sm">local_fire_department</span>
                      {product.tag}
                    </div>
                  )}
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">{product.name}</h1>
                  {product.sku && <p className="text-slate-400 font-mono text-sm">SKU: {product.sku}</p>}
                  
                  {/* Price */}
                  <div className="flex flex-col mt-1 gap-1">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <p className="text-3xl font-black text-primary">
                        ${currentPrice.toLocaleString('es-AR')}
                      </p>
                      {oldPrice && !isWholesale && (
                        <span className="text-sm font-medium text-slate-400 line-through">${oldPrice.toLocaleString('es-AR')}</span>
                      )}
                      {isWholesale && (
                        <span className="text-[11px] bg-primary/20 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                          Precio mayorista
                        </span>
                      )}
                    </div>
                    {isWholesale && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold">
                        ¡Descuento del {wholesaleDiscountPrc}% aplicado!
                      </p>
                    )}
                  </div>
                </div>

                {/* Color/Variante Selection — only for non-perfume categories */}
                {colorLabel && uniqueColors.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">{colorLabel}</span>
                      <span className="text-slate-400 capitalize text-xs">{selectedColor}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {uniqueColors.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(c)}
                          className={`px-4 py-2 border rounded-xl text-sm capitalize font-medium transition-all ${selectedColor === c ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:border-slate-300'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size Selection */}
                {uniqueSizes.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {isPerfumery ? 'Tamaño' : 'Talle'}
                      </span>
                      <span className="text-slate-400 text-xs">{selectedSize}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSizes.map(s => {
                        const variantForSize = product.variants.find(v => v.size === s);
                        const varPrice = variantForSize?.manualSalePrice;
                        return (
                          <button
                            key={s}
                            onClick={() => setSelectedSize(s)}
                            className={`h-12 px-4 rounded-xl border-2 flex items-center gap-2 justify-center font-bold transition-all text-sm ${selectedSize === s ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30' : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white bg-white dark:bg-slate-800 hover:border-primary/50'}`}
                          >
                            <span>{s}</span>
                            {varPrice !== undefined && varPrice > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${selectedSize === s ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                ${(isWholesale ? varPrice * (1 - wholesaleDiscountPrc / 100) : varPrice).toLocaleString('es-AR')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-900 dark:text-white">Cantidad</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${maxStock > 5 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : maxStock > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                      {maxStock > 0 ? `${maxStock} disponibles` : 'Sin stock'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="h-12 w-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >−</button>
                    <div className="h-12 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-xl text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800">
                      {quantity}
                    </div>
                    <button
                      onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
                      disabled={quantity >= maxStock}
                      className="h-12 w-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >+</button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleAddToCart}
                    className={`flex items-center justify-center gap-3 w-full h-14 font-bold text-lg rounded-2xl transition-all shadow-xl group ${added ? 'bg-green-500 text-white shadow-green-500/20 scale-[1.01]' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-slate-900/15 dark:shadow-white/10 hover:scale-[1.02]'}`}
                  >
                    <span className="material-symbols-outlined">{added ? 'check_circle' : 'shopping_bag'}</span>
                    {added ? '¡Añadido al carrito!' : 'Añadir al carrito'}
                  </button>
                  <Link href="/checkout" className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors py-1">
                    Ver Carrito y Finalizar Compra
                  </Link>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">forum</span>
                    Consultar por WhatsApp
                  </a>
                </div>

                {/* Description (expandable) */}
                {product.description && product.description.trim() && (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setDescOpen(o => !o)}
                      className="flex items-center justify-between w-full text-left px-5 py-4 font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-primary text-[18px]">auto_stories</span>
                        Descripción Premium
                      </span>
                      <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${descOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                    {descOpen && (
                      <div className="px-5 py-4 text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-line">
                        {product.description}
                      </div>
                    )}
                  </div>
                )}

                {/* Feature / Olfactory Cards */}
                {product.showFeatures && featureCards.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {featureCards.map(({ label, value, Icon }) => (
                      <div key={label} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Icon className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>

          </div>
        </main>

        {/* Related Products */}
        <section className="px-4 lg:px-20 py-16 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Te podría interesar</h3>
            <Link href={`/catalog?category=${encodeURIComponent(product.categoryId)}`} className="text-sm font-bold text-primary hover:underline">
              Ver más {product.categoryId}
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {products
              .filter(p => p.categoryId === product.categoryId && p.id !== product.id)
              .slice(0, 4)
              .map(p => (
                <Link key={p.id} href={`/product/${p.id}`} className="group flex flex-col gap-3">
                  <div className="aspect-[4/5] bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden relative flex items-center justify-center p-2">
                    {p.imageUrls && p.imageUrls.length > 0 ? (
                      <img
                        src={parseImageUrl(p.imageUrls[0])}
                        alt={p.name}
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-slate-300">image</span>
                    )}
                  </div>
                  <div className="px-1">
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-2 leading-snug">{p.name}</h4>
                    <p className="text-primary font-black text-sm mt-0.5">${(p.salePrice || 0).toLocaleString('es-AR')}</p>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
          <div className="px-6 lg:px-20 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col gap-4">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-lg italic">
                <span className="material-symbols-outlined text-primary">spa</span> Ciara Bonita
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                Elegancia, calidad y exclusividad. Fragancias creadas para destacar tu personalidad todos los días.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-4">Ayuda</h4>
              <ul className="flex flex-col gap-2 text-sm text-slate-500">
                <li><Link href="#" className="hover:text-primary transition-colors">Seguimiento de Orden</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Cambios y Devoluciones</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Envíos a todo el país</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-4">Newsletter</h4>
              <p className="text-slate-500 text-sm mb-4">Únete para acceso anticipado a nuestras colecciones.</p>
              <div className="flex h-11 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                <input className="bg-transparent border-none px-4 text-sm w-full outline-none" placeholder="Tu Email" type="email" />
                <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 font-bold text-sm">Unirte</button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
