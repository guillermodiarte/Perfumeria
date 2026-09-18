'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';

interface CobrosPendientesViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
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
}

export default function CobrosPendientesView({ apiKey, showAlert }: CobrosPendientesViewProps) {
  // Store de Mostrador
  const posSales = useStockFlowStore(s => s.sales);
  const recordSalePayment = useStockFlowStore(s => s.recordSalePayment);
  const markSaleMonthPaid = useStockFlowStore(s => s.markSaleMonthPaid);

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

  const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  const getToken = (): string => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') ?? '' : '');

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
          total: 0,
          paidAmount: s.paidAmount ?? 0,
          pendingAmount: pending,
          paymentType: s.paymentType || 'cuotas',
          installmentsCount: s.installmentsCount || 1,
          lastPaidMonth: s.lastNotifiedMonth,
          notes: s.notes || s.adminNotes
        });
      }
      const r = posTicketsMap.get(s.ticketId)!;
      r.total += s.revenue;
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
        notes: o.admin_notes
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

  // Marcar mes cobrado (sin monto adicional o ya cobrado)
  const handleMarkMonthPaid = async (debt: PendingDebtRecord) => {
    if (debt.source === 'mostrador') {
      markSaleMonthPaid(debt.reference, currentMonth);
      showAlert?.(`✓ Mes ${currentMonth} marcado como cobrado para ${debt.clientName}.`);
    } else {
      const token = getToken();
      try {
        const res = await fetch(`${API_URL}/api/orders/admin/${debt.reference}/status`, {
          method: 'PATCH',
          headers: {
            'X-API-KEY': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            last_installment_paid_month: currentMonth
          })
        });
        if (res.ok) {
          showAlert?.(`✓ Mes ${currentMonth} marcado como cobrado para ${debt.clientName}.`);
          fetchWebOrders();
        }
      } catch {
        showAlert?.('Error de red.');
      }
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
              Tenés <strong className="text-amber-700 dark:text-amber-300">{cuotasPendientesEsteMes} cliente(s)</strong> con cuotas o saldos pendientes de cobrar este mes. Al registrar el pago o marcar como cobrado, la notificación se apagará hasta el mes que viene.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setFilterSource('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterSource === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Todos ({allDebts.length})
            </button>

            <button
              onClick={() => setFilterSource('month_due')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                filterSource === 'month_due'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-sm">notifications_active</span>
              A Cobrar Este Mes ({cuotasPendientesEsteMes})
            </button>

            <button
              onClick={() => setFilterSource('web')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                filterSource === 'web'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              🌐 Web ({webDebts.length})
            </button>

            <button
              onClick={() => setFilterSource('mostrador')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
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
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Izquierda */}
                  <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      d.source === 'web' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">
                        {d.source === 'web' ? 'language' : 'point_of_sale'}
                      </span>
                    </div>

                    <div>
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

                        {/* Estado del Mes */}
                        {isPaidThisMonth ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">done_all</span>
                            Cobrado este mes
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                            Pendiente cobrar este mes
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Tel: {d.clientPhone}</span>
                        <span>Total Venta: ${d.total.toLocaleString('es-AR')}</span>
                        <span>Abonado hasta hoy: ${d.paidAmount.toLocaleString('es-AR')}</span>
                        {d.installmentsCount > 1 && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {d.installmentsCount} cuotas (~${approxCuota.toLocaleString('es-AR')} c/u)
                          </span>
                        )}
                      </div>

                      {d.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1">Nota: {d.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Deuda y Acciones */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-700">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo Pendiente</p>
                      <p className="text-xl font-black text-red-600 dark:text-red-400">
                        ${d.pendingAmount.toLocaleString('es-AR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botón Silenciar / Marcar Mes Cobrado */}
                      {!isPaidThisMonth && (
                        <button
                          onClick={() => handleMarkMonthPaid(d)}
                          title="Marcar como cobrado en este mes para silenciar recordatorio"
                          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
                        >
                          Marcar Mes
                        </button>
                      )}

                      {/* Botón Registrar Pago / Abono */}
                      <button
                        onClick={() => {
                          setSelectedRecord(d);
                          setPaymentAmount('');
                          setPaymentNote('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-green-500/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">payments</span>
                        Registrar Cobro
                      </button>
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

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRecordPayment}
                disabled={processing}
                className="flex-[2] py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold shadow-md shadow-green-500/20"
              >
                Confirmar Cobro
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
