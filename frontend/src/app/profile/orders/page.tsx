'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';
import { useStockFlowStore } from '@/store/useStockStore';

export default function ProfileOrdersPage() {
  const token = useAuthStore(s => s.token);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // We need products to show names instead of just IDs
  const products = useStockFlowStore(s => s.products);

  useEffect(() => {
    if (token) {
      fetchApi('/api/orders')
        .then(data => setOrders(data))
        .catch(err => setError(err.message || 'Error cargando compras'))
        .finally(() => setLoading(false));
    }
  }, [token]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pagada': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Pagada</span>;
      case 'Cancelada': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Cancelada</span>;
      default: return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">Pendiente de pago</span>;
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando compras...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Mis Compras</h1>
        <p className="text-slate-500 mt-2">Historial de todos tus pedidos realizados.</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">receipt_long</span>
          <p className="text-slate-500 font-medium mb-4">Aún no has realizado ninguna compra.</p>
          <Link href="/catalog" className="text-primary font-bold hover:underline">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order, idx) => (
            <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Pedido #{order.order_number}</h3>
                  <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-black text-lg">${order.total.toLocaleString()}</span>
                  {getStatusBadge(order.status)}
                </div>
              </div>

              <div className="space-y-3">
                {order.items.map((item: any, i: number) => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0">
                        {product?.imageUrls?.[0] ? (
                          <img src={product.imageUrls[0]} alt="prod" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined w-full h-full flex items-center justify-center text-slate-300">image</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{product?.name || 'Producto Desconocido'}</p>
                        <p className="text-xs text-slate-500">Cantidad: {item.quantity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
