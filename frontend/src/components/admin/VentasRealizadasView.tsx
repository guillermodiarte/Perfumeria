'use client';
import { useState, useEffect, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';
import { API_URL } from '@/utils/api';

interface VentasRealizadasViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
}

export default function VentasRealizadasView({ apiKey, showAlert }: VentasRealizadasViewProps) {
  // --- Zustand store (for in-person / POS sales) ---
  const sales = useStockFlowStore(s => s.sales);
  const approveOrderTicket = useStockFlowStore(s => s.approveOrderTicket);
  const rejectOrderTicket = useStockFlowStore(s => s.rejectOrderTicket);
  const updateOrderDeliveryStatus = useStockFlowStore(s => s.updateOrderDeliveryStatus);
  const updateOrderDetailsAdmin = useStockFlowStore(s => s.updateOrderDetailsAdmin);

  // --- Backend web orders ---
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pendiente' | 'Pagada' | 'Cancelada'>('all');
  const [viewMode, setViewMode] = useState<'web' | 'pos'>('web');

  // Approval Modal State
  const [ticketToApprove, setTicketToApprove] = useState<any | null>(null);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Rejection Confirm State
  const [ticketToReject, setTicketToReject] = useState<any | null>(null);

  // Detail Modal State
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);

  // Edit Modal State
  const [ticketToEdit, setTicketToEdit] = useState<any | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDeliveryStatus, setEditDeliveryStatus] = useState<'pending' | 'delivered'>('pending');

  // Delete Confirm State (admin deletes web order)
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);

  // --- Fetch web orders from backend ---
  const getToken = () => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') : '');

  const fetchWebOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoadingWeb(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/all`, {
        headers: { 'X-API-KEY': token }
      });
      if (res.ok) {
        const data = await res.json();
        setWebOrders(data);
      }
    } catch (e) {
      console.warn('Could not fetch web orders:', e);
    } finally {
      setLoadingWeb(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchWebOrders();
  }, [fetchWebOrders]);

  // --- Normalize web order status ---
  const normalizeWebStatus = (order: any): 'Pendiente' | 'Pagada' | 'Cancelada' => {
    const s = (order.status || '').toLowerCase();
    const p = (order.payment_status || '').toLowerCase();
    if (s.includes('rechaz') || s.includes('cancel')) return 'Cancelada';
    if (s.includes('aprob') || s.includes('pagad') || p === 'full' || p === 'partial') return 'Pagada';
    return 'Pendiente';
  };

  // --- Filtered WEB orders ---
  const filteredWebOrders = webOrders.filter(o => {
    const term = searchTerm.toLowerCase();
    const name = (o.customer?.name || '').toLowerCase();
    const phone = (o.customer?.phone || '').toLowerCase();
    const num = (o.order_number || '').toLowerCase();
    const matchesTerm = name.includes(term) || phone.includes(term) || num.includes(term);
    if (!matchesTerm) return false;
    if (filterStatus === 'all') return true;
    return normalizeWebStatus(o) === filterStatus;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // --- POS sales (Zustand) ---
  const filteredSales = sales.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      s.productName.toLowerCase().includes(term) ||
      s.clientName.toLowerCase().includes(term) ||
      (s.clientPhone && s.clientPhone.toLowerCase().includes(term)) ||
      (s.ticketId && s.ticketId.toLowerCase().includes(term)) ||
      s.id.toLowerCase().includes(term)
    );
  });

  const groupedTickets = Object.values(filteredSales.reduce((acc, sale) => {
    const tId = sale.ticketId || `TICK-${sale.id.toUpperCase()}`;
    if (!acc[tId]) {
      acc[tId] = {
        ticketId: tId,
        date: sale.date,
        clientName: sale.clientName,
        clientPhone: sale.clientPhone,
        itemsCount: 0,
        total: 0,
        paidAmount: sale.paidAmount ?? (sale.status === 'Pagada' ? sale.revenue : 0),
        remainingAmount: sale.remainingAmount ?? (sale.status === 'Pagada' ? 0 : sale.revenue),
        paymentStatus: sale.paymentStatus || (sale.status === 'Pagada' ? 'full' : 'pending'),
        status: sale.status || 'Pagada',
        items: [] as any[]
      };
    }
    acc[tId].itemsCount += sale.quantity;
    acc[tId].total += sale.revenue;
    acc[tId].items.push(sale);
    return acc;
  }, {} as Record<string, any>))
    .filter((t: any) => {
      if (filterStatus === 'all') return true;
      return t.status === filterStatus;
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // =================== HANDLERS ===================

  // APPROVE web order
  const handleOpenApproveModal = (ticket: any) => {
    setTicketToApprove(ticket);
    setPaymentType('full');
    setPartialAmount(ticket.total.toString());
    setAdminNotes('');
  };

  const handleConfirmApprove = async () => {
    if (!ticketToApprove) return;
    setProcessing(true);

    const isPartial = paymentType === 'partial';
    const paid = isPartial ? Math.max(0, Math.min(ticketToApprove.total, parseFloat(partialAmount) || 0)) : ticketToApprove.total;
    const paymentStatus = isPartial && paid < ticketToApprove.total ? 'partial' : 'full';

    try {
      if (viewMode === 'web') {
        // Backend-first for web orders
        const token = getToken();
        const res = await fetch(`${API_URL}/api/orders/admin/${ticketToApprove.order_number}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': token! },
          body: JSON.stringify({
            status: 'Aprobado',
            payment_status: paymentStatus,
            paid_amount: paid,
            admin_notes: adminNotes || undefined
          })
        });
        if (!res.ok) throw new Error('Error al aprobar pedido en el servidor');
        await fetchWebOrders();
      } else {
        // POS: Zustand first, then sync
        approveOrderTicket(ticketToApprove.ticketId, paid, paymentStatus);
        const token = getToken();
        if (token) {
          await fetch(`${API_URL}/api/orders/admin/${ticketToApprove.ticketId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': token },
            body: JSON.stringify({ status: 'Aprobado', payment_status: paymentStatus, paid_amount: paid, admin_notes: adminNotes || undefined })
          }).catch(err => console.warn('Could not sync to backend:', err));
        }
      }

      if (showAlert) {
        showAlert(`Pedido #${ticketToApprove.order_number || ticketToApprove.ticketId} aprobado.${paymentStatus === 'partial' ? ` Saldo: $${(ticketToApprove.total - paid).toLocaleString()}` : ''}`);
      }
      setTicketToApprove(null);
    } catch (e: any) {
      if (showAlert) showAlert(e.message || 'Error al aprobar pedido');
    } finally {
      setProcessing(false);
    }
  };

  // REJECT
  const handleConfirmReject = async () => {
    if (!ticketToReject) return;
    setProcessing(true);

    try {
      if (viewMode === 'web') {
        const token = getToken();
        const res = await fetch(`${API_URL}/api/orders/admin/${ticketToReject.order_number}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': token! },
          body: JSON.stringify({ status: 'Rechazado', payment_status: 'pending', paid_amount: 0 })
        });
        if (!res.ok) throw new Error('Error al rechazar pedido en el servidor');
        await fetchWebOrders();
      } else {
        rejectOrderTicket(ticketToReject.ticketId);
        const token = getToken();
        if (token) {
          await fetch(`${API_URL}/api/orders/admin/${ticketToReject.ticketId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': token },
            body: JSON.stringify({ status: 'Rechazado', payment_status: 'pending', paid_amount: 0 })
          }).catch(err => console.warn('Could not sync rejection to backend:', err));
        }
      }

      if (showAlert) {
        showAlert(`Pedido #${ticketToReject.order_number || ticketToReject.ticketId} rechazado. Los productos volvieron al inventario disponible.`);
      }
      setTicketToReject(null);
    } catch (e: any) {
      if (showAlert) showAlert(e.message || 'Error al rechazar pedido');
    } finally {
      setProcessing(false);
    }
  };

  // EDIT
  const handleOpenEditModal = (ticket: any) => {
    setTicketToEdit(ticket);
    const paid = viewMode === 'web' ? Number(ticket.paid_amount || 0) : (ticket.paidAmount ?? ticket.total);
    setEditPaidAmount(paid.toString());
    setEditNotes(viewMode === 'web' ? (ticket.admin_notes || '') : (ticket.items?.[0]?.adminNotes || ''));
    setEditDeliveryStatus(
      viewMode === 'web'
        ? ((ticket.delivery_status || 'pending') as 'pending' | 'delivered')
        : (ticket.items?.[0]?.deliveryStatus || 'pending')
    );
  };

  const handleConfirmEdit = async () => {
    if (!ticketToEdit) return;
    setProcessing(true);
    const paid = Math.max(0, Math.min(ticketToEdit.total, parseFloat(editPaidAmount) || 0));
    const remaining = Math.max(0, ticketToEdit.total - paid);
    const newPaymentStatus = remaining <= 0 ? 'full' : 'partial';

    try {
      if (viewMode === 'web') {
        const token = getToken();
        const res = await fetch(`${API_URL}/api/orders/admin/${ticketToEdit.order_number}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': token! },
          body: JSON.stringify({
            status: 'Aprobado',
            payment_status: newPaymentStatus,
            paid_amount: paid,
            delivery_status: editDeliveryStatus,
            admin_notes: editNotes || undefined
          })
        });
        if (!res.ok) throw new Error('Error al guardar cambios');
        await fetchWebOrders();
      } else {
        updateOrderDetailsAdmin(ticketToEdit.ticketId, {
          paymentStatus: newPaymentStatus,
          deliveryStatus: editDeliveryStatus,
          paidAmount: paid,
          adminNotes: editNotes || undefined,
        });
        const token = getToken();
        if (token) {
          await fetch(`${API_URL}/api/orders/admin/${ticketToEdit.ticketId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': token },
            body: JSON.stringify({ payment_status: newPaymentStatus, paid_amount: paid, delivery_status: editDeliveryStatus, admin_notes: editNotes || undefined })
          }).catch(err => console.warn('Could not sync edit to backend:', err));
        }
      }

      if (showAlert) showAlert(`Pedido #${ticketToEdit.order_number || ticketToEdit.ticketId} actualizado.`);
      setTicketToEdit(null);
    } catch (e: any) {
      if (showAlert) showAlert(e.message || 'Error al editar pedido');
    } finally {
      setProcessing(false);
    }
  };

  // TOGGLE DELIVERED
  const handleToggleDelivered = async (ticket: any) => {
    if (viewMode === 'web') {
      const newStatus = (ticket.delivery_status || 'pending') === 'delivered' ? 'pending' : 'delivered';
      const token = getToken();
      if (token) {
        await fetch(`${API_URL}/api/orders/admin/${ticket.order_number}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': token },
          body: JSON.stringify({ delivery_status: newStatus })
        }).catch(err => console.warn('Could not sync delivery status:', err));
      }
      await fetchWebOrders();
      if (showAlert) showAlert(`Pedido #${ticket.order_number} marcado como ${newStatus === 'delivered' ? 'Entregado' : 'Pendiente de entrega'}.`);
    } else {
      const newStatus = (ticket.items?.[0]?.deliveryStatus || 'pending') === 'delivered' ? 'pending' : 'delivered';
      updateOrderDeliveryStatus(ticket.ticketId, newStatus);
      if (showAlert) showAlert(`Pedido #${ticket.ticketId} marcado como ${newStatus === 'delivered' ? 'Entregado' : 'Pendiente de entrega'}.`);
    }
  };

  // DELETE web order (admin)
  const handleConfirmDeleteWebOrder = async () => {
    if (!orderToDelete) return;
    setProcessing(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToDelete.order_number}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': token! }
      });
      if (!res.ok) throw new Error('No se pudo eliminar el pedido.');
      await fetchWebOrders();
      if (showAlert) showAlert(`Pedido #${orderToDelete.order_number} eliminado por el administrador.`);
      setOrderToDelete(null);
    } catch (e: any) {
      if (showAlert) showAlert(e.message || 'Error al eliminar pedido');
    } finally {
      setProcessing(false);
    }
  };

  // =================== STATUS HELPERS ===================
  const getWebStatusBadge = (order: any) => {
    const norm = normalizeWebStatus(order);
    const isPaidFull = order.payment_status === 'full';
    const isPaidPartial = order.payment_status === 'partial';
    const isDelivered = order.delivery_status === 'delivered';

    return (
      <div className="inline-flex flex-col items-center gap-1">
        {norm === 'Pendiente' && (
          <div className="inline-flex flex-col items-center">
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-[11px] font-bold tracking-wider flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              En Revisión
            </span>
            <span className="text-[9px] text-slate-400 mt-0.5 font-medium">Stock Retenido</span>
          </div>
        )}
        {norm === 'Pagada' && isPaidFull && (
          <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[11px] font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">check_circle</span>
            Aprobado (Total)
          </span>
        )}
        {norm === 'Pagada' && isPaidPartial && (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-[11px] font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">payments</span>
            Aprobado (Parcial)
          </span>
        )}
        {norm === 'Cancelada' && (
          <div className="inline-flex flex-col items-center">
            <span className="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[11px] font-bold">
              Rechazado
            </span>
          </div>
        )}
        {norm === 'Pagada' && (
          isDelivered ? (
            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 rounded-full text-[10px] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[11px]">local_shipping</span>
              Entregado
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-full text-[10px] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[11px]">inventory_2</span>
              Sin entregar
            </span>
          )
        )}
      </div>
    );
  };

  // =================== RENDER ===================
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col min-h-[500px]">
      
      {/* Header & Controls */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
            Ventas y Pedidos Realizados
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gestiona la aprobación de pedidos web, pagos totales o parciales, y control de stock retenido.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* View Mode Toggle: Web Orders vs POS */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('web')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'web' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500'}`}
            >
              <span className="material-symbols-outlined text-[15px]">language</span>
              Pedidos Web
            </button>
            <button
              onClick={() => setViewMode('pos')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'pos' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500'}`}
            >
              <span className="material-symbols-outlined text-[15px]">store</span>
              Mostrador
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full sm:w-auto text-xs font-bold">
            <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500'}`}>Todos</button>
            <button onClick={() => setFilterStatus('Pendiente')} className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'Pendiente' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500'}`}>En Revisión</button>
            <button onClick={() => setFilterStatus('Pagada')} className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'Pagada' ? 'bg-white dark:bg-slate-800 text-green-600 shadow-sm' : 'text-slate-500'}`}>Aprobados</button>
            <button onClick={() => setFilterStatus('Cancelada')} className={`px-3 py-1.5 rounded-lg transition-all ${filterStatus === 'Cancelada' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-sm' : 'text-slate-500'}`}>Rechazados</button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input 
              type="text" 
              placeholder="Buscar pedido, cliente..." 
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white font-medium text-xs"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Refresh button (web orders) */}
          {viewMode === 'web' && (
            <button
              onClick={fetchWebOrders}
              disabled={loadingWeb}
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              title="Recargar pedidos web"
            >
              <span className={`material-symbols-outlined text-[20px] ${loadingWeb ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* ========== WEB ORDERS TABLE ========== */}
      {viewMode === 'web' && (
        <div className="flex-1 overflow-x-auto">
          {loadingWeb ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Cargando pedidos web...</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 uppercase tracking-widest">
                  <th className="pb-3 font-bold">Fecha / Hora</th>
                  <th className="pb-3 font-bold">N° Pedido</th>
                  <th className="pb-3 font-bold">Cliente</th>
                  <th className="pb-3 font-bold text-center">Artículos</th>
                  <th className="pb-3 font-bold text-right">Total</th>
                  <th className="pb-3 font-bold text-center">Estado</th>
                  <th className="pb-3 font-bold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredWebOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                        <p>No se encontraron pedidos con esos criterios.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredWebOrders.map((order, idx) => {
                  const norm = normalizeWebStatus(order);
                  const isPending = norm === 'Pendiente';
                  const isApproved = norm === 'Pagada';
                  const isDelivered = order.delivery_status === 'delivered';
                  const total = Number(order.total || 0);
                  const paid = Number(order.paid_amount || 0);
                  const remaining = Math.max(0, total - paid);
                  const isPartial = isApproved && order.payment_status === 'partial' && remaining > 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-4 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {new Date(order.created_at).toLocaleDateString('es-AR')} {new Date(order.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        <button
                          onClick={() => setTicketDetail({ ...order, ticketId: order.order_number, clientName: order.customer?.name, clientPhone: order.customer?.phone, items: order.items.map((i: any) => ({ ...i, productName: i.product_name, productImageUrl: i.image_url, unitSalePrice: i.price, revenue: i.price * i.quantity })) })}
                          className="hover:text-primary underline flex items-center gap-1"
                          title="Ver detalle"
                        >
                          <span>{order.order_number}</span>
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                        </button>
                      </td>
                      <td className="py-4">
                        <p className="font-bold text-slate-800 dark:text-white text-xs">{order.customer?.name || 'Cliente'}</p>
                        {order.customer?.phone && (
                          <a href={`https://wa.me/${order.customer.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-green-600 hover:underline flex items-center gap-1 font-mono">
                            <span className="material-symbols-outlined text-[12px]">chat</span>
                            {order.customer.phone}
                          </a>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        <button
                          onClick={() => setTicketDetail({ ...order, ticketId: order.order_number, clientName: order.customer?.name, clientPhone: order.customer?.phone, items: order.items.map((i: any) => ({ ...i, productName: i.product_name, productImageUrl: i.image_url, unitSalePrice: i.price, revenue: i.price * i.quantity })), total })}
                          className="inline-flex items-center justify-center bg-slate-100 hover:bg-primary/10 hover:text-primary dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded-lg text-xs transition-colors"
                          title="Click para ver artículos"
                        >
                          {order.items.reduce((s: number, i: any) => s + i.quantity, 0)} arts.
                        </button>
                      </td>
                      <td className="py-4 text-right">
                        <p className="font-black text-slate-800 dark:text-white">${total.toLocaleString()}</p>
                        {isPartial && (
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Resta: ${remaining.toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        {getWebStatusBadge(order)}
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleOpenApproveModal({ ...order, total })}
                                className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                title="Aprobar pedido"
                              >
                                <span className="material-symbols-outlined text-[15px]">done_all</span>
                                Aprobar
                              </button>
                              <button
                                onClick={() => setTicketToReject(order)}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all border border-red-200 dark:border-red-800 flex items-center gap-1"
                                title="Rechazar pedido"
                              >
                                <span className="material-symbols-outlined text-[15px]">close</span>
                                Rechazar
                              </button>
                              {/* Allow admin to delete a pending web order */}
                              <button
                                onClick={() => setOrderToDelete(order)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                title="Eliminar pedido"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {isApproved && (
                                <button
                                  onClick={() => handleToggleDelivered(order)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isDelivered
                                      ? 'text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20'
                                      : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:text-slate-400 dark:hover:bg-teal-900/20'
                                  }`}
                                  title={isDelivered ? 'Marcar como no entregado' : 'Marcar como Entregado'}
                                >
                                  <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                </button>
                              )}
                              {isApproved && (
                                <button
                                  onClick={() => handleOpenEditModal(order)}
                                  className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Editar pedido"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                              )}
                              {/* Admin can always delete any web order */}
                              <button
                                onClick={() => setOrderToDelete(order)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                title="Eliminar pedido (admin)"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ========== POS SALES TABLE ========== */}
      {viewMode === 'pos' && (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 uppercase tracking-widest">
                <th className="pb-3 font-bold">Fecha / Hora</th>
                <th className="pb-3 font-bold">Pedido / Ticket</th>
                <th className="pb-3 font-bold">Cliente</th>
                <th className="pb-3 font-bold text-center">Artículos</th>
                <th className="pb-3 font-bold text-right">Total</th>
                <th className="pb-3 font-bold text-center">Estado del Pedido</th>
                <th className="pb-3 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50 dark:divide-slate-800/50">
              {groupedTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                      <p>No se encontraron ventas de mostrador con esos criterios.</p>
                    </div>
                  </td>
                </tr>
              ) : groupedTickets.map((t: any, idx: number) => {
                const isPartial = t.status === 'Pagada' && t.paymentStatus === 'partial' && (t.remainingAmount > 0);
                const deliveryStatus = t.items?.[0]?.deliveryStatus || 'pending';
                const isDelivered = deliveryStatus === 'delivered';
                return (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {new Date(t.date).toLocaleDateString('es-AR')} {new Date(t.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      <button onClick={() => setTicketDetail(t)} className="hover:text-primary underline flex items-center gap-1" title="Ver detalle">
                        <span>{t.ticketId}</span>
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                      </button>
                    </td>
                    <td className="py-4">
                      <p className="font-bold text-slate-800 dark:text-white text-xs">{t.clientName || 'Consumidor Final'}</p>
                      {t.clientPhone && (
                        <a href={`https://wa.me/${t.clientPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-green-600 hover:underline flex items-center gap-1 font-mono">
                          <span className="material-symbols-outlined text-[12px]">chat</span>
                          {t.clientPhone}
                        </a>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      <button onClick={() => setTicketDetail(t)} className="inline-flex items-center justify-center bg-slate-100 hover:bg-primary/10 hover:text-primary dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded-lg text-xs transition-colors">
                        {t.itemsCount} {t.itemsCount === 1 ? 'art.' : 'arts.'}
                      </button>
                    </td>
                    <td className="py-4 text-right">
                      <p className="font-black text-slate-800 dark:text-white">${t.total.toLocaleString()}</p>
                      {isPartial && <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Resta: ${t.remainingAmount.toLocaleString()}</p>}
                    </td>
                    <td className="py-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        {t.status === 'Pendiente' && (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-[11px] font-bold tracking-wider flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              En Revisión
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5 font-medium">Stock Retenido</span>
                          </div>
                        )}
                        {t.status === 'Pagada' && !isPartial && (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[11px] font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            Aprobado (Total)
                          </span>
                        )}
                        {isPartial && (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-[11px] font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">payments</span>
                            Aprobado (Parcial)
                          </span>
                        )}
                        {t.status === 'Cancelada' && (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[11px] font-bold">Rechazado</span>
                            <span className="text-[9px] text-slate-400 mt-0.5 font-medium">Stock Devuelto</span>
                          </div>
                        )}
                        {t.status === 'Pagada' && (
                          isDelivered ? (
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">local_shipping</span>Entregado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">inventory_2</span>Sin entregar
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {t.status === 'Pendiente' ? (
                          <>
                            <button onClick={() => handleOpenApproveModal(t)} className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">done_all</span>Aprobar
                            </button>
                            <button onClick={() => setTicketToReject(t)} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all border border-red-200 dark:border-red-800 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">close</span>Rechazar
                            </button>
                          </>
                        ) : (
                          <>
                            {t.status === 'Pagada' && (
                              <button onClick={() => handleToggleDelivered(t)} className={`p-1.5 rounded-lg transition-colors ${isDelivered ? 'text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:text-slate-400 dark:hover:bg-teal-900/20'}`} title={isDelivered ? 'Marcar como no entregado' : 'Marcar como Entregado'}>
                                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                              </button>
                            )}
                            {t.status === 'Pagada' && (
                              <button onClick={() => handleOpenEditModal(t)} className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Editar pedido">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                            )}
                            <button onClick={() => generateTicketPDF(t.ticketId, sales, true)} className="p-1.5 text-slate-600 hover:text-primary hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Imprimir Ticket">
                              <span className="material-symbols-outlined text-[18px]">print</span>
                            </button>
                            <button onClick={() => generateTicketPDF(t.ticketId, sales, false)} className="p-1.5 text-slate-600 hover:text-primary hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Descargar PDF">
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Footer Total */}
      {viewMode === 'web' && filteredWebOrders.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
          <p className="text-xs text-slate-400 font-medium">Mostrando {filteredWebOrders.length} pedidos web filtrados</p>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl px-5 py-2.5 flex items-center gap-4 border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total en vista</span>
            <span className="text-xl font-black text-primary">
              ${filteredWebOrders.reduce((acc, o) => acc + Number(o.total || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
      {viewMode === 'pos' && groupedTickets.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
          <p className="text-xs text-slate-400 font-medium">Mostrando {groupedTickets.length} ventas de mostrador</p>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl px-5 py-2.5 flex items-center gap-4 border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total en vista</span>
            <span className="text-xl font-black text-primary">
              ${groupedTickets.reduce((acc: number, t: any) => acc + t.total, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* MODAL: APROBAR PEDIDO */}
      {ticketToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                  <span className="material-symbols-outlined">verified</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Aprobar Pedido</h3>
                  <p className="text-xs text-slate-400 font-mono">#{ticketToApprove.order_number || ticketToApprove.ticketId}</p>
                </div>
              </div>
              <button onClick={() => setTicketToApprove(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{ticketToApprove.customer?.name || ticketToApprove.clientName}</span>
                </div>
                {(ticketToApprove.customer?.phone || ticketToApprove.clientPhone) && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Teléfono:</span>
                    <span className="font-mono text-slate-800 dark:text-white">{ticketToApprove.customer?.phone || ticketToApprove.clientPhone}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Total a abonar:</span>
                  <span className="font-black text-primary text-base">${ticketToApprove.total.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Tipo de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setPaymentType('full'); setPartialAmount(ticketToApprove.total.toString()); }}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${paymentType === 'full' ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20 ring-2 ring-green-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">Pago Completo</span>
                      <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Abona el 100% (${ticketToApprove.total.toLocaleString()})</span>
                  </button>
                  <button type="button" onClick={() => { setPaymentType('partial'); setPartialAmount((ticketToApprove.total / 2).toString()); }}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${paymentType === 'partial' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">Pago Parcial</span>
                      <span className="material-symbols-outlined text-blue-600 text-lg">payments</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Seña o anticipo pactado</span>
                  </button>
                </div>
              </div>

              {paymentType === 'partial' && (
                <div className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Abonado ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                      <input type="number" min="1" max={ticketToApprove.total} step="100" value={partialAmount} onChange={e => setPartialAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white" />
                    </div>
                  </div>
                  {(() => {
                    const paid = parseFloat(partialAmount) || 0;
                    const rest = Math.max(0, ticketToApprove.total - paid);
                    return (
                      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <span className="text-xs font-bold text-slate-500">Monto restante a abonar:</span>
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400">${rest.toLocaleString()}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas de Pago / Envío <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input type="text" value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Ej: Seña recibida por transferencia bancaria"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button type="button" onClick={() => setTicketToApprove(null)} disabled={processing} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button type="button" onClick={handleConfirmApprove} disabled={processing}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-green-500/20 flex items-center gap-2">
                {processing ? 'Procesando...' : 'Confirmar y Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR RECHAZO */}
      {ticketToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden p-6 text-center">
            <div className="size-14 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">assignment_return</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              ¿Rechazar Pedido #{ticketToReject.order_number || ticketToReject.ticketId}?
            </h3>
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
              Al rechazar el pedido, <strong className="text-slate-700 dark:text-slate-200">los productos retenidos regresarán automáticamente al inventario</strong>.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-left mb-6 space-y-1">
              <p><strong className="text-slate-700 dark:text-slate-300">Cliente:</strong> {ticketToReject.customer?.name || ticketToReject.clientName}</p>
              <p><strong className="text-slate-700 dark:text-slate-300">Total:</strong> ${Number(ticketToReject.total).toLocaleString()}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => setTicketToReject(null)} disabled={processing}
                className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-colors">Volver</button>
              <button type="button" onClick={handleConfirmReject} disabled={processing}
                className="flex-1 py-3 rounded-xl text-xs font-black text-white bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
                {processing ? 'Procesando...' : 'Sí, Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PEDIDO (ADMIN) */}
      {ticketToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">edit_note</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Editar Pedido</h3>
                  <p className="text-xs text-slate-400 font-mono">#{ticketToEdit.order_number || ticketToEdit.ticketId} • {ticketToEdit.customer?.name || ticketToEdit.clientName}</p>
                </div>
              </div>
              <button onClick={() => setTicketToEdit(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Monto Abonado ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input type="number" min="0" max={ticketToEdit.total} step="100" value={editPaidAmount} onChange={e => setEditPaidAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-base outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white" />
                </div>
                {(() => {
                  const paid = parseFloat(editPaidAmount) || 0;
                  const rest = Math.max(0, Number(ticketToEdit.total) - paid);
                  return rest > 0
                    ? <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1.5">Saldo restante: ${rest.toLocaleString()}</p>
                    : <p className="text-xs text-green-600 font-bold mt-1.5">✓ Pago completo</p>;
                })()}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Estado de Entrega</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setEditDeliveryStatus('pending')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${editDeliveryStatus === 'pending' ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/40 ring-2 ring-slate-400/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">Sin Entregar</span>
                      <span className="material-symbols-outlined text-slate-500 text-lg">inventory_2</span>
                    </div>
                    <span className="text-[11px] text-slate-500">El pedido aún no fue entregado</span>
                  </button>
                  <button type="button" onClick={() => setEditDeliveryStatus('delivered')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${editDeliveryStatus === 'delivered' ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/20 ring-2 ring-teal-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">Entregado</span>
                      <span className="material-symbols-outlined text-teal-600 text-lg">local_shipping</span>
                    </div>
                    <span className="text-[11px] text-slate-500">El cliente ya recibió el pedido</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notas internas <span className="text-slate-400 font-normal">(Opcional)</span></label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                  placeholder="Ej: Resto de pago a confirmar la próxima semana"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button type="button" onClick={() => setTicketToEdit(null)} disabled={processing} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button type="button" onClick={handleConfirmEdit} disabled={processing}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                {processing ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE ARTÍCULOS */}
      {ticketDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Artículos del Pedido</h3>
                <p className="text-xs text-slate-400 font-mono">#{ticketDetail.ticketId} • {ticketDetail.clientName}</p>
              </div>
              <button onClick={() => setTicketDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {ticketDetail.items.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="size-14 rounded-xl bg-white dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    {(item.productImageUrl || item.image_url) ? (
                      <img src={item.productImageUrl || item.image_url} alt={item.productName || item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-300">inventory_2</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.productName || item.product_name}</p>
                    <p className="text-xs text-slate-500">{item.variant_info || `${item.color} - ${item.size}`}</p>
                    <p className="text-xs text-slate-400 mt-1">Cant: {item.quantity} x ${(item.unitSalePrice || item.price || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 dark:text-white">${(item.revenue || (item.price * item.quantity) || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Total del Pedido:</span>
              <span className="text-lg font-black text-primary">${Number(ticketDetail.total).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN (ADMIN) */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700">
              <div className="size-10 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">¿Eliminar este pedido?</h3>
                <p className="text-xs text-slate-400">Pedido #{orderToDelete.order_number}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">Esta acción eliminará el pedido de la base de datos de forma permanente.</p>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{orderToDelete.customer?.name || 'Cliente'}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Monto Total:</span>
                  <span className="font-black text-slate-900 dark:text-white">${Number(orderToDelete.total || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button type="button" disabled={processing} onClick={() => setOrderToDelete(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                No, cancelar
              </button>
              <button type="button" disabled={processing} onClick={handleConfirmDeleteWebOrder}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? (
                  <><div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Eliminando...</span></>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">delete</span><span>Sí, eliminar</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
