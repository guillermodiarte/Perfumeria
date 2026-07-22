'use client';

import Image from 'next/image'
import Link from 'next/link'
import { useStockFlowStore } from '@/store/useStockStore';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useCartUIStore } from '@/store/useCartUIStore';
import { useToastStore } from '@/store/useToastStore';
import { Wind, Clock, Sparkles, Droplets } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const products = useStockFlowStore(s => s.products);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const addItem = useCartStore(s => s.addItem);
  const user = useAuthStore(s => s.user);
  const openModal = useAuthModalStore(s => s.openModal);
  const openCart = useCartUIStore(s => s.openCart);
  const addToast = useToastStore(s => s.addToast);
  const [mounted, setMounted] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const product = products.find(p => p.id === params.id);
  const uniqueSizes = product ? Array.from(new Set(product.variants.map(v => v.size))).filter(Boolean) : [];
  const uniqueColors = product ? Array.from(new Set(product.variants.map(v => v.color))).filter(Boolean) : [];

  // Set initial selected values if only one available
  useEffect(() => {
    if (uniqueSizes.length === 1 && !selectedSize) setSelectedSize(uniqueSizes[0]);
    if (uniqueColors.length === 1 && !selectedColor) setSelectedColor(uniqueColors[0]);
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
  const images = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : [];

  const parseImageUrl = (imgUrl: string) => {
    return imgUrl.startsWith('http') ? imgUrl : `${API_URL}${imgUrl}`;
  };

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5493704048860";
  const whatsappUrl = `https://wa.me/${phone}?text=Hola,%20quisiera%20consultar%20disponibilidad%20sobre%20el%20producto:%20${encodeURIComponent(product.name)}%20(SKU:%20${product.sku || 'N/A'})`;

  const minWholesaleQty = wholesaleConfig?.minQuantity || 6;
  const wholesaleDiscountPrc = wholesaleConfig?.discountPercentage || 10;
  const isWholesale = quantity >= minWholesaleQty;
  const basePrice = product.salePrice || 0;
  const currentPrice = isWholesale ? basePrice * (1 - wholesaleDiscountPrc / 100) : basePrice;
  const oldPrice = isWholesale ? basePrice : basePrice * 1.3;

  const handleAddToCart = () => {
    const action = () => {
      const sizeToMatch = selectedSize || (uniqueSizes.length === 0 ? product.variants[0]?.size : '');
      const colorToMatch = selectedColor || (uniqueColors.length === 0 ? product.variants[0]?.color : '');
      
      const variant = product.variants.find(v => v.size === sizeToMatch && v.color === colorToMatch) || product.variants[0];
      
      if (variant) {
        addItem(product, variant.id, variant.size, variant.color, quantity);
        setAdded(true);
        addToast(`${quantity}x ${product.name} añadido al carrito`, 'success');
        setTimeout(() => setAdded(false), 2000);
        openCart();
      }
    };

    if (uniqueSizes.length > 0 && !selectedSize) {
      alert("Por favor selecciona un talle.");
      return;
    }
    if (uniqueColors.length > 0 && !selectedColor) {
      alert("Por favor selecciona un color.");
      return;
    }

    if (!user) {
      openModal('login', action);
      return;
    }

    action();
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        {/* Breadcrumbs */}
        <div className="px-6 lg:px-20 py-4 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest hidden md:flex">
          <Link href="/" className="hover:text-primary transition-colors">Inicio</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <Link href="/catalog" className="hover:text-primary transition-colors">Colección</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-slate-900 dark:text-slate-300">{product.categoryId}</span>
        </div>

        <main className="flex-1 px-4 lg:px-20 py-6 lg:py-10">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">

            {/* Image Gallery (Left Side) */}
            <div className="w-full lg:w-3/5 flex flex-col gap-4">
              {images.length > 0 ? (
                <div className="flex flex-col-reverse md:flex-row gap-4">
                  {/* Thumbnails */}
                  <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
                    {images.map((img, i) => (
                      <button 
                        key={i}
                        onClick={() => setSelectedImageIndex(i)}
                        className={`w-20 h-24 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${selectedImageIndex === i ? 'border-primary opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600'}`}
                      >
                         <img src={parseImageUrl(img)} alt={`${product.name} ${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  {/* Main Image */}
                  <div className="flex-1 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 aspect-[4/5] sm:aspect-auto sm:h-[600px] relative group cursor-zoom-in">
                    <img 
                      src={parseImageUrl(images[selectedImageIndex])} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-primary text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                      Recomendado
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 aspect-[4/5] sm:aspect-auto sm:h-[600px] flex items-center justify-center text-slate-400">
                   <span className="material-symbols-outlined text-6xl opacity-40 mb-2">image</span>
                </div>
              )}
            </div>

            {/* Product Info (Right Side) */}
            <div className="w-full lg:w-2/5 flex flex-col">
              <div className="sticky top-24 flex flex-col gap-8">

                {/* Header Info */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-2">
                    <span className="material-symbols-outlined text-sm">local_fire_department</span>
                    Alta Demanda
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">{product.name}</h1>
                  <p className="text-slate-500 font-mono text-sm">SKU: {product.sku || 'N/A'}</p>
                  <div className="flex flex-col mt-2">
                    <p className="text-2xl font-black text-primary flex items-center gap-3">
                      ${currentPrice.toLocaleString('es-AR')}
                      <span className="text-sm font-medium text-slate-400 line-through">${oldPrice.toLocaleString('es-AR')}</span>
                      {isWholesale && (
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                          Precio mayorista
                        </span>
                      )}
                    </p>
                    {isWholesale && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                        ¡Descuento del {wholesaleDiscountPrc}% aplicado!
                      </p>
                    )}
                  </div>
                </div>

                {/* Color Selection */}
                {uniqueColors.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">Color Disponible</span>
                      <span className="text-slate-500 capitalize">{uniqueColors.join(', ')}</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {uniqueColors.map(c => (
                        <button 
                          key={c} 
                          onClick={() => setSelectedColor(c)}
                          className={`px-3 py-1 border rounded-lg text-sm capitalize font-medium transition-colors ${selectedColor === c ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800'}`}>
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
                      <span className="font-bold text-slate-900 dark:text-white">Talles Disponibles</span>
                      <button className="text-slate-500 underline underline-offset-4 hover:text-primary transition-colors">Guía de talles</button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {uniqueSizes.map(s => (
                        <button 
                          key={s} 
                          onClick={() => setSelectedSize(s)}
                          className={`h-12 px-4 rounded-xl border flex items-center justify-center font-bold transition-all ${selectedSize === s ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30' : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity Selector */}
                {(() => {
                  const sizeToMatch = selectedSize || (uniqueSizes.length === 0 ? product.variants[0]?.size : '');
                  const colorToMatch = selectedColor || (uniqueColors.length === 0 ? product.variants[0]?.color : '');
                  const currentVariant = product.variants.find(v => v.size === sizeToMatch && v.color === colorToMatch) || product.variants[0];
                  const maxStock = currentVariant?.stock || 0;

                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-900 dark:text-white">Cantidad</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${maxStock > 5 ? 'bg-green-100 text-green-700' : maxStock > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {maxStock > 0 ? `${maxStock} disponibles` : 'Sin stock'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          className="h-12 w-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <div className="h-12 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-lg text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800">
                          {quantity}
                        </div>
                        <button
                          onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
                          disabled={quantity >= maxStock}
                          className="h-12 w-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Action Button */}
                <div className="flex flex-col gap-4 mt-2 border-t border-slate-200 dark:border-slate-800 pt-8">
                  <button 
                    onClick={handleAddToCart}
                    className={`flex items-center justify-center gap-3 w-full h-14 font-bold text-lg rounded-2xl hover:scale-[1.02] transition-transform shadow-xl group ${added ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-slate-900/20 dark:shadow-white/10'}`}
                  >
                    <span className="material-symbols-outlined">
                      {added ? 'check_circle' : 'shopping_bag'}
                    </span>
                    {added ? 'Añadido al carrito' : 'Añadir al carrito'}
                  </button>
                  <Link href="/checkout" className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors">
                    Ver Carrito y Finalizar Compra
                  </Link>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <span className="material-symbols-outlined text-[16px]">forum</span>
                    Consultar por WhatsApp
                  </a>
                </div>

                {/* Product Description Expandable */}
                <div className="flex flex-col mt-4">
                  <div className="border-t border-slate-200 dark:border-slate-800 py-4">
                    <button className="flex items-center justify-between w-full text-left font-bold text-slate-900 dark:text-white">
                      Descripción Premium
                      <span className="material-symbols-outlined">expand_more</span>
                    </button>
                    <div className="mt-4 text-slate-500 text-sm leading-relaxed space-y-4">
                      <p>Creada con las esencias más puras para brindarte una experiencia olfativa inigualable. Cada nota está pensada para perdurar en la piel.</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Alta concentración de esencia.</li>
                        <li>Notas frescas y vibrantes.</li>
                        <li>Fijación prolongada en piel.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Detalles Premium Cards */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Wind className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Notas Olfativas</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">Cítricas, Florales</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Duración</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">Alta (+8 horas)</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Intensidad</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">Moderada - Fuerte</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Droplets className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Familia</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{product.categoryId}</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </main>

        {/* Related Products */}
        <section className="px-4 lg:px-20 py-16 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Te podría interesar</h3>
            <Link href={`/catalog?category=${encodeURIComponent(product.categoryId)}`} className="text-sm font-bold text-primary hover:underline">Ver más {product.categoryId}</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8">
            {products.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 4).map(p => (
              <Link key={p.id} href={`/product/${p.id}`} className="group flex flex-col gap-3">
                <div className="aspect-[4/5] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden relative">
                  <img src={parseImageUrl(p.imageUrls?.[0] || '')} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{p.name}</h4>
                  <p className="text-primary font-black text-sm">${(p.salePrice || 0).toLocaleString('es-AR')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
          <div className="px-6 lg:px-20 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col gap-4">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-lg italic"><span className="material-symbols-outlined text-primary">spa</span> Essence Perfumería</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">Elegancia, calidad y exclusividad. Fragancias creadas para destacar tu personalidad todos los días.</p>
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
              <div className="flex h-10 border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                <input className="bg-transparent border-none px-4 text-sm w-full outline-none" placeholder="Tu Email" type="email" />
                <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 font-bold text-sm">Unirte</button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
