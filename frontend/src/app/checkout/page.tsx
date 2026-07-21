'use client';

import { useCartStore } from '@/store/useCartStore';
import { useStockFlowStore } from '@/store/useStockStore';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/utils/api';
import Link from 'next/link';

export default function CheckoutPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const registerWebSale = useStockFlowStore(s => s.registerWebSale);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!user) {
    setTimeout(() => {
      import('@/store/useAuthModalStore').then(({ useAuthModalStore }) => {
        useAuthModalStore.getState().openModal('login');
      });
      router.push('/catalog');
    }, 0);
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-xl max-w-md w-full text-center flex flex-col items-center">
          <div className="size-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">¡Pedido Confirmado!</h2>
          <p className="text-slate-500 mb-8">Tu pedido ha sido registrado con éxito. Nos pondremos en contacto contigo pronto para coordinar el pago y envío.</p>
          <Link href="/catalog" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((acc, item) => acc + item.product.salePrice * item.quantity, 0);
  
  // Calculate discounts
  const totalDiscount = items.reduce((acc, item) => {
    if (item.quantity >= wholesaleConfig.minQuantity) {
      return acc + (item.product.salePrice * item.quantity * (wholesaleConfig.discountPercentage / 100));
    }
    return acc;
  }, 0);

  const total = subtotal - totalDiscount;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (!user?.email_verified) {
      setError("Debes verificar tu correo electrónico para poder comprar.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const saleItems = items.map(item => ({
        productId: item.product.id,
        variantId: item.variantId,
        quantity: item.quantity,
        salePrice: item.product.salePrice
      }));

      // 1. Create order in Backend for User History
      const token = useAuthStore.getState().token;
      await fetchApi('/api/orders', {
        method: 'POST',
        headers: { 'X-API-KEY': token || '' },
        body: JSON.stringify({ items: saleItems })
      });

      // 2. Register sale in Frontend Zustand for Admin Panel
      registerWebSale(user.name, user.phone, saleItems);
      
      clearCart();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Error al procesar la compra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Cart Items */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">shopping_cart</span>
              Tu Carrito
            </h1>
            <Link href="/catalog" className="text-sm font-bold text-slate-500 hover:text-primary transition-colors">
              Seguir comprando
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">production_quantity_limits</span>
              <p className="text-slate-500 font-medium">Tu carrito está vacío.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-4 border border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                  <div className="w-24 h-24 rounded-xl bg-white overflow-hidden shrink-0">
                    <img src={item.product.imageUrls?.[0] || 'https://via.placeholder.com/150'} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="font-bold text-slate-900 dark:text-white">{item.product.name}</h3>
                    <p className="text-sm text-slate-500 capitalize">{item.color} - {item.size}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                        <button onClick={() => updateQuantity(item.product.id, item.variantId, Math.max(1, item.quantity - 1))} className="text-slate-400 hover:text-primary font-bold px-1">-</button>
                        <span className="font-bold text-slate-900 dark:text-white w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.variantId, item.quantity + 1)} className="text-slate-400 hover:text-primary font-bold px-1">+</button>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900 dark:text-white">${(item.product.salePrice * item.quantity).toLocaleString()}</p>
                        {item.quantity >= wholesaleConfig.minQuantity && (
                          <p className="text-[10px] font-bold text-green-500 uppercase">-{wholesaleConfig.discountPercentage}% Mayorista aplicado</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.product.id, item.variantId)} className="text-slate-400 hover:text-red-500 p-2 shrink-0">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout Form */}
        <div className="w-full lg:w-96 shrink-0">
          <form onSubmit={handleConfirm} className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 sticky top-8">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6">Resumen de Compra</h2>
            
            <div className="flex flex-col gap-3 mb-8 text-sm">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-green-500 font-bold">
                  <span>Descuento Mayorista</span>
                  <span>-${totalDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 dark:text-white text-xl pt-4 border-t border-slate-100 dark:border-slate-700 mt-2">
                <span>Total</span>
                <span>${total.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Tus Datos</h3>
              
              {!user?.email_verified && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-2">
                  <span className="material-symbols-outlined align-middle mr-1 text-sm">warning</span>
                  Debes verificar tu email para poder comprar.
                </div>
              )}
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-2">
                  {error}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <p className="text-sm text-slate-500 mt-2">{user.phone}</p>
                {user.address && (
                  <p className="text-sm text-slate-500 mt-2">
                    {user.address}, {user.city}, {user.province} (CP: {user.postal_code})
                  </p>
                )}
                <Link href="/profile" className="text-xs font-bold text-primary hover:underline block mt-3">
                  Modificar datos
                </Link>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={items.length === 0 || loading || !user?.email_verified}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black text-lg py-4 rounded-xl transition-all shadow-xl shadow-primary/20"
            >
              {loading ? 'Procesando...' : 'Confirmar Pedido'}
            </button>
            <p className="text-xs text-center text-slate-500 mt-4">Pagarás al momento de coordinar la entrega.</p>
          </form>
        </div>

      </div>
    </div>
  );
}
