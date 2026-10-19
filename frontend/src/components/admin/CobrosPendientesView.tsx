'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';

interface CobrosPendientesViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
  currentAdminRole?: string;
}

interface PendingDebtRecord {
  id: string;
  source: 'web' | 'mostrador';
  reference: string; // order_number or ticketId
  clientName: string;
  clientPhone: string;
  date: string;
  total: number;
  paidAmount: number;
  pendingAmount: number;
  paymentType: 'total' | 'partial' | 'cuotas';
  installmentsCount: number;
  lastPaidMonth?: string;
  notes?: string;
  items: Array<{
    productId?: string;
    variantId?: string;
    productName: string;
    variantInfo: string;
    quantity: number;
    price?: number;
  }>;
  rawSaleRecords?: any[];
  shippingCost?: number;
  shippingType?: string;
  shippingInvoiceUrl?: string;
  shippingTrackingNumber?: string;
}

export default function CobrosPendientesView({ apiKey, showAlert, currentAdminRole }: CobrosPendientesViewProps) {
  const isSuperAdmin = currentAdminRole === 'super_admin';

  // Store de Mostrador
  const posSales = useStockFlowStore(s => s.sales);
  const recordSalePayment = useStockFlowStore(s => s.recordSalePayment);
  const markSaleMonthPaid = useStockFlowStore(s => s.markSaleMonthPaid);
  const deleteSaleAndRestoreStock = useStockFlowStore(s => s.deleteSaleAndRestoreStock);

  // Backend Web Orders
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);

  const [filterSource, setFilterSource] = useState<'all' | 'web' | 'mostrador' | 'month_due'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Registrar Pago
  const [selectedRecord, setSelectedRecord] = useState<PendingDebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Modal Eliminar Deuda (Super Admin)
  const [debtToDelete, setDebtToDelete] = useState<PendingDebtRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  const getToken = (): string => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') ?? '' : '');

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Sin fecha';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Cargar pedidos web
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
      console.warn('Error fetching web orders:', e);
    } finally {
      setLoadingWeb(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchWebOrders();
  }, [fetchWebOrders]);

  // 1. Procesar deudas de Mostrador (Zustand)
  const posTicketsMap = new Map<string, PendingDebtRecord>();
  posSales
    .filter(s => !s.ticketId.startsWith('WEB-'))
    .forEach(s => {
      const pending = s.pendingAmount ?? s.remainingAmount ?? 0;
      if (!posTicketsMap.has(s.ticketId)) {
        posTicketsMap.set(s.ticketId, {
          id: s.ticketId,
          source: 'mostrador',
          reference: s.ticketId,
          clientName: s.clientName || 'Consumidor Final',
          clientPhone: s.clientPhone || 'S/D',
          date: s.date,
          total: s.shippingCost || 0,
          paidAmount: s.paidAmount ?? 0,
          pendingAmount: pending,
          paymentType: s.paymentType || 'cuotas',
          installmentsCount: s.installmentsCount || 1,
          lastPaidMonth: s.lastNotifiedMonth,
          notes: s.notes || s.adminNotes,
          items: [],
          rawSaleRecords: [],
          shippingCost: s.shippingCost || 0,
          shippingType: s.shippingType,
          shippingInvoiceUrl: s.shippingInvoiceUrl,
          shippingTrackingNumber: s.shippingTrackingNumber,
        });
      }
      const r = posTicketsMap.get(s.ticketId)!;
      r.total += s.revenue;
      r.rawSaleRecords?.push(s);
      r.items.push({
        productId: s.productId,
        variantId: s.variantId,
        productName: s.productName,
        variantInfo: `${s.color || ''} ${s.size ? `Talle ${s.size}` : ''}`.trim(),
        quantity: s.quantity || 1,
        price: s.unitSalePrice || 0
      });
    });

  const posDebts: PendingDebtRecord[] = Array.from(posTicketsMap.values()).filter(r => r.pendingAmount > 0);

  // 2. Procesar deudas Web (Backend)
  const webDebts: PendingDebtRecord[] = webOrders
    .filter(o => {
      const s = (o.status || '').toLowerCase();
      if (s.includes('rechaz') || s.includes('cancel')) return false;
      const tot = parseFloat(o.total || 0);
      const paid = parseFloat(o.paid_amount || 0);
      const rem = Math.max(0, tot - paid);
      return rem > 0;
    })
    .map(o => {
      const tot = parseFloat(o.total || 0);
      const paid = parseFloat(o.paid_amount || 0);
      return {
        id: `web-${o.order_number}`,
        source: 'web' as const,
        reference: o.order_number,
        clientName: o.customer?.name || 'Cliente Web',
        clientPhone: o.customer?.phone || 'S/D',
        date: o.created_at,
        total: tot,
        paidAmount: paid,
        pendingAmount: Math.max(0, tot - paid),
        paymentType: (o.payment_type as any) || 'cuotas',
        installmentsCount: o.installments_count || 1,
        lastPaidMonth: o.last_installment_paid_month,
        notes: o.admin_notes,
        items: (o.items || []).map((i: any) => ({
          productId: i.product_id,
          variantId: i.variant_id,
          productName: i.product_name || 'Producto',
          variantInfo: i.variant_info || '',
          quantity: i.quantity || 1,
          price: Number(i.price || 0)
        })),
        shippingCost: parseFloat(o.shipping_cost || 0),
        shippingType: o.shipping_type,
        shippingInvoiceUrl: o.shipping_invoice_url,
        shippingTrackingNumber: o.shipping_tracking_number,
      };
    });

  // 3. Unificar todas las deudas
  const allDebts = [...webDebts, ...posDebts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filtros
  const filteredDebts = allDebts.filter(d => {
    const term = searchTerm.toLowerCase();
    const matchesTerm =
      d.clientName.toLowerCase().includes(term) ||
      d.clientPhone.toLowerCase().includes(term) ||
      d.reference.toLowerCase().includes(term);

    if (!matchesTerm) return false;

    if (filterSource === 'web') return d.source === 'web';
    if (filterSource === 'mostrador') return d.source === 'mostrador';
    if (filterSource === 'month_due') return d.lastPaidMonth !== currentMonth;
    return true;
  });

  const totalDeudaGlobal = allDebts.reduce((acc, d) => acc + d.pendingAmount, 0);
  const cuotasPendientesEsteMes = allDebts.filter(d => d.lastPaidMonth !== currentMonth).length;

  // Acción: Registrar cobro
  const handleConfirmRecordPayment = async () => {
    if (!selectedRecord) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) {
      showAlert?.('Ingresa un monto válido mayor a 0.');
      return;
    }
    if (amount > selectedRecord.pendingAmount) {
      showAlert?.(`El monto no puede ser mayor a la deuda ($${selectedRecord.pendingAmount.toLocaleString('es-AR')}).`);
      return;
    }

    setProcessing(true);

    if (selectedRecord.source === 'mostrador') {
      // Registrar en store de Zustand
      recordSalePayment(selectedRecord.reference, amount, paymentNote);
      markSaleMonthPaid(selectedRecord.reference, currentMonth);
      showAlert?.(`✓ Cobro de $${amount.toLocaleString('es-AR')} registrado en ${selectedRecord.reference}.`);
      setSelectedRecord(null);
      setPaymentAmount('');
      setPaymentNote('');
      setProcessing(false);
    } else {
      // Registrar en backend para Pedido Web
      const token = getToken();
      const newPaid = selectedRecord.paidAmount + amount;
      const isFullyPaid = (selectedRecord.total - newPaid) <= 0;

      try {
        const res = await fetch(`${API_URL}/api/orders/admin/${selectedRecord.reference}/status`, {
          method: 'PATCH',
          headers: {
            'X-API-KEY': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paid_amount: newPaid,
            payment_status: isFullyPaid ? 'full' : 'partial',
            last_installment_paid_month: currentMonth,
            admin_notes: paymentNote ? `${selectedRecord.notes || ''} | ${paymentNote}`.trim() : selectedRecord.notes
          })
        });

        if (res.ok) {
          showAlert?.(`✓ Cobro de $${amount.toLocaleString('es-AR')} guardado en ${selectedRecord.reference}.`);
          setSelectedRecord(null);
          setPaymentAmount('');
          setPaymentNote('');
          fetchWebOrders();
        } else {
          showAlert?.('Error al registrar cobro en el backend.');
        }
      } catch {
        showAlert?.('Error de conexión.');
      } finally {
        setProcessing(false);
      }
    }
  };


  // Acción: Eliminar cobro pendiente y devolver productos al stock (Super Admin)
  const handleConfirmDeleteDebt = async () => {
    if (!debtToDelete) return;
    setIsDeleting(true);
    try {
      if (debtToDelete.source === 'web') {
        const token = getToken();
        if (token) {
          try {
            await fetch(`${API_URL}/api/orders/admin/${debtToDelete.reference}`, {
              method: 'DELETE',
              headers: { 'X-API-KEY': token },
            });
          } catch (err) {
            console.warn('Error al eliminar pedido web en backend:', err);
          }
        }
      }

      // Restituir productos al stock y eliminar la venta del registro
      deleteSaleAndRestoreStock(debtToDelete.reference, debtToDelete.items);

      if (debtToDelete.source === 'web') {
        await fetchWebOrders();
      }

      if (showAlert) {
        showAlert(`✓ Cobro pendiente #${debtToDelete.reference} eliminado correctamente. Los productos han vuelto al stock.`);
      }
      setDebtToDelete(null);
    } catch (e: any) {
      console.error('Error al eliminar cobro pendiente:', e);
      if (showAlert) {
        showAlert('Error al eliminar el cobro pendiente. Inténtalo nuevamente.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Cobros Pendientes y Cuotas</h2>
              <p className="text-xs text-slate-500">Gestión de saldos adeudados de compras web y mostrador</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Adeudado Global</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">${totalDeudaGlobal.toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* Banner de Recordatorio Mensual */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3.5 mb-6">
          <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">calendar_month</span>
          <div className="flex-1 text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Recordatorio mensual de cobros ({currentMonth})
            </p>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              Tenés <strong className="text-amber-700 dark:text-amber-300">{cuotasPendientesEsteMes} cliente(s)</strong> con saldos pendientes de cobrar este mes. Al registrar el cobro correspondiente, la notificación se apagará hasta el mes que viene en caso de que continúe quedando deuda.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
            <button
              onClick={() => setFilterSource('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Todos ({allDebts.length})
            </button>

            <button
              onClick={() => setFilterSource('month_due')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'month_due'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-sm hidden sm:inline">notifications_active</span>
              <span className="truncate">A Cobrar Este Mes ({cuotasPendientesEsteMes})</span>
            </button>

            <button
              onClick={() => setFilterSource('web')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'web'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              🌐 Web ({webDebts.length})
            </button>

            <button
              onClick={() => setFilterSource('mostrador')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'mostrador'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              🏪 Mostrador ({posDebts.length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Buscar cliente, tel o ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Lista de Cobros Pendientes */}
      <div className="space-y-3.5">
        {filteredDebts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">task_alt</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay cobros pendientes</p>
            <p className="text-xs text-slate-500 mt-1">Todos los clientes tienen sus cuentas saldadas.</p>
          </div>
        ) : (
          filteredDebts.map((d) => {
            const isPaidThisMonth = d.lastPaidMonth === currentMonth;
            const approxCuota = d.installmentsCount > 0 ? Math.round(d.pendingAmount / d.installmentsCount) : d.pendingAmount;

            return (
              <div
                key={d.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  
                  {/* Izquierda: Info de Cliente y Venta */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      d.source === 'web' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">
                        {d.source === 'web' ? 'language' : 'point_of_sale'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {d.clientName}
                        </span>
                        
                        <span className="font-mono text-xs text-slate-500">
                          #{d.reference}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.source === 'web' 
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {d.source === 'web' ? 'Pedido Online' : 'Venta Mostrador'}
                        </span>

                        {Boolean(d.shippingCost && d.shippingCost > 0) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">local_shipping</span>
                            Envío (${d.shippingCost?.toLocaleString('es-AR')})
                          </span>
                        )}

                        {d.shippingInvoiceUrl && (
                          <a
                            href={d.shippingInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-200 border border-orange-200 dark:border-orange-800 flex items-center gap-1 transition-all"
                            title="Ver Factura de Envío"
                          >
                            <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                            Factura
                          </a>
                        )}

                        {/* Estado del Mes */}
                        {isPaidThisMonth ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">done_all</span>
                            Cobrado este mes
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            Pendiente cobrar este mes
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Tel: <strong className="text-slate-700 dark:text-slate-300">{d.clientPhone}</strong></span>
                        {d.installmentsCount > 1 && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg text-[11px]">
                            {d.installmentsCount} cuotas (~${approxCuota.toLocaleString('es-AR')} c/u)
                          </span>
                        )}
                      </div>

                      {d.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1">Nota: {d.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Derecha: Desglose financiero (Total Venta, Abonado, Adeuda) y Botones */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-end gap-3 sm:gap-4 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100 dark:border-slate-700">
                    
                    {/* Grid de los 3 montos claramente destacados */}
                    <div className="grid grid-cols-3 gap-2 shrink-0">
                      
                      {/* 1. Total Venta */}
                      <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200 dark:border-slate-700 text-center min-w-[95px] sm:min-w-[110px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Venta</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white mt-0.5 font-mono">
                          ${d.total.toLocaleString('es-AR')}
                        </p>
                      </div>

                      {/* 2. Cuánto pagó */}
                      <div className="px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center min-w-[95px] sm:min-w-[110px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Abonado</p>
                        <p className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                          ${d.paidAmount.toLocaleString('es-AR')}
                        </p>
                      </div>

                      {/* 3. Cuánto adeuda */}
                      <div className="px-3 py-2 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-center min-w-[95px] sm:min-w-[110px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Adeuda</p>
                        <p className="text-xs sm:text-sm sm:text-base font-black text-red-600 dark:text-red-400 mt-0.5 font-mono">
                          ${d.pendingAmount.toLocaleString('es-AR')}
                        </p>
                      </div>

                    </div>

                    {/* Acciones: Registrar Cobro y Eliminar */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Botón Registrar Cobro */}
                      <button
                        onClick={() => {
                          setSelectedRecord(d);
                          setPaymentAmount('');
                          setPaymentNote('');
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">payments</span>
                        Registrar Cobro
                      </button>

                      {/* Botón Eliminar Cobro Pendiente (Super Admin) */}
                      {isSuperAdmin && (
                        <button
                          onClick={() => setDebtToDelete(d)}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors tooltip"
                          title="Eliminar cobro pendiente y devolver productos al stock"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Registrar Cobro */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-green-500">payments</span>
                Registrar Cobro
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl mb-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800 dark:text-white">{selectedRecord.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Origen / Ref:</span>
                <span className="font-mono">{selectedRecord.source === 'web' ? 'Web' : 'Mostrador'} #{selectedRecord.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Venta:</span>
                <span className="font-bold">${selectedRecord.total.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ya Abonado:</span>
                <span className="font-bold text-emerald-600">${selectedRecord.paidAmount.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-red-600 font-bold text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Saldo Adeudado:</span>
                <span className="font-black">${selectedRecord.pendingAmount.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Monto a cobrar hoy ($):</label>
                <input
                  type="number"
                  min="1"
                  max={selectedRecord.pendingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Ej: ${selectedRecord.pendingAmount}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-lg text-green-600 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Detalle o comprobante (opcional):</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ej: Cuota 2 pagada por transferencia..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRecordPayment}
                  disabled={processing}
                  className="flex-[2] py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold shadow-md shadow-green-500/20 transition-all"
                >
                  Confirmar Cobro
                </button>
              </div>

              {isSuperAdmin && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const toDelete = selectedRecord;
                      setSelectedRecord(null);
                      setDebtToDelete(toDelete);
                    }}
                    className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Eliminar este cobro y devolver stock
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE COBRO PENDIENTE (SUPER ADMIN ONLY) */}
      {debtToDelete && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-red-200 dark:border-red-900/40 animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 pb-4 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border-b border-red-100 dark:border-red-950 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  ¿Eliminar cobro pendiente #{debtToDelete.reference}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Acción exclusiva de Super Administrador. Se anulará el registro y los productos volverán automáticamente al inventario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setDebtToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{debtToDelete.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Canal / Fecha:</span>
                  <span>{debtToDelete.source === 'web' ? '🌐 Pedido Web' : '🏪 Mostrador'} · {formatDate(debtToDelete.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Venta:</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    ${debtToDelete.total.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ya Abonado:</span>
                  <span className="font-bold text-emerald-600">${debtToDelete.paidAmount.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400 font-bold text-sm pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <span>Saldo Pendiente (Adeudado):</span>
                  <span className="font-black">${debtToDelete.pendingAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Items to return to stock */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs mb-2.5">
                  <span className="material-symbols-outlined text-base text-emerald-600">inventory_2</span>
                  <span>Productos que volverán al stock:</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {debtToDelete.items && debtToDelete.items.length > 0 ? (
                    debtToDelete.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-xs shadow-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {it.productName}
                          </p>
                          {it.variantInfo && (
                            <p className="text-[10px] text-slate-400 truncate">{it.variantInfo}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-black rounded-lg text-xs">
                          <span className="material-symbols-outlined text-sm">arrow_upward</span>
                          +{it.quantity} {it.quantity === 1 ? 'ud' : 'uds'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic p-2">
                      Los ítems asociados a la venta volverán automáticamente al inventario.
                    </p>
                  )}
                </div>
              </div>

              {/* Warning note */}
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-3.5 text-xs text-red-700 dark:text-red-300">
                <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">warning</span>
                <p className="leading-relaxed">
                  Este cobro pendiente y su venta asociada serán <strong>eliminados permanentemente</strong> del registro y las cantidades arriba detalladas se <strong>reintegrarán automáticamente al inventario</strong>.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setDebtToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDebt}
                disabled={isDeleting}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    <span>Confirmar y Devolver Stock</span>
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
