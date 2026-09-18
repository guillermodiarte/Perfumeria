'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStockFlowStore, SaleRecord } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';
import { API_URL } from '@/utils/api';

interface VentasRealizadasViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
}

export interface UnifiedSale {
  id: string;
  channel: 'mostrador' | 'web';
  ticketId: string;
  date: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  total: number;
  paidAmount: number;
  paymentType: string;
  itemsCount: number;
  items: {
    productName: string;
    variantInfo: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }[];
  rawSaleRecords?: SaleRecord[];
  adminNotes?: string;
}

export default function VentasRealizadasView({ apiKey, showAlert }: VentasRealizadasViewProps) {
  // --- Zustand store (Mostrador POS sales) ---
  const posSales = useStockFlowStore(s => s.sales);

  // --- Backend web orders ---
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);

  // --- Filters ---
  const [channelFilter, setChannelFilter] = useState<'all' | 'mostrador' | 'web'>('all');
  const [dateFilter, setDateFilter] = useState<'month' | 'today' | 'week' | string>('month');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Modals ---
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<UnifiedSale | null>(null);

  const getToken = () => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') : '');

  // Fetch web orders from backend
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

  // --- Parse and combine ONLY PAID / COMPLETED sales ---
  const allPaidSales = useMemo<UnifiedSale[]>(() => {
    const list: UnifiedSale[] = [];

    // 1. Mostrador Sales (from Zustand)
    const posTicketsMap = new Map<string, SaleRecord[]>();
    posSales.forEach(s => {
      if (s.ticketId && s.ticketId.startsWith('WEB-')) return;
      const tId = s.ticketId || `TICK-${s.id}`;
      if (!posTicketsMap.has(tId)) {
        posTicketsMap.set(tId, []);
      }
      posTicketsMap.get(tId)!.push(s);
    });

    posTicketsMap.forEach((records, tId) => {
      const first = records[0];
      const totalRev = records.reduce((acc, r) => acc + (r.revenue || 0), 0);
      const paid = records.reduce((acc, r) => acc + (r.paidAmount ?? (r.status === 'Pagada' ? r.revenue : 0)), 0);
      const remaining = records.reduce((acc, r) => acc + (r.remainingAmount ?? (r.status === 'Pagada' ? 0 : r.revenue)), 0);

      // Criterio: YA COBRADA en su totalidad (saldo pendiente <= 0 o estatus Pagada)
      const isPaid = (first.status === 'Pagada') || (remaining <= 0 && totalRev > 0) || (paid >= totalRev && totalRev > 0);
      if (!isPaid) return;

      list.push({
        id: `pos-${tId}`,
        channel: 'mostrador',
        ticketId: tId,
        date: first.date,
        clientName: first.clientName || 'Consumidor Final',
        clientPhone: first.clientPhone || 'S/D',
        total: totalRev,
        paidAmount: Math.min(totalRev, paid || totalRev),
        paymentType: first.paymentType || 'total',
        itemsCount: records.reduce((acc, r) => acc + (r.quantity || 1), 0),
        items: records.map(r => ({
          productName: r.productName,
          variantInfo: `${r.color || ''} ${r.size ? `Talle ${r.size}` : ''}`.trim(),
          quantity: r.quantity,
          price: r.unitSalePrice,
        })),
        rawSaleRecords: records,
        adminNotes: first.notes || first.adminNotes || '',
      });
    });

    // 2. Web Orders (from Backend)
    webOrders.forEach(o => {
      const st = (o.status || '').toLowerCase();
      if (st.includes('cancel') || st.includes('rechaz')) return;

      const tot = Number(o.total || 0);
      const paid = Number(o.paid_amount || 0);
      const paySt = (o.payment_status || '').toLowerCase();

      const isPaid = paySt === 'full' || (paid >= tot && tot > 0) || (st === 'entregado' && paySt !== 'pending');
      if (!isPaid) return;

      list.push({
        id: `web-${o.id}`,
        channel: 'web',
        ticketId: o.order_number,
        date: o.created_at,
        clientName: o.customer?.name || 'Cliente Web',
        clientPhone: o.customer?.phone || 'S/D',
        clientEmail: o.customer?.email || '',
        total: tot,
        paidAmount: paid || tot,
        paymentType: o.payment_type || 'total',
        itemsCount: (o.items || []).reduce((acc: number, i: any) => acc + (i.quantity || 1), 0),
        items: (o.items || []).map((i: any) => ({
          productName: i.product_name || 'Producto',
          variantInfo: i.variant_info || '',
          quantity: i.quantity,
          price: Number(i.price || 0),
          imageUrl: i.image_url,
        })),
        adminNotes: o.admin_notes || '',
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [posSales, webOrders]);

  // --- Filtering ---
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return allPaidSales.filter(sale => {
      if (channelFilter !== 'all' && sale.channel !== channelFilter) return false;

      const saleDate = new Date(sale.date);
      const saleDateStr = (sale.date || '').split('T')[0];

      if (dateFilter === 'today') {
        if (saleDateStr !== todayStr) return false;
      } else if (dateFilter === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (saleDate < sevenDaysAgo) return false;
      } else if (dateFilter === 'month') {
        const currentMonth = todayStr.substring(0, 7);
        if (!saleDateStr.startsWith(currentMonth)) return false;
      } else if (dateFilter.match(/^\d{4}-\d{2}$/)) {
        // Mes histórico específico
        if (!saleDateStr.startsWith(dateFilter)) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesNumber = sale.ticketId.toLowerCase().includes(term);
        const matchesClient = sale.clientName.toLowerCase().includes(term);
        const matchesPhone = sale.clientPhone.toLowerCase().includes(term);
        const matchesProducts = sale.items.some(i => i.productName.toLowerCase().includes(term));
        if (!matchesNumber && !matchesClient && !matchesPhone && !matchesProducts) return false;
      }

      return true;
    });
  }, [allPaidSales, channelFilter, dateFilter, searchTerm]);

  // Meses anteriores con datos (para el selector histórico)
  const availableMonths = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthSet = new Set<string>();
    allPaidSales.forEach(sale => {
      try {
        const d = new Date(sale.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key !== currentKey) monthSet.add(key);
      } catch { /* skip */ }
    });
    return Array.from(monthSet).sort().reverse();
  }, [allPaidSales]);

  // --- Metrics ---
  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const mostradorSales = filteredSales.filter(s => s.channel === 'mostrador');
    const webSales = filteredSales.filter(s => s.channel === 'web');
    const mostradorRevenue = mostradorSales.reduce((acc, s) => acc + s.total, 0);
    const webRevenue = webSales.reduce((acc, s) => acc + s.total, 0);
    const avgTicket = filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length) : 0;

    return {
      totalRevenue,
      countTotal: filteredSales.length,
      mostradorRevenue,
      mostradorCount: mostradorSales.length,
      webRevenue,
      webCount: webSales.length,
      avgTicket,
    };
  }, [filteredSales]);

  // --- Handlers ---
  const handlePrintTicket = (sale: UnifiedSale) => {
    try {
      if (sale.channel === 'mostrador' && sale.rawSaleRecords) {
        generateTicketPDF(sale.ticketId, sale.rawSaleRecords, true);
      } else {
        const pseudoRecords: SaleRecord[] = sale.items.map(item => ({
          id: sale.id,
          ticketId: sale.ticketId,
          productId: '',
          productName: item.productName,
          variantId: '',
          color: item.variantInfo,
          size: '',
          quantity: item.quantity,
          unitSalePrice: item.price,
          revenue: item.quantity * item.price,
          date: sale.date,
          clientName: sale.clientName,
          clientPhone: sale.clientPhone,
          status: 'Pagada',
        }));
        generateTicketPDF(sale.ticketId, pseudoRecords, true);
      }
      if (showAlert) showAlert('Ticket enviado a impresión.');
    } catch (e: any) {
      console.error(e);
      if (showAlert) showAlert('Error al generar el ticket PDF');
    }
  };

  const formatDate = (isoString: string) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Ventas Realizadas</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Historial unificado de todas las ventas ya cobradas de mostrador y tienda online.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchWebOrders}
          disabled={loadingWeb}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-lg ${loadingWeb ? 'animate-spin' : ''}`}>refresh</span>
          <span>Actualizar</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cobrado */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Cobrado</span>
            <span className="material-symbols-outlined text-emerald-500">payments</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ${metrics.totalRevenue.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 font-medium block">
            {metrics.countTotal} venta{metrics.countTotal === 1 ? '' : 's'} concretada{metrics.countTotal === 1 ? '' : 's'}
          </span>
        </div>

        {/* Ventas Mostrador */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ventas Mostrador</span>
            <span className="material-symbols-outlined text-emerald-600">storefront</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ${metrics.mostradorRevenue.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
            {metrics.mostradorCount} ticket{metrics.mostradorCount === 1 ? '' : 's'} en local
          </span>
        </div>

        {/* Ventas Web */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ventas Tienda Web</span>
            <span className="material-symbols-outlined text-blue-500">language</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ${metrics.webRevenue.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1 block">
            {metrics.webCount} pedido{metrics.webCount === 1 ? '' : 's'} online
          </span>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Promedio</span>
            <span className="material-symbols-outlined text-purple-500">receipt</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ${metrics.avgTicket.toLocaleString('es-AR')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 font-medium block">
            Promedio por transacción
          </span>
        </div>
      </div>

      {/* Toolbar: Channels & Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Channel Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 w-full md:w-auto">
          <button
            onClick={() => setChannelFilter('all')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              channelFilter === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Todas</span>
            <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-md text-[10px]">
              {allPaidSales.length}
            </span>
          </button>

          <button
            onClick={() => setChannelFilter('mostrador')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              channelFilter === 'mostrador'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm text-emerald-500">storefront</span>
            <span>Mostrador</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md text-[10px]">
              {allPaidSales.filter(s => s.channel === 'mostrador').length}
            </span>
          </button>

          <button
            onClick={() => setChannelFilter('web')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              channelFilter === 'web'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm text-blue-500">language</span>
            <span>Tienda Web</span>
            <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-md text-[10px]">
              {allPaidSales.filter(s => s.channel === 'web').length}
            </span>
          </button>
        </div>

          {/* Date Filter & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Date quick buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                dateFilter === 'today'
                  ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                dateFilter === 'week'
                  ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                dateFilter === 'month'
                  ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Este Mes
            </button>
          </div>

          {/* Dropdown de meses anteriores con datos */}
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-400 text-base">calendar_month</span>
              <select
                value={dateFilter.match(/^\d{4}-\d{2}$/) ? dateFilter : ''}
                onChange={e => { if (e.target.value) setDateFilter(e.target.value); }}
                className="text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="" disabled>Meses anteriores...</option>
                {availableMonths.map(key => {
                  const [y, m] = key.split('-');
                  const label = new Date(parseInt(y), parseInt(m) - 1, 1)
                    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                  return (
                    <option key={key} value={key}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar venta, cliente..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-3">
        {filteredSales.map(sale => (
          <div
            key={sale.id}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Left: Icon, Number, Date, Channel */}
            <div className="flex items-start md:items-center gap-4">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  sale.channel === 'mostrador'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
                }`}
              >
                <span className="material-symbols-outlined text-xl">
                  {sale.channel === 'mostrador' ? 'storefront' : 'language'}
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    #{sale.ticketId}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      sale.channel === 'mostrador'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                    }`}
                  >
                    {sale.channel === 'mostrador' ? 'Venta Mostrador' : 'Venta Online'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Cobrada
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{sale.clientName}</span>
                  {sale.clientPhone && sale.clientPhone !== 'S/D' && (
                    <span>• Tel: {sale.clientPhone}</span>
                  )}
                  <span>• {formatDate(sale.date)}</span>
                </div>

                {/* Items summary */}
                <div className="text-[11px] text-slate-400 mt-1 truncate max-w-xl">
                  {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(' • ')}
                </div>
              </div>
            </div>

            {/* Right: Total & Action Buttons */}
            <div className="flex items-center justify-between md:justify-end gap-5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-700">
              <div className="text-left md:text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cobrado</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  ${sale.total.toLocaleString('es-AR')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSaleDetail(sale)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold transition-colors tooltip"
                  title="Ver Detalle"
                >
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </button>

                <button
                  onClick={() => handlePrintTicket(sale)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm"
                  title="Reimprimir Ticket / Comprobante PDF"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span className="hidden sm:inline">Ticket</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredSales.length === 0 && !loadingWeb && (
          <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <span className="material-symbols-outlined text-3xl">receipt_long</span>
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No se encontraron ventas</h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'No hay ventas cobradas que coincidan con los términos de búsqueda.'
                : 'No se registran ventas cobradas en el período y canal seleccionado.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setDateFilter('all'); setChannelFilter('all'); }}
                className="mt-4 px-4 py-2 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-colors"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Detalle de Venta */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Detalle de Venta #{selectedSaleDetail.ticketId}
                  </h3>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      selectedSaleDetail.channel === 'mostrador'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                    }`}
                  >
                    {selectedSaleDetail.channel === 'mostrador' ? 'Mostrador' : 'Online Web'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDate(selectedSaleDetail.date)}
                </p>
              </div>

              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Customer Box */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Datos del Cliente
                </span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedSaleDetail.clientName}
                </p>
                {selectedSaleDetail.clientPhone && selectedSaleDetail.clientPhone !== 'S/D' && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Teléfono: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedSaleDetail.clientPhone}</span>
                  </p>
                )}
                {selectedSaleDetail.clientEmail && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Email: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedSaleDetail.clientEmail}</span>
                  </p>
                )}
              </div>

              {/* Items List */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-3">
                  Productos Vendidos ({selectedSaleDetail.itemsCount})
                </span>
                <div className="space-y-2">
                  {selectedSaleDetail.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800 text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {item.quantity}x {item.productName}
                        </p>
                        {item.variantInfo && (
                          <p className="text-[11px] text-slate-400">{item.variantInfo}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 font-mono font-bold text-slate-800 dark:text-white">
                        ${(item.quantity * item.price).toLocaleString('es-AR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedSaleDetail.adminNotes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold block mb-0.5">Notas del comprobante:</span>
                  {selectedSaleDetail.adminNotes}
                </div>
              )}

              {/* Total Box */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    Total Cobrado
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-300">Pago Completado</span>
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  ${selectedSaleDetail.total.toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => handlePrintTicket(selectedSaleDetail)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Imprimir Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
