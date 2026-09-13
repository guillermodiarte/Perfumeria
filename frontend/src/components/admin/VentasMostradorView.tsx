'use client';

import { useState } from 'react';
import { useStockFlowStore, SaleRecord } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';

interface VentasMostradorViewProps {
  showAlert?: (msg: string) => void;
}

export default function VentasMostradorView({ showAlert }: VentasMostradorViewProps) {
  const sales = useStockFlowStore(s => s.sales);
  const recordSalePayment = useStockFlowStore(s => s.recordSalePayment);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'paid' | 'pending_installments'>('all');

  // Modal Detalle
  const [ticketDetailId, setTicketDetailId] = useState<string | null>(null);

  // Modal Registrar Pago de Saldo
  const [paymentTicket, setPaymentTicket] = useState<{
    ticketId: string;
    clientName: string;
    total: number;
    paid: number;
    pending: number;
  } | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payNoteInput, setPayNoteInput] = useState('');

  // Filtrar SOLO ventas de mostrador (excluyendo tickets que empiecen con WEB-)
  const posSales = sales.filter(s => !s.ticketId.startsWith('WEB-'));

  // Agrupar por ticketId
  const ticketsMap = new Map<string, {
    ticketId: string;
    date: string;
    clientName: string;
    clientPhone: string;
    items: SaleRecord[];
    totalRevenue: number;
    paidAmount: number;
    pendingAmount: number;
    paymentType: 'total' | 'partial' | 'cuotas';
    installmentsCount: number;
    status: 'Pagada' | 'Pendiente' | 'Cancelada';
    notes?: string;
  }>();

  posSales.forEach(s => {
    if (!ticketsMap.has(s.ticketId)) {
      ticketsMap.set(s.ticketId, {
        ticketId: s.ticketId,
        date: s.date,
        clientName: s.clientName || 'Consumidor Final',
        clientPhone: s.clientPhone || 'S/D',
        items: [],
        totalRevenue: 0,
        paidAmount: s.paidAmount ?? 0,
        pendingAmount: s.pendingAmount ?? s.remainingAmount ?? 0,
        paymentType: s.paymentType || 'total',
        installmentsCount: s.installmentsCount || 1,
        status: s.status,
        notes: s.notes || s.adminNotes
      });
    }
    const t = ticketsMap.get(s.ticketId)!;
    t.items.push(s);
    t.totalRevenue += s.revenue;
  });

  const tickets = Array.from(ticketsMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filtro
  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      t.clientName.toLowerCase().includes(term) ||
      t.clientPhone.toLowerCase().includes(term) ||
      t.ticketId.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (activeFilter === 'paid') return t.pendingAmount <= 0;
    if (activeFilter === 'pending_installments') return t.pendingAmount > 0;
    return true;
  });

  // Métricas
  const totalFacturado = tickets.reduce((acc, t) => acc + t.totalRevenue, 0);
  const totalCobrado = tickets.reduce((acc, t) => acc + Math.min(t.totalRevenue, t.totalRevenue - t.pendingAmount), 0);
  const totalAdeudado = tickets.reduce((acc, t) => acc + t.pendingAmount, 0);

  // Registrar abono
  const handleConfirmPayment = () => {
    if (!paymentTicket) return;
    const amount = parseFloat(payAmountInput) || 0;
    if (amount <= 0) {
      showAlert?.('Ingresa un monto válido mayor a 0.');
      return;
    }
    if (amount > paymentTicket.pending) {
      showAlert?.(`El monto no puede superar la deuda actual ($${paymentTicket.pending.toLocaleString('es-AR')}).`);
      return;
    }

    recordSalePayment(paymentTicket.ticketId, amount, payNoteInput.trim());
    showAlert?.(`✓ Pago de $${amount.toLocaleString('es-AR')} registrado en ${paymentTicket.ticketId}.`);
    setPaymentTicket(null);
    setPayAmountInput('');
    setPayNoteInput('');
  };

  const selectedTicketDetail = ticketDetailId ? ticketsMap.get(ticketDetailId) : null;

  return (
    <div className="space-y-6">

      {/* Header y Métricas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Ventas de Mostrador</h2>
              <p className="text-xs text-slate-500">Historial exclusivo de ventas físicas registradas en caja</p>
            </div>
          </div>
        </div>

        {/* Resumen Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Facturado Mostrador</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${totalFacturado.toLocaleString('es-AR')}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Total Cobrado</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${totalCobrado.toLocaleString('es-AR')}</p>
          </div>
          <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-800/40">
            <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Saldo Adeudado / Cuotas</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">${totalAdeudado.toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* Buscador y Pestañas */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Todas ({tickets.length})
            </button>

            <button
              onClick={() => setActiveFilter('paid')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">verified</span>
              Saldadas 100%
            </button>

            <button
              onClick={() => setActiveFilter('pending_installments')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'pending_installments'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">hourglass_top</span>
              En Cuotas / Con Saldo
              {tickets.filter(t => t.pendingAmount > 0).length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeFilter === 'pending_installments' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                }`}>
                  {tickets.filter(t => t.pendingAmount > 0).length}
                </span>
              )}
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Buscar por cliente o ticket..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

        </div>
      </div>

      {/* Listado de Tickets */}
      <div className="space-y-3.5">
        {filteredTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">receipt_long</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron ventas de mostrador</p>
            <p className="text-xs text-slate-500 mt-1">Registra ventas físicas desde la sección "Vender".</p>
          </div>
        ) : (
          filteredTickets.map((t) => {
            const dateStr = new Date(t.date).toLocaleDateString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return (
              <div 
                key={t.ticketId}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Info Izquierda */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-emerald-500">point_of_sale</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                          #{t.ticketId}
                        </span>

                        {/* Modalidad Badge */}
                        {t.paymentType === 'cuotas' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            En {t.installmentsCount || 1} cuotas
                          </span>
                        ) : t.pendingAmount > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Pago Parcial
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Saldado 100%
                          </span>
                        )}

                        {t.pendingAmount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse">
                            Saldo: ${t.pendingAmount.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{t.clientName}</span>
                        <span>Tel: {t.clientPhone}</span>
                        <span>{dateStr}</span>
                        <span>{t.items.length} producto(s)</span>
                      </div>

                      {t.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1">Nota: {t.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Precios y Acciones */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-700">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Venta</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">${t.totalRevenue.toLocaleString('es-AR')}</p>
                      {t.pendingAmount > 0 ? (
                        <p className="text-xs font-bold text-red-500 mt-0.5">
                          Falta: ${t.pendingAmount.toLocaleString('es-AR')}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Totalmente pagado
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botón Ver Detalle */}
                      <button
                        onClick={() => setTicketDetailId(t.ticketId)}
                        title="Ver detalle de artículos"
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>

                      {/* Botón Imprimir Ticket */}
                      <button
                        onClick={() => generateTicketPDF(t.ticketId, sales, true)}
                        title="Reimprimir Ticket"
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">print</span>
                      </button>

                      {/* Botón Registrar Abono / Saldo */}
                      {t.pendingAmount > 0 && (
                        <button
                          onClick={() => {
                            setPaymentTicket({
                              ticketId: t.ticketId,
                              clientName: t.clientName,
                              total: t.totalRevenue,
                              paid: t.paidAmount,
                              pending: t.pendingAmount
                            });
                            setPayAmountInput('');
                            setPayNoteInput('');
                          }}
                          className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                          Cobrar
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

      {/* MODAL: Registrar Cobro de Saldo / Cuota */}
      {paymentTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">payments</span>
                Registrar Cobro — #{paymentTicket.ticketId}
              </h3>
              <button onClick={() => setPaymentTicket(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800 dark:text-white">{paymentTicket.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Venta:</span>
                <span className="font-bold">${paymentTicket.total.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-red-500 font-bold text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Saldo Adeudado:</span>
                <span className="font-black">${paymentTicket.pending.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Monto que abona hoy ($):</label>
                <input
                  type="number"
                  min="1"
                  max={paymentTicket.pending}
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  placeholder={`Ej: ${paymentTicket.pending}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-base text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nota o comprobante (opcional):</label>
                <input
                  type="text"
                  value={payNoteInput}
                  onChange={(e) => setPayNoteInput(e.target.value)}
                  placeholder="Ej: Cobrado en efectivo / transferencia..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPaymentTicket(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-[2] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                Confirmar Cobro
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Detalle de Artículos */}
      {selectedTicketDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Ticket #{selectedTicketDetail.ticketId}</h3>
                <p className="text-xs text-slate-500">{selectedTicketDetail.clientName} ({selectedTicketDetail.clientPhone})</p>
              </div>
              <button onClick={() => setTicketDetailId(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 mb-5">
              {selectedTicketDetail.items.map((item, i) => (
                <div key={i} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{item.productName}</p>
                    <p className="text-slate-500">{item.color} - Talle {item.size}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-white">{item.quantity} x ${item.unitSalePrice.toLocaleString('es-AR')}</p>
                    <p className="text-slate-500 font-black">${item.revenue.toLocaleString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl flex justify-between items-center text-sm font-bold mb-4">
              <span>Total Venta:</span>
              <span className="text-xl font-black text-primary">${selectedTicketDetail.totalRevenue.toLocaleString('es-AR')}</span>
            </div>

            <button
              onClick={() => setTicketDetailId(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
