'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/utils/api';
import { generateTicketPDF } from '@/utils/generateTicket';

interface PedidosWebViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
}

export default function PedidosWebView({ apiKey, showAlert }: PedidosWebViewProps) {
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'delivered' | 'rejected' | 'all'>('pending');

  // Modal Aprobar Pedido
  const [orderToApprove, setOrderToApprove] = useState<any | null>(null);
  const [approvalPaymentType, setApprovalPaymentType] = useState<'total' | 'partial' | 'cuotas'>('total');
  const [approvalPaidAmount, setApprovalPaidAmount] = useState<string>('');
  const [approvalInstallments, setApprovalInstallments] = useState<number>(3);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Modal Rechazar
  const [orderToReject, setOrderToReject] = useState<any | null>(null);

  // Modal Detalle
  const [orderDetail, setOrderDetail] = useState<any | null>(null);

  // Modal Editar Cobro / Entrega
  const [orderToEdit, setOrderToEdit] = useState<any | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('full');
  const [editPaymentType, setEditPaymentType] = useState<'total' | 'partial' | 'cuotas'>('total');
  const [editInstallmentsCount, setEditInstallmentsCount] = useState<number>(1);
  const [editDeliveryStatus, setEditDeliveryStatus] = useState<'pending' | 'delivered'>('pending');
  const [editNotes, setEditNotes] = useState<string>('');

  // Modal Eliminar
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);

  const getToken = () => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') : '');

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/all`, {
        headers: { 'X-API-KEY': token }
      });
      if (res.ok) {
        const data = await res.json();
        setWebOrders(data);
      }
    } catch (e) {
      console.warn('Error al cargar pedidos web:', e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Manejar apertura de modal aprobar
  const openApproveModal = (order: any) => {
    setOrderToApprove(order);
    setApprovalPaymentType('total');
    setApprovalPaidAmount(order.total?.toString() || '0');
    setApprovalInstallments(3);
    setApprovalNotes(order.admin_notes || '');
  };

  // Confirmar aprobación
  const handleConfirmApproval = async () => {
    if (!orderToApprove) return;
    setProcessing(true);
    const token = getToken();

    const total = parseFloat(orderToApprove.total) || 0;
    let finalPaid = total;
    let paymentStatus = 'full';

    if (approvalPaymentType === 'partial') {
      const parsed = parseFloat(approvalPaidAmount) || 0;
      finalPaid = Math.min(total, Math.max(0, parsed));
      paymentStatus = finalPaid >= total ? 'full' : (finalPaid > 0 ? 'partial' : 'pending');
    } else if (approvalPaymentType === 'cuotas') {
      const parsed = parseFloat(approvalPaidAmount) || 0;
      finalPaid = Math.min(total, Math.max(0, parsed));
      paymentStatus = finalPaid >= total ? 'full' : (finalPaid > 0 ? 'partial' : 'pending');
    }

    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToApprove.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Aprobado',
          payment_status: paymentStatus,
          payment_type: approvalPaymentType,
          installments_count: approvalPaymentType === 'cuotas' ? approvalInstallments : 1,
          paid_amount: finalPaid,
          admin_notes: approvalNotes
        })
      });

      if (res.ok) {
        showAlert?.(`✓ Pedido ${orderToApprove.order_number} aprobado exitosamente.`);
        setOrderToApprove(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert?.(err.detail || 'Error al aprobar pedido.');
      }
    } catch {
      showAlert?.('Error de red al conectar con el servidor.');
    } finally {
      setProcessing(false);
    }
  };

  // Confirmar Rechazo
  const handleConfirmReject = async () => {
    if (!orderToReject) return;
    setProcessing(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToReject.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Rechazado'
        })
      });
      if (res.ok) {
        showAlert?.(`Pedido ${orderToReject.order_number} marcado como rechazado.`);
        setOrderToReject(null);
        fetchOrders();
      } else {
        showAlert?.('Error al rechazar el pedido.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Guardar edición
  const handleSaveEdit = async () => {
    if (!orderToEdit) return;
    setProcessing(true);
    const token = getToken();
    const paid = parseFloat(editPaidAmount) || 0;
    const total = parseFloat(orderToEdit.total) || 0;
    const pStatus = paid >= total ? 'full' : (paid > 0 ? 'partial' : 'pending');

    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToEdit.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          delivery_status: editDeliveryStatus,
          payment_status: pStatus,
          payment_type: editPaymentType,
          installments_count: editInstallmentsCount,
          paid_amount: paid,
          admin_notes: editNotes
        })
      });
      if (res.ok) {
        showAlert?.(`✓ Pedido ${orderToEdit.order_number} actualizado.`);
        setOrderToEdit(null);
        fetchOrders();
      } else {
        showAlert?.('Error al actualizar.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Eliminar pedido
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setProcessing(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToDelete.order_number}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': token }
      });
      if (res.ok) {
        showAlert?.(`✓ Pedido ${orderToDelete.order_number} eliminado correctamente.`);
        setOrderToDelete(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert?.(err.detail || 'Error al eliminar el pedido.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Filtrado de pedidos
  const filteredOrders = webOrders.filter(o => {
    const term = searchTerm.toLowerCase();
    const name = (o.customer?.name || '').toLowerCase();
    const phone = (o.customer?.phone || '').toLowerCase();
    const num = (o.order_number || '').toLowerCase();
    const matchesTerm = name.includes(term) || phone.includes(term) || num.includes(term);
    if (!matchesTerm) return false;

    const s = (o.status || '').toLowerCase();
    const d = (o.delivery_status || '').toLowerCase();

    if (activeTab === 'pending') return s.includes('revis') || s.includes('pend');
    if (activeTab === 'approved') return (s.includes('aprob') || s.includes('pagad')) && d !== 'delivered';
    if (activeTab === 'delivered') return d === 'delivered' || s.includes('entreg');
    if (activeTab === 'rejected') return s.includes('rechaz') || s.includes('cancel');
    return true; // 'all'
  });

  const pendingCount = webOrders.filter(o => (o.status || '').toLowerCase().includes('revis')).length;

  return (
    <div className="space-y-6">
      
      {/* Header & Métricas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">language</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Pedidos de la Tienda Web</h2>
                <p className="text-xs text-slate-500">Gestión de compras realizadas online por los clientes</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Actualizar
            </button>
          </div>
        </div>

        {/* Buscador y Pestañas */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">hourglass_empty</span>
              En Revisión
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white animate-pulse'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'approved'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              Aprobados
            </button>

            <button
              onClick={() => setActiveTab('delivered')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              Entregados
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'rejected'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">cancel</span>
              Rechazados
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Todos ({webOrders.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Buscar por cliente, tel o #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {loading && webOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
            <p className="text-xs">Cargando pedidos de la tienda online...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">shopping_bag</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron pedidos web</p>
            <p className="text-xs text-slate-500 mt-1">No hay pedidos en la vista seleccionada actualmente.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const tot = parseFloat(order.total) || 0;
            const paid = parseFloat(order.paid_amount) || 0;
            const remaining = maxDebt(tot, paid);
            const statusStr = (order.status || 'En revisión').toLowerCase();
            const isApproved = statusStr.includes('aprob') || statusStr.includes('pagad');
            const isDelivered = (order.delivery_status || '').toLowerCase() === 'delivered';
            const isRejected = statusStr.includes('rechaz') || statusStr.includes('cancel');
            const dateStr = new Date(order.created_at).toLocaleDateString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return (
              <div 
                key={order.id || order.order_number}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Info Principal */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-primary">shopping_bag</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                          #{order.order_number}
                        </span>
                        
                        {/* Status Badge */}
                        {statusStr.includes('revis') && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            En Revisión
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Aprobado
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Rechazado
                          </span>
                        )}

                        {/* Modalidad de Pago Badge */}
                        {isApproved && (
                          order.payment_type === 'cuotas' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                              En {order.installments_count || 1} cuotas
                            </span>
                          ) : remaining > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Pago Parcial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Pago Total
                            </span>
                          )
                        )}

                        {/* Entrega Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isDelivered 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {isDelivered ? '✓ Entregado' : 'Entrega pendiente'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {order.customer?.name || 'Cliente'}
                        </span>
                        <span>Tel: {order.customer?.phone || 'S/D'}</span>
                        <span>{dateStr}</span>
                        <span>{order.items?.length || 0} productos</span>
                      </div>

                      {order.admin_notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                          Nota: {order.admin_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Precios y Deuda */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-700">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pedido</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">${tot.toLocaleString('es-AR')}</p>
                      {remaining > 0 ? (
                        <p className="text-xs font-bold text-red-500 mt-0.5">
                          Adeuda: ${remaining.toLocaleString('es-AR')}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Saldado 100%
                        </p>
                      )}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-1.5">
                      
                      {/* Botón Ver Detalle */}
                      <button
                        onClick={() => setOrderDetail(order)}
                        title="Ver detalle del pedido"
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>

                      {/* Botones si está En Revisión */}
                      {statusStr.includes('revis') && (
                        <>
                          <button
                            onClick={() => openApproveModal(order)}
                            className="px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-green-500/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            Aprobar
                          </button>

                          <button
                            onClick={() => setOrderToReject(order)}
                            className="p-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Rechazar pedido"
                          >
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </>
                      )}

                      {/* Botón Editar si ya está Aprobado */}
                      {isApproved && (
                        <button
                          onClick={() => {
                            setOrderToEdit(order);
                            setEditPaidAmount(order.paid_amount?.toString() || '0');
                            setEditPaymentStatus(order.payment_status || 'full');
                            setEditPaymentType(order.payment_type || 'total');
                            setEditInstallmentsCount(order.installments_count || 1);
                            setEditDeliveryStatus(order.delivery_status || 'pending');
                            setEditNotes(order.admin_notes || '');
                          }}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Modificar cobro o entrega"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      )}

                      {/* Botón Eliminar */}
                      <button
                        onClick={() => setOrderToDelete(order)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                        title="Eliminar pedido"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>

                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Aprobar Pedido (Total / Parcial / Cuotas) */}
      {orderToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-green-500">check_circle</span>
                Aprobar Pedido #{orderToApprove.order_number}
              </h3>
              <button onClick={() => setOrderToApprove(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl mb-4 flex justify-between items-center text-xs">
              <div>
                <p className="text-slate-500">Cliente:</p>
                <p className="font-bold text-slate-800 dark:text-white text-sm">{orderToApprove.customer?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Total a Cobrar:</p>
                <p className="font-black text-primary text-xl">${parseFloat(orderToApprove.total || 0).toLocaleString('es-AR')}</p>
              </div>
            </div>

            {/* Modalidad de Cobro */}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Modalidad de Cobro</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setApprovalPaymentType('total');
                  setApprovalPaidAmount(orderToApprove.total?.toString() || '0');
                }}
                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                  approvalPaymentType === 'total'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                Pago Total
              </button>
              <button
                type="button"
                onClick={() => {
                  setApprovalPaymentType('partial');
                  setApprovalPaidAmount('');
                }}
                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                  approvalPaymentType === 'partial'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                Pago Parcial
              </button>
              <button
                type="button"
                onClick={() => {
                  setApprovalPaymentType('cuotas');
                  setApprovalPaidAmount('0');
                }}
                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                  approvalPaymentType === 'cuotas'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                En Cuotas
              </button>
            </div>

            {approvalPaymentType === 'partial' && (
              <div className="space-y-2 mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40 text-xs">
                <label className="block font-bold text-slate-700 dark:text-slate-300">¿Cuánto abonó el cliente hoy? ($):</label>
                <input
                  type="number"
                  value={approvalPaidAmount}
                  onChange={(e) => setApprovalPaidAmount(e.target.value)}
                  placeholder="Monto abonado"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold"
                />
                <div className="flex justify-between text-xs pt-1 font-bold">
                  <span>Resta por cobrar:</span>
                  <span className="text-red-500 font-black">
                    ${Math.max(0, (parseFloat(orderToApprove.total) || 0) - (parseFloat(approvalPaidAmount) || 0)).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            )}

            {approvalPaymentType === 'cuotas' && (
              <div className="space-y-3 mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800/40 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad de Cuotas:</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2, 3, 6, 12].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setApprovalInstallments(n)}
                        className={`py-1.5 font-bold rounded-lg border ${
                          approvalInstallments === n ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n} cuotas
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Entrega inicial hoy ($):</label>
                  <input
                    type="number"
                    value={approvalPaidAmount}
                    onChange={(e) => setApprovalPaidAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold"
                  />
                </div>

                <div className="flex justify-between font-bold text-xs pt-1 border-t border-indigo-200">
                  <span>Adeuda a financiar:</span>
                  <span className="text-indigo-700 dark:text-indigo-300">
                    ${Math.max(0, (parseFloat(orderToApprove.total) || 0) - (parseFloat(approvalPaidAmount) || 0)).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notas administrativas (opcional):</label>
              <input
                type="text"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Observación interna..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrderToApprove(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={processing}
                className="flex-[2] py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-black flex items-center justify-center gap-1 shadow-md shadow-green-500/20"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                Confirmar Aprobación
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Rechazar Pedido */}
      {orderToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 text-red-500 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">cancel</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">¿Rechazar este pedido?</h3>
            <p className="text-xs text-slate-500 mb-5">El pedido #{orderToReject.order_number} pasará a estado rechazado.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderToReject(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={processing}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 shadow-md shadow-red-500/20"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Eliminar Pedido */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 text-red-500 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">¿Eliminar pedido definitivamente?</h3>
            <p className="text-xs text-slate-500 mb-5">Se borrará #{orderToDelete.order_number} de la base de datos.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={processing}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-md shadow-red-600/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detalle del Pedido */}
      {orderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Pedido #{orderDetail.order_number}</h3>
                <p className="text-xs text-slate-500">{orderDetail.customer?.name} ({orderDetail.customer?.phone})</p>
              </div>
              <button onClick={() => setOrderDetail(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Lista de Items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 mb-5">
              {orderDetail.items?.map((item: any, i: number) => (
                <div key={i} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{item.product_name || 'Producto'}</p>
                    <p className="text-slate-500">{item.variant_info || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-white">{item.quantity} x ${parseFloat(item.price || 0).toLocaleString('es-AR')}</p>
                    <p className="text-slate-500 font-black">${(item.quantity * parseFloat(item.price || 0)).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl flex justify-between items-center text-sm font-bold mb-4">
              <span>Total:</span>
              <span className="text-xl font-black text-primary">${parseFloat(orderDetail.total || 0).toLocaleString('es-AR')}</span>
            </div>

            <button
              onClick={() => setOrderDetail(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Editar Estado de Cobro y Entrega */}
      {orderToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Modificar Pedido #{orderToEdit.order_number}</h3>
              <button onClick={() => setOrderToEdit(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs mb-5">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estado de Entrega:</label>
                <select
                  value={editDeliveryStatus}
                  onChange={(e: any) => setEditDeliveryStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="pending">Pendiente de entrega</option>
                  <option value="delivered">Entregado al cliente</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Modalidad de Pago:</label>
                <select
                  value={editPaymentType}
                  onChange={(e: any) => setEditPaymentType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="total">Pago Total (100%)</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="cuotas">En Cuotas</option>
                </select>
              </div>

              {editPaymentType === 'cuotas' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad de Cuotas:</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={editInstallmentsCount}
                    onChange={(e) => setEditInstallmentsCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Cobrado Hasta Hoy ($):</label>
                <input
                  type="number"
                  value={editPaidAmount}
                  onChange={(e) => setEditPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Total del pedido: ${parseFloat(orderToEdit.total || 0).toLocaleString('es-AR')}. 
                  Adeuda: ${Math.max(0, parseFloat(orderToEdit.total || 0) - (parseFloat(editPaidAmount) || 0)).toLocaleString('es-AR')}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notas Administrativas:</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderToEdit(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function maxDebt(total: number, paid: number): number {
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}
