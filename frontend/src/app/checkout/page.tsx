'use client';

import { useCartStore } from '@/store/useCartStore';
import { useStockFlowStore } from '@/store/useStockStore';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi, API_URL, parseImageUrl } from '@/utils/api';
import Link from 'next/link';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';

export default function CheckoutPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const registerWebSale = useStockFlowStore(s => s.registerWebSale);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const company = useCompanyInfo();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [shippingConfig, setShippingConfig] = useState<{ delivery_enabled: boolean; delivery_cost: number }>({
    delivery_enabled: true,
    delivery_cost: 0,
  });
  const [shippingType, setShippingType] = useState<'delivery' | 'pickup'>('delivery');

  useEffect(() => {
    setMounted(true);
    // Fetch shipping settings
    fetch('/api/settings/shipping_config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.value) {
          try {
            const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            const enabled = val.delivery_enabled ?? true;
            setShippingConfig({
              delivery_enabled: enabled,
              delivery_cost: Number(val.delivery_cost || 0),
            });
            if (!enabled) {
              setShippingType('pickup');
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  if (!mounted) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-5xl text-primary mb-4">lock</span>
          <h2 className="text-xl font-bold dark:text-white mb-2">Inicia sesión para continuar</h2>
          <p className="text-slate-500 mb-6 text-sm">Necesitas tener una cuenta para poder confirmar tu pedido.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  const getItemUnitPrice = (item: any) => {
    const variant = item.product?.variants?.find((v: any) => v.id === item.variantId || (v.size === item.size && v.color === item.color));
    return (variant?.manualSalePrice !== undefined && variant.manualSalePrice > 0) ? variant.manualSalePrice : (item.product?.salePrice || 0);
  };

  const subtotal = items.reduce((acc, item) => acc + (getItemUnitPrice(item) * item.quantity), 0);

  const isUserWholesale = !!(user?.is_wholesale || (user?.wholesale_until && new Date(user.wholesale_until) > new Date()));

  // Wholesale discount calculation
  const totalDiscount = items.reduce((acc, item) => {
    if (isUserWholesale || item.quantity >= wholesaleConfig.minQuantity) {
      const itemSubtotal = getItemUnitPrice(item) * item.quantity;
      return acc + (itemSubtotal * (wholesaleConfig.discountPercentage / 100));
    }
    return acc;
  }, 0);

  const activeShippingCost = shippingType === 'delivery' && shippingConfig.delivery_enabled ? shippingConfig.delivery_cost : 0;
  const total = subtotal - totalDiscount + activeShippingCost;

  const buildWhatsappMessage = (orderItems: typeof items, orderTotal: number) => {
    const lines = orderItems.map(item =>
      `• ${item.product.name} (${item.color ? item.color + ' - ' : ''}${item.size}) x${item.quantity} = $${(getItemUnitPrice(item) * item.quantity).toLocaleString()}`
    );
    const greeting = company.whatsappMsgGreeting || '¡Hola! Quiero confirmar un pedido 🛒';
    const msg = [
      greeting,
      ``,
      `*Cliente:* ${user.name}`,
      `*Teléfono:* ${user.phone}`,
      `*Entrega:* ${shippingType === 'delivery' ? '🚚 Envío a Domicilio' : '🏪 Retiro en Local'}`,
      shippingType === 'delivery' && user.address ? `*Dirección de entrega:* ${user.address}, ${user.city || ''}, ${user.province || ''} (CP: ${user.postal_code || '-'})` : '',
      ``,
      `*Productos:*`,
      ...lines,
      ``,
      totalDiscount > 0 ? `*Descuento mayorista:* -$${totalDiscount.toLocaleString()}` : '',
      shippingType === 'delivery' ? `*Costo de envío:* ${activeShippingCost === 0 ? 'Gratis' : `$${activeShippingCost.toLocaleString()}`}` : '',
      `*Total: $${orderTotal.toLocaleString()}*`,
      company.whatsappMsgFooter ? `\n${company.whatsappMsgFooter}` : '',
    ].filter(l => l !== null && l !== '').join('\n');
    return encodeURIComponent(msg);
  };

  const rawWhatsapp = (company.whatsapp || '5493704747426').replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${rawWhatsapp}`;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-xl max-w-md w-full text-center flex flex-col items-center">
          <div className="size-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">¡Pedido Confirmado!</h2>
          <p className="text-slate-500 mb-6">Tu pedido fue registrado. Hacé clic en el botón para enviarnos el detalle por WhatsApp y coordinar el pago y entrega.</p>

          <a
            href={`${whatsappUrl}?text=${buildWhatsappMessage(items.length > 0 ? items : [], total)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white font-black text-lg py-4 rounded-xl transition-all shadow-lg shadow-green-200 mb-4"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Enviar pedido por WhatsApp
          </a>

          <Link href="/catalog" className="w-full text-center text-slate-500 hover:text-primary font-bold py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/30 transition-colors text-sm">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (!user?.is_approved) {
      setError("Tu cuenta está pendiente de aprobación por un administrador. No podrás realizar compras hasta que sea aprobada.");
      return;
    }

    if (shippingType === 'delivery' && !user?.address?.trim()) {
      setError("Por favor completa tu dirección en 'Mi Perfil' para solicitar envío a domicilio, o elige 'Retiro en Local'.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const saleItems = items.map(item => ({
        product_id: item.product.id,
        productId: item.product.id,
        variant_id: item.variantId,
        variantId: item.variantId,
        product_name: item.product.name,
        productName: item.product.name,
        variant_info: `${item.color} - ${item.size}`,
        variantInfo: `${item.color} - ${item.size}`,
        size: item.size,
        color: item.color,
        image_url: item.product.imageUrls?.[0] || '',
        imageUrl: item.product.imageUrls?.[0] || '',
        quantity: item.quantity,
        sale_price: getItemUnitPrice(item),
        salePrice: getItemUnitPrice(item)
      }));

      // 1. Create order in Backend
      const token = useAuthStore.getState().token;
      const orderRes = await fetchApi('/api/orders', {
        method: 'POST',
        headers: { 'X-API-KEY': token || '' },
        body: JSON.stringify({
          items: saleItems,
          shipping_type: shippingType,
          shipping_cost: activeShippingCost,
        })
      });

      // 2. Register sale in Frontend Zustand for Admin Panel (retains stock)
      const assignedOrderNumber = orderRes?.order_number;
      registerWebSale(user.name, user.phone, saleItems, assignedOrderNumber);

      clearCart();
      setSuccess(true);

      // 3. Auto redirect to WhatsApp
      if (whatsappUrl) {
        const msg = buildWhatsappMessage(items, total);
        setTimeout(() => {
          window.open(`${whatsappUrl}?text=${msg}`, '_blank');
        }, 800);
      }
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
                  <div className="w-24 h-24 rounded-xl bg-white overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700">
                    {item.product.imageUrls?.[0] ? (
                      <img
                        src={parseImageUrl(item.product.imageUrls[0])}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.style.display = 'none';
                          if (img.parentElement) {
                            img.parentElement.innerHTML = '<span class="material-symbols-outlined text-slate-300 text-4xl flex items-center justify-center h-full w-full">image_not_supported</span>';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-300 text-4xl">image_not_supported</span>
                      </div>
                    )}
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
                        <p className="font-black text-slate-900 dark:text-white">${(getItemUnitPrice(item) * item.quantity).toLocaleString()}</p>
                        <p className="text-xs text-slate-400 font-medium">${getItemUnitPrice(item).toLocaleString()} c/u</p>
                        {(isUserWholesale || item.quantity >= wholesaleConfig.minQuantity) && (
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
            
            {/* Método de Entrega */}
            <div className="mb-6 space-y-3">
              <label className="block text-sm font-bold text-slate-900 dark:text-white">
                ¿Cómo querés recibir tu pedido?
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                {shippingConfig.delivery_enabled && (
                  <button
                    type="button"
                    onClick={() => setShippingType('delivery')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      shippingType === 'delivery'
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${shippingType === 'delivery' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="material-symbols-outlined text-xl">local_shipping</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">Envío a Domicilio</p>
                        <p className="text-[11px] text-slate-500">Entrega en tu dirección</p>
                      </div>
                    </div>
                    <span className="font-bold text-xs text-primary">
                      {shippingConfig.delivery_cost === 0 ? 'Gratis' : `$${shippingConfig.delivery_cost.toLocaleString('es-AR')}`}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShippingType('pickup')}
                  className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    shippingType === 'pickup'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${shippingType === 'pickup' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <span className="material-symbols-outlined text-xl">storefront</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">Retiro en Local</p>
                      <p className="text-[11px] text-slate-500">Coordinamos horario</p>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    Gratis
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mb-6 text-sm">
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
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Envío ({shippingType === 'delivery' ? 'Domicilio' : 'Retiro en Local'})</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {activeShippingCost === 0 ? 'Gratis' : `$${activeShippingCost.toLocaleString('es-AR')}`}
                </span>
              </div>
              <div className="flex justify-between font-black text-slate-900 dark:text-white text-xl pt-4 border-t border-slate-100 dark:border-slate-700 mt-1">
                <span>Total</span>
                <span>${total.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Tus Datos</h3>

              {!user?.is_approved && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-bold flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-sm shrink-0 mt-0.5">schedule</span>
                  Tu cuenta está pendiente de aprobación. No podrás confirmar pedidos hasta que un administrador te dé de alta.
                </div>
              )}
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <p className="text-sm text-slate-500 mt-2">{user.phone}</p>
                {user.address ? (
                  <p className="text-sm text-slate-500 mt-2">
                    {user.address}, {user.city}, {user.province} (CP: {user.postal_code})
                  </p>
                ) : shippingType === 'delivery' ? (
                  <p className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    No tenés dirección registrada para el envío a domicilio.
                  </p>
                ) : null}
                <Link href="/profile" className="text-xs font-bold text-primary hover:underline block mt-3">
                  Modificar datos
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={items.length === 0 || loading || !user?.is_approved}
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
