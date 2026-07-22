'use client';

import { useCartStore } from '@/store/useCartStore';
import { useCartUIStore } from '@/store/useCartUIStore';
import { useStockFlowStore } from '@/store/useStockStore';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function CartDrawer() {
  const isOpen = useCartUIStore((s) => s.isOpen);
  const closeCart = useCartUIStore((s) => s.closeCart);
  const { items, updateQuantity, removeItem } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close cart when navigating
  useEffect(() => {
    closeCart();
  }, [pathname, closeCart]);

  if (!mounted) return null;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://perfumeria-app-npomsb-0df670-76-13-71-212.traefik.me';
  const parseImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return '';
    return imgUrl.startsWith('http') ? imgUrl : `http://${API_URL.split('://')[1]}${imgUrl}`;
  };

  const minWholesaleQty = wholesaleConfig?.minQuantity || 6;
  const wholesaleDiscountPrc = wholesaleConfig?.discountPercentage || 10;

  const subtotal = items.reduce((acc, item) => {
    const isWholesale = item.quantity >= minWholesaleQty;
    const basePrice = item.product.salePrice || 0;
    const currentPrice = isWholesale ? basePrice * (1 - wholesaleDiscountPrc / 100) : basePrice;
    return acc + currentPrice * item.quantity;
  }, 0);
  
  const shipping = subtotal > 0 && subtotal < 50000 ? 5000 : 0; // Example shipping rule
  const total = subtotal + shipping;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] transition-opacity" 
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-[100] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Tu Carrito</h2>
            <span className="bg-primary text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
          <button 
            onClick={closeCart}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6">
              <div className="w-40 h-40 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-20 h-20 text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tu carrito está vacío</h3>
                <p className="text-slate-500">Parece que aún no has añadido nada.</p>
              </div>
              <button 
                onClick={closeCart}
                className="mt-4 px-8 py-4 bg-primary text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                Explorar perfumes <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {items.map((item) => (
                <div key={`${item.product.id}-${item.variantId}`} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl relative group">
                  {/* Delete Button */}
                  <button 
                    onClick={() => removeItem(item.product.id, item.variantId)}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-white dark:bg-slate-900 flex-shrink-0">
                    <img 
                      src={parseImageUrl(item.product.imageUrls?.[0])} 
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
                        {item.product.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 capitalize">
                        {item.size !== 'Único' && `Talle: ${item.size}`}
                        {item.size !== 'Único' && item.color !== 'Único' && ' | '}
                        {item.color !== 'Único' && `Color: ${item.color}`}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-9">
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.variantId, Math.max(1, item.quantity - 1))}
                          className="w-9 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.variantId, item.quantity + 1)}
                          className="w-9 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-primary">
                          ${(item.quantity >= minWholesaleQty ? (item.product.salePrice || 0) * (1 - wholesaleDiscountPrc / 100) : (item.product.salePrice || 0)).toLocaleString('es-AR')}
                        </span>
                        {item.quantity >= minWholesaleQty && (
                          <span className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider mt-0.5">
                            Mayorista
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-3 mb-6 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-white">${subtotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-AR')}`}
                </span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-4" />
              <div className="flex justify-between text-base">
                <span className="font-black text-slate-900 dark:text-white">Total</span>
                <span className="font-black text-primary text-xl">${total.toLocaleString('es-AR')}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Link 
                href="/checkout"
                onClick={closeCart}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-center font-black rounded-xl hover:scale-[1.02] transition-transform shadow-xl shadow-slate-900/10 dark:shadow-white/10"
              >
                Finalizar Compra
              </Link>
              <button 
                onClick={closeCart}
                className="w-full py-3 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors"
              >
                Seguir comprando
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
