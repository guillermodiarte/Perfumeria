'use client';

import { useState, useEffect } from 'react';
import { fetchApi, API_URL } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';
import { useStockFlowStore } from '@/store/useStockStore';

export default function ProfileOrdersPage() {
  const token = useAuthStore(s => s.token);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'delivered'>('all');
  const [whatsappUrl, setWhatsappUrl] = useState('https://wa.me/5493704747426');

  // Deletion modal state
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Products and action from store
  const products = useStockFlowStore(s => s.products);
  const deleteUserOrder = useStockFlowStore(s => s.deleteUserOrder);

  useEffect(() => {
    if (token) {
      fetchApi('/api/orders')
        .then(data => setOrders(data))
        .catch(err => setError(err.message || 'Error cargando pedidos'))
        .finally(() => setLoading(false));
    }

    // Get WhatsApp number configured in settings
    fetch(`${API_URL}/api/settings/site_header`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.value?.whatsapp) {
          const raw = String(data.value.whatsapp).replace(/[^0-9]/g, '');
          if (raw) setWhatsappUrl(`https://wa.me/${raw}`);
        }
      })
      .catch(() => {});
  }, [token]);

  const normalizeStatus = (order: any) => {
    const s = (order.status || '').toLowerCase();
    const pStatus = (order.payment_status || '').toLowerCase();

    if (s.includes('rechaz') || s.includes('cancel')) {
      return 'rejected';
    }
    if (s.includes('aprob') || s.includes('pagad') || pStatus === 'full' || pStatus === 'partial') {
      return pStatus === 'partial' ? 'approved_partial' : 'approved_full';
    }
    return 'pending';
  };

  const isDelivered = (order: any) => {
    const d = (order.delivery_status || '').toLowerCase();
    const s = (order.status || '').toLowerCase();
    return d === 'delivered' || s.includes('entreg');
  };

  const canDeleteOrder = (order: any) => {
    const norm = normalizeStatus(order);
    const approved = norm === 'approved_full' || norm === 'approved_partial';
    const delivered = isDelivered(order);
    const hasPaid = Number(order.paid_amount || 0) > 0 || order.payment_status === 'full' || order.payment_status === 'partial';
    return !approved && !delivered && !hasPaid;
  };

  const filteredOrders = orders.filter(order => {
    const norm = normalizeStatus(order);
    const delivered = isDelivered(order);

    if (filter === 'pending') return norm === 'pending';
    if (filter === 'approved') return norm === 'approved_full' || norm === 'approved_partial';
    if (filter === 'rejected') return norm === 'rejected';
    if (filter === 'delivered') return delivered;
    return true;
  });

  const getStatusBadge = (order: any) => {
    const norm = normalizeStatus(order);
    const delivered = isDelivered(order);

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {delivered && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-full text-xs font-black uppercase tracking-wider">
            <span className="material-symbols-outlined text-[14px]">local_shipping</span>
            Entregado
          </span>
        )}

        {norm === 'approved_full' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-full text-xs font-black uppercase tracking-wider">
            <span className="size-2 rounded-full bg-green-500"></span>
            Aprobado • Pagado
          </span>
        )}

        {norm === 'approved_partial' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-black uppercase tracking-wider">
            <span className="size-2 rounded-full bg-blue-500"></span>
            Aprobado • Pago Parcial
          </span>
        )}

        {norm === 'rejected' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-full text-xs font-black uppercase tracking-wider">
            <span className="size-2 rounded-full bg-red-500"></span>
            Rechazado
          </span>
        )}

        {norm === 'pending' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-black uppercase tracking-wider">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse"></span>
            En Revisión
          </span>
        )}
      </div>
    );
  };

  const buildWhatsappLink = (order: any) => {
    const norm = normalizeStatus(order);
    const delivered = isDelivered(order);
    let msg = `¡Hola! Me comunico respecto a mi pedido *#${order.order_number}* de Tienda Deportiva y Accesorios.`;
    if (delivered && norm === 'approved_partial' && order.remaining_amount > 0) {
      msg += ` Ya recibí el pedido y deseo coordinar la siguiente cuota / saldo restante de *$${order.remaining_amount.toLocaleString()}*.`;
    } else if (norm === 'approved_partial' && order.remaining_amount > 0) {
      msg += ` Tengo pendiente abonar el saldo de *$${order.remaining_amount.toLocaleString()}*. ¿Cómo coordino el pago restante?`;
    } else if (norm === 'pending') {
      msg += ` Quería consultar el estado de revisión de mi pedido.`;
    }
    return `${whatsappUrl}?text=${encodeURIComponent(msg)}`;
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);

    try {
      await fetchApi(`/api/orders/${orderToDelete.order_number}`, {
        method: 'DELETE',
      });

      // Restore stock in frontend zustand store
      deleteUserOrder(orderToDelete.order_number);

      // Remove from local list
      setOrders(prev => prev.filter(o => o.order_number !== orderToDelete.order_number));

      setNotification({
        type: 'success',
        message: `Pedido #${orderToDelete.order_number} eliminado con éxito. Los artículos retenidos han vuelto al inventario disponible.`,
      });
      setOrderToDelete(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'No se pudo eliminar el pedido.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-medium">Cargando tus pedidos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
        <span className="material-symbols-outlined text-red-500 text-5xl mb-3 block">error</span>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Ocurrió un inconveniente</h3>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between text-sm font-semibold transition-all ${
          notification.type === 'success' 
            ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Page Title & Filter Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
            Mis Pedidos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Revisá el estado de entrega, pagos y productos de todas tus compras.
          </p>
        </div>

        {/* Filters */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl text-xs font-bold w-full sm:w-auto flex-wrap gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 rounded-xl transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500'}`}
          >
            Todos ({orders.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-2 rounded-xl transition-all ${filter === 'pending' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500'}`}
          >
            En Revisión
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 py-2 rounded-xl transition-all ${filter === 'approved' ? 'bg-white dark:bg-slate-800 text-green-600 shadow-sm' : 'text-slate-500'}`}
          >
            Aprobados
          </button>
          <button
            onClick={() => setFilter('delivered')}
            className={`px-3 py-2 rounded-xl transition-all ${filter === 'delivered' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-500'}`}
          >
            Entregados
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-3 py-2 rounded-xl transition-all ${filter === 'rejected' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-sm' : 'text-slate-500'}`}
          >
            Rechazados
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <span className="material-symbols-outlined text-4xl">shopping_basket</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No hay pedidos para mostrar</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            {filter === 'all' 
              ? 'Aún no realizaste ningún pedido en la tienda. ¡Explorá nuestro catálogo de fragancias y belleza!'
              : 'No se encontraron pedidos con el estado seleccionado.'}
          </p>
          <Link 
            href="/catalog" 
            className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            Explorar Catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order, idx) => {
            const norm = normalizeStatus(order);
            const delivered = isDelivered(order);
            const remaining = Number(order.remaining_amount || 0);
            const paid = Number(order.paid_amount || 0);
            const total = Number(order.total || 0);
            const userCanDelete = canDeleteOrder(order);

            return (
              <div 
                key={idx} 
                className="border border-slate-200 dark:border-slate-700 rounded-3xl p-6 hover:shadow-md transition-shadow bg-slate-50/40 dark:bg-slate-900/30 overflow-hidden"
              >
                {/* Header de la tarjeta */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-700">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                        #{order.order_number}
                      </span>
                      {getStatusBadge(order)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(order.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Total, Acciones y WhatsApp */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total</span>
                      <span className="font-black text-xl text-slate-900 dark:text-white">
                        ${total.toLocaleString()}
                      </span>
                    </div>

                    {/* Botón Eliminar Pedido (solo si no fue aprobado ni cobrado) */}
                    {userCanDelete && (
                      <button
                        onClick={() => setOrderToDelete(order)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        title="Eliminar pedido y liberar stock"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Eliminar Pedido
                      </button>
                    )}

                    <a
                      href={buildWhatsappLink(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all shadow-sm flex items-center justify-center"
                      title="Consultar por WhatsApp"
                    >
                      <svg className="size-5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Banner Informativo según Estado y Entrega */}
                <div className="my-4">
                  {/* CASO: ENTREGADO PERO CON DEUDA (CUOTAS) */}
                  {delivered && norm === 'approved_partial' && remaining > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 text-xs text-emerald-950 dark:text-emerald-200">
                        <span className="material-symbols-outlined text-emerald-600 shrink-0 text-xl">local_shipping</span>
                        <div>
                          <strong className="block font-bold mb-0.5 text-sm text-emerald-900 dark:text-emerald-100">
                            ¡Pedido Entregado! • Pago en Cuotas
                          </strong>
                          Tu pedido ya fue entregado por la tienda. Se encuentra activo tu plan de pagos. Podés coordinar las próximas cuotas por WhatsApp.
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-800 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">Abonado</span>
                          <span className="font-bold text-xs text-green-600 dark:text-green-400">
                            ${paid.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="text-right">
                          <span className="text-[10px] text-amber-500 font-bold block uppercase tracking-wider">Saldo Restante</span>
                          <span className="font-black text-base text-amber-600 dark:text-amber-400">
                            ${remaining.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CASO: ENTREGADO Y TOTALMENTE PAGADO */}
                  {delivered && (norm === 'approved_full' || (norm === 'approved_partial' && remaining === 0)) && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-200">
                      <span className="material-symbols-outlined text-emerald-600 shrink-0 text-xl">task_alt</span>
                      <div>
                        <strong className="block font-bold mb-0.5 text-sm text-emerald-950 dark:text-emerald-100">
                          ¡Pedido Entregado y Pagado en su Totalidad!
                        </strong>
                        Este pedido fue entregado y no posee saldo pendiente. ¡Muchas gracias por tu compra!
                      </div>
                    </div>
                  )}

                  {/* CASO: APROBADO PARCIAL PERO AÚN NO ENTREGADO */}
                  {!delivered && norm === 'approved_partial' && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 text-xs text-blue-950 dark:text-blue-200">
                        <span className="material-symbols-outlined text-blue-600 shrink-0 text-lg">info</span>
                        <div>
                          <strong className="block font-bold mb-0.5">Pedido aprobado con pago parcial</strong>
                          Se registró un anticipo o cuota inicial. Coordina el saldo restante antes o durante la entrega.
                        </div>
                      </div>

                      {/* Montos detallados */}
                      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-200/60 dark:border-blue-800 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">Abonado</span>
                          <span className="font-bold text-xs text-green-600 dark:text-green-400">
                            ${paid.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="text-right">
                          <span className="text-[10px] text-amber-500 font-bold block uppercase tracking-wider">Resta abonar</span>
                          <span className="font-black text-base text-amber-600 dark:text-amber-400">
                            ${remaining.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CASO: APROBADO TOTAL PERO AÚN NO ENTREGADO */}
                  {!delivered && norm === 'approved_full' && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-green-900 dark:text-green-200">
                      <span className="material-symbols-outlined text-green-600 shrink-0 text-lg">task_alt</span>
                      <div>
                        <strong className="block font-bold mb-0.5">¡Pedido y pago 100% confirmados!</strong>
                        El pago total fue registrado correctamente. Nos pondremos en contacto para coordinar la entrega o envío.
                      </div>
                    </div>
                  )}

                  {/* CASO: PENDIENTE EN REVISIÓN */}
                  {norm === 'pending' && !delivered && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                      <span className="material-symbols-outlined text-amber-600 shrink-0 text-lg">hourglass_top</span>
                      <div>
                        <strong className="block font-bold mb-0.5">Pedido en revisión</strong>
                        Tu pedido está siendo procesado por el equipo de Tienda Deportiva y Accesorios. <span className="underline font-semibold">El stock de tus productos se encuentra retenido y reservado para vos</span> hasta que sea aprobado o coordinemos el pago.
                      </div>
                    </div>
                  )}

                  {/* CASO: RECHAZADO */}
                  {norm === 'rejected' && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-red-900 dark:text-red-200">
                      <span className="material-symbols-outlined text-red-600 shrink-0 text-lg">cancel</span>
                      <div>
                        <strong className="block font-bold mb-0.5">Pedido rechazado</strong>
                        Este pedido fue cancelado y los artículos correspondientes han regresado al stock disponible de la tienda.
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de Productos del Pedido */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Artículos en el pedido ({order.items.reduce((sum: number, i: any) => sum + i.quantity, 0)})
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {order.items.map((item: any, i: number) => {
                      const fallbackProd = products.find(p => p.id === item.product_id);
                      const displayName = item.product_name || fallbackProd?.name || 'Producto';
                      const displayImg = item.image_url || fallbackProd?.imageUrls?.[0] || '';
                      const displayVariant = item.variant_info || '';

                      return (
                        <div 
                          key={i} 
                          className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80"
                        >
                          <div className="size-14 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            {displayImg ? (
                              <img src={displayImg} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-slate-300">image</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate" title={displayName}>
                              {displayName}
                            </p>
                            {displayVariant && (
                              <p className="text-xs text-slate-500 capitalize">{displayVariant}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5 font-medium">
                              {item.quantity} x ${(item.price || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-slate-800 dark:text-white">
                              ${((item.price || 0) * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer de la tarjeta con notas si existen */}
                {order.admin_notes && (
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700 text-xs text-slate-500">
                    <strong className="text-slate-700 dark:text-slate-300">Nota de la tienda:</strong> {order.admin_notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR PEDIDO */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            {/* Header del modal */}
            <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700">
              <div className="size-10 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">¿Eliminar este pedido?</h3>
                <p className="text-xs text-slate-400">Pedido #{orderToDelete.order_number}</p>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Si realizaste este pedido por error o deseas cancelarlo, podés eliminarlo. 
              </p>
              
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 shrink-0 text-base mt-0.5">inventory_2</span>
                <div>
                  <strong className="block font-bold mb-0.5">Liberación de stock</strong>
                  Los productos que se encontraban retenidos volverán automáticamente al inventario disponible de la tienda para que otros clientes puedan adquirirlos.
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Artículos:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {orderToDelete.items?.length || 0} prod. ({orderToDelete.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0} unid.)
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Monto Total:</span>
                  <span className="font-black text-slate-900 dark:text-white">
                    ${Number(orderToDelete.total || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                No, mantener
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    <span>Sí, eliminar pedido</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
