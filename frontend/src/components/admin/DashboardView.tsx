'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';

interface DashboardViewProps {
  setActiveView: (view: any) => void;
  apiKey?: string;
  pendingUserCount?: number;
}

interface CurrencyRate {
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion?: string;
}

export default function DashboardView({ setActiveView, apiKey, pendingUserCount = 0 }: DashboardViewProps) {
  // Store local
  const products = useStockFlowStore(s => s.products);
  const posSales = useStockFlowStore(s => s.sales);

  // Estados remotos
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cotizaciones
  const [dolarOficial, setDolarOficial] = useState<CurrencyRate | null>(null);
  const [dolarBlue, setDolarBlue] = useState<CurrencyRate | null>(null);
  const [realRate, setRealRate] = useState<CurrencyRate | null>(null);
  const [guaraniRate, setGuaraniRate] = useState<{ compra: number; venta: number } | null>(null);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [ratesLastUpdated, setRatesLastUpdated] = useState<string>('');

  // Stock descartado en dashboard
  const [dismissedStockIds, setDismissedStockIds] = useState<string[]>([]);

  // Acción rápida para aprobar usuario en dashboard
  const [approvingUserId, setApprovingUserId] = useState<number | null>(null);

  const getToken = (): string => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') ?? '' : '');

  // Cargar IDs de stock descartados
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard_dismissed_stock');
      if (saved) {
        setDismissedStockIds(JSON.parse(saved));
      }
    } catch { }
  }, []);

  const handleDismissStock = (id: string) => {
    const updated = [...dismissedStockIds, id];
    setDismissedStockIds(updated);
    try {
      localStorage.setItem('dashboard_dismissed_stock', JSON.stringify(updated));
    } catch { }
  };

  const handleResetDismissedStock = () => {
    setDismissedStockIds([]);
    try {
      localStorage.removeItem('dashboard_dismissed_stock');
    } catch { }
  };

  // Cargar cotizaciones (Únicamente Dólar Blue y Oficial, Real y Guaraní)
  const fetchCurrencies = useCallback(async () => {
    setLoadingCurrencies(true);
    try {
      // 1. Dólares (dolarapi.com)
      const resDol = await fetch('https://dolarapi.com/v1/dolares');
      if (resDol.ok) {
        const data: any[] = await resDol.json();
        const oficial = data.find(d => (d.casa || '').toLowerCase() === 'oficial');
        const blue = data.find(d => (d.casa || '').toLowerCase() === 'blue');
        if (oficial) setDolarOficial({ nombre: 'Dólar Oficial', compra: oficial.compra, venta: oficial.venta, fechaActualizacion: oficial.fechaActualizacion });
        if (blue) setDolarBlue({ nombre: 'Dólar Blue', compra: blue.compra, venta: blue.venta, fechaActualizacion: blue.fechaActualizacion });
      }

      // 2. Real Brasileño (dolarapi.com/v1/cotizaciones)
      const resCotiz = await fetch('https://dolarapi.com/v1/cotizaciones');
      if (resCotiz.ok) {
        const cots: any[] = await resCotiz.json();
        const brl = cots.find(c => (c.moneda || '').toUpperCase() === 'BRL');
        if (brl) {
          setRealRate({ nombre: 'Real Brasileño', compra: brl.compra, venta: brl.venta });
        }
      }

      // 3. Guaraní (PYG)
      try {
        const resPyg = await fetch('https://open.er-api.com/v6/latest/USD');
        if (resPyg.ok) {
          const pData = await resPyg.json();
          const usdToPyg = pData?.rates?.PYG;
          // Si tenemos dólar blue venta y USD/PYG, calculamos 1000 Gs en ARS
          if (usdToPyg && usdToPyg > 0) {
            // 1 USD = usdToPyg Gs. 1 USD = dolarBlue.venta ARS.
            // Entonces 1000 Gs = (1000 / usdToPyg) * dolarBlue.venta
            const blueVal = 1540; // fallback razonable
            const arsPer1000Gs = (1000 / usdToPyg) * blueVal;
            setGuaraniRate({
              compra: Math.round(arsPer1000Gs * 0.95),
              venta: Math.round(arsPer1000Gs * 1.05)
            });
          }
        }
      } catch { }

      setRatesLastUpdated(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.warn('Error al cargar cotizaciones:', e);
    } finally {
      setLoadingCurrencies(false);
    }
  }, []);

  // Cargar órdenes y clientes del backend
  const fetchData = useCallback(async () => {
    const token = getToken();
    setLoading(true);
    try {
      const [ordersRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/orders/admin/all`, { headers: { 'X-API-KEY': token } }).catch(() => null),
        fetch(`${API_URL}/api/admin/users`, { headers: { 'X-API-KEY': token } }).catch(() => null)
      ]);

      if (ordersRes && ordersRes.ok) {
        setWebOrders(await ordersRes.json());
      }
      if (usersRes && usersRes.ok) {
        setCustomers(await usersRes.json());
      }
    } catch (e) {
      console.warn('Error al cargar datos de dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchData();
    fetchCurrencies();
  }, [fetchData, fetchCurrencies]);

  // Aprobar usuario directamente desde widget
  const handleQuickApproveUser = async (userId: number) => {
    const token = getToken();
    setApprovingUserId(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/approval`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: true })
      });
      if (res.ok) {
        setCustomers(prev => prev.map(c => c.id === userId ? { ...c, is_approved: true } : c));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingUserId(null);
    }
  };

  // -------------------------------------------------------------
  // CÁLCULOS Y MÉTRICAS
  // -------------------------------------------------------------

  // 1. Pedidos Web en Revisión
  const pendingReviewOrders = useMemo(() => {
    return webOrders.filter(o => {
      const s = (o.status || '').toLowerCase();
      const p = (o.payment_status || '').toLowerCase();
      return s === 'in_review' || (s === 'pending' && p === 'pending');
    });
  }, [webOrders]);

  // 2. Envíos Pendientes de Despacho (Domicilio)
  const pendingDeliveries = useMemo(() => {
    return webOrders.filter(o => {
      const isDelivery = (o.shipping_type || 'pickup') === 'delivery';
      const status = (o.status || '').toLowerCase();
      const deliveryStatus = (o.delivery_status || 'pending').toLowerCase();
      const isBadStatus = status.includes('cancel') || status.includes('rechaz') || deliveryStatus === 'cancelled';
      return isDelivery && deliveryStatus !== 'shipped' && deliveryStatus !== 'delivered' && !isBadStatus;
    });
  }, [webOrders]);

  // 3. Retiros en Local Pendientes
  const pendingPickups = useMemo(() => {
    return webOrders.filter(o => {
      const isPickup = (o.shipping_type || 'pickup') === 'pickup';
      const status = (o.status || '').toLowerCase();
      const deliveryStatus = (o.delivery_status || 'pending').toLowerCase();
      const isBadStatus = status.includes('cancel') || status.includes('rechaz') || deliveryStatus === 'cancelled';
      return isPickup && deliveryStatus !== 'delivered' && !isBadStatus;
    });
  }, [webOrders]);

  // 4. Cobros del Mes / Cuotas pendientes
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const pendingInstallments = useMemo(() => {
    const list: Array<{
      id: string;
      source: 'mostrador' | 'web';
      clientName: string;
      clientPhone: string;
      total: number;
      pendingAmount: number;
      date: string;
      installmentsCount: number;
    }> = [];

    // Mostrador
    const ticketMap = new Map<string, any>();
    posSales.filter(s => !s.ticketId.startsWith('WEB-')).forEach(s => {
      const pending = s.pendingAmount ?? s.remainingAmount ?? 0;
      if (!ticketMap.has(s.ticketId)) {
        ticketMap.set(s.ticketId, {
          id: s.ticketId,
          source: 'mostrador' as const,
          clientName: s.clientName || 'Cliente Mostrador',
          clientPhone: s.clientPhone || '',
          total: 0,
          pendingAmount: pending,
          date: s.date,
          installmentsCount: s.installmentsCount || 1,
        });
      }
      ticketMap.get(s.ticketId).total += s.revenue;
    });

    ticketMap.forEach(item => {
      if (item.pendingAmount > 0) list.push(item);
    });

    // Web orders con saldo pendiente
    webOrders.forEach(o => {
      const status = (o.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'rejected') return;
      const tot = parseFloat(o.total || 0);
      const paid = parseFloat(o.paid_amount || 0);
      const pending = Math.max(0, tot - paid);
      if (pending > 0) {
        list.push({
          id: String(o.id || o.order_number),
          source: 'web',
          clientName: o.customer_name || 'Cliente Web',
          clientPhone: o.customer_phone || '',
          total: tot,
          pendingAmount: pending,
          date: o.created_at || '',
          installmentsCount: o.installments_count || 1,
        });
      }
    });

    return list.sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [posSales, webOrders]);

  const totalPendingDebt = useMemo(() => {
    return pendingInstallments.reduce((acc, item) => acc + item.pendingAmount, 0);
  }, [pendingInstallments]);

  // 5. Stock Bajo / Agotado
  const stockAlerts = useMemo(() => {
    const alerts: Array<{
      productId: string;
      name: string;
      sku: string;
      totalStock: number;
      isOut: boolean;
      imageUrl?: string;
    }> = [];

    products.forEach(p => {
      const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
      if (totalStock <= 3) {
        alerts.push({
          productId: p.id,
          name: p.name,
          sku: p.sku || '',
          totalStock,
          isOut: totalStock === 0,
          imageUrl: p.imageUrls?.[0]
        });
      }
    });

    return alerts.sort((a, b) => a.totalStock - b.totalStock);
  }, [products]);

  const visibleStockAlerts = useMemo(() => {
    return stockAlerts.filter(a => !dismissedStockIds.includes(a.productId));
  }, [stockAlerts, dismissedStockIds]);

  // 6. Resumen Financiero (Hoy, Esta Semana, Este Mes)
  const financeMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStartStr = todayStr.substring(0, 7);

    let todayRev = 0;
    let weekRev = 0;
    let monthRev = 0;

    let todayPos = 0;
    let todayWeb = 0;

    // Ventas mostrador
    posSales.forEach(s => {
      if (s.ticketId.startsWith('WEB-')) return;
      const sDate = s.date ? new Date(s.date) : null;
      const sDateStr = s.date ? s.date.substring(0, 10) : '';
      const amount = s.revenue || 0;

      if (sDateStr === todayStr) {
        todayRev += amount;
        todayPos += amount;
      }
      if (sDate && sDate >= sevenDaysAgo) {
        weekRev += amount;
      }
      if (sDateStr.startsWith(monthStartStr)) {
        monthRev += amount;
      }
    });

    // Pedidos web aprobados/pagados
    webOrders.forEach(o => {
      const status = (o.status || '').toLowerCase();
      const pStatus = (o.payment_status || '').toLowerCase();
      if (status === 'cancelled' || status === 'rejected') return;
      if (status === 'approved' || pStatus === 'paid' || pStatus === 'partial') {
        const oDateStr = (o.created_at || '').substring(0, 10);
        const oDate = o.created_at ? new Date(o.created_at) : null;
        const amount = parseFloat(o.total || 0);

        if (oDateStr === todayStr) {
          todayRev += amount;
          todayWeb += amount;
        }
        if (oDate && oDate >= sevenDaysAgo) {
          weekRev += amount;
        }
        if (oDateStr.startsWith(monthStartStr)) {
          monthRev += amount;
        }
      }
    });

    return {
      todayRev,
      weekRev,
      monthRev,
      todayPos,
      todayWeb
    };
  }, [posSales, webOrders]);

  // 7. Nuevos usuarios pendientes de aprobación
  const pendingApprovalUsers = useMemo(() => {
    return customers.filter(c => !c.is_approved);
  }, [customers]);

  // 8. Clientes Mayoristas
  const wholesaleMetrics = useMemo(() => {
    const now = new Date();
    const activeWholesale = customers.filter(c => {
      if (c.is_wholesale) return true;
      if (c.wholesale_until && new Date(c.wholesale_until) > now) return true;
      return false;
    });

    // Top mayoristas por volumen en web y mostrador
    const top = [...activeWholesale].slice(0, 5);

    return {
      totalActive: activeWholesale.length,
      topWholesale: top
    };
  }, [customers]);

  return (
    <div className="space-y-6 pb-12">
      {/* Saludo y Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 dark:from-slate-800 dark:via-purple-900/50 dark:to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-950/10 border border-purple-800/20">
        <div>
          <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="material-symbols-outlined text-sm">dashboard</span>
            Panel de Control General
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Buenos días, Administración
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Tenés <strong className="text-amber-300">{pendingReviewOrders.length} pedidos web</strong> por revisar,{' '}
            <strong className="text-blue-300">{pendingDeliveries.length} envíos</strong> pendientes y{' '}
            <strong className="text-emerald-300">{pendingApprovalUsers.length} solicitudes de registro</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <button
            onClick={() => { fetchData(); fetchCurrencies(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold transition-all border border-white/10 shadow-sm"
            title="Actualizar datos"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={() => setActiveView('ventas')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:from-primary/90 hover:to-pink-600 text-white text-xs font-bold transition-all shadow-lg shadow-primary/30"
          >
            <span className="material-symbols-outlined text-sm">point_of_sale</span>
            Nueva Venta
          </button>
        </div>
      </div>

      {/* Widget: Cotizaciones (Dólar Blue, Oficial, Real, Guaraní) */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">currency_exchange</span>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Cotizaciones de Monedas</h2>
              <p className="text-[11px] text-slate-400">Tipo de cambio referencial (Dólar Blue y Oficial, Real y Guaraní)</p>
            </div>
          </div>
          {ratesLastUpdated && (
            <span className="text-[11px] font-medium text-slate-400">
              Actualizado: {ratesLastUpdated} hs
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Dólar Oficial */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">USD Oficial</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">BNC</span>
            </div>
            <div className="flex items-baseline justify-between text-xs mt-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Compra</span>
                <span className="font-bold text-slate-900 dark:text-white">${dolarOficial?.compra?.toLocaleString('es-AR') ?? '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Venta</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">${dolarOficial?.venta?.toLocaleString('es-AR') ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Dólar Blue */}
          <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/30 rounded-xl p-3.5 border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                USD Blue
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">Libre</span>
            </div>
            <div className="flex items-baseline justify-between text-xs mt-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Compra</span>
                <span className="font-bold text-slate-900 dark:text-white">${dolarBlue?.compra?.toLocaleString('es-AR') ?? '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Venta</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">${dolarBlue?.venta?.toLocaleString('es-AR') ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Real Brasileño */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">BRL Real</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Brasil</span>
            </div>
            <div className="flex items-baseline justify-between text-xs mt-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Compra</span>
                <span className="font-bold text-slate-900 dark:text-white">${realRate ? Math.round(realRate.compra) : '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Venta</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">${realRate ? Math.round(realRate.venta) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Guaraní Paraguayo */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">PYG Guaraní</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">c/ 1.000 Gs</span>
            </div>
            <div className="flex items-baseline justify-between text-xs mt-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Compra</span>
                <span className="font-bold text-slate-900 dark:text-white">${guaraniRate ? guaraniRate.compra : '240'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Venta</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">${guaraniRate ? guaraniRate.venta : '265'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Widget: Accesos Rápidos Principales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setActiveView('ventas')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500 hover:shadow-md transition-all text-left group"
        >
          <div className="size-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">point_of_sale</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Nueva Venta</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Mostrador / Caja</div>
        </button>

        <button
          onClick={() => setActiveView('pedidos_web')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all text-left group relative"
        >
          {pendingReviewOrders.length > 0 && (
            <span className="absolute top-3 right-3 size-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
              {pendingReviewOrders.length}
            </span>
          )}
          <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">language</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Pedidos Web</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pendingReviewOrders.length} por revisar</div>
        </button>

        <button
          onClick={() => setActiveView('pedidos_web')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left group relative"
        >
          {pendingDeliveries.length > 0 && (
            <span className="absolute top-3 right-3 size-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">
              {pendingDeliveries.length}
            </span>
          )}
          <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">local_shipping</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Para Enviar</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pendingDeliveries.length} despachos</div>
        </button>

        <button
          onClick={() => setActiveView('pedidos_web')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all text-left group relative"
        >
          {pendingPickups.length > 0 && (
            <span className="absolute top-3 right-3 size-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
              {pendingPickups.length}
            </span>
          )}
          <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">storefront</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Retiro en Local</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pendingPickups.length} en espera</div>
        </button>

        <button
          onClick={() => setActiveView('cobros_pendientes')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all text-left group relative"
        >
          {pendingInstallments.length > 0 && (
            <span className="absolute top-3 right-3 size-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
              {pendingInstallments.length}
            </span>
          )}
          <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Cobros / Cuotas</div>
          <div className="text-[11px] text-slate-400 mt-0.5">${totalPendingDebt.toLocaleString('es-AR')}</div>
        </button>

        <button
          onClick={() => setActiveView('products')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all text-left group"
        >
          <div className="size-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">inventory_2</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Catálogo & Stock</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{products.length} productos</div>
        </button>
      </div>

      {/* Widget: Solicitudes de Registro Pendientes (Si existen) */}
      {pendingApprovalUsers.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                <span className="material-symbols-outlined text-lg">person_alert</span>
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Nuevos Usuarios Registrados Pendientes de Aprobación
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                    {pendingApprovalUsers.length} pendientes
                  </span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Debés dar de alta a estos clientes para que puedan iniciar sesión y realizar compras online.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveView('users')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 self-start sm:self-center shadow-sm"
            >
              Ver todos en Clientes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {pendingApprovalUsers.slice(0, 3).map(u => (
              <div key={u.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{u.name || 'Sin nombre'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                  {u.phone && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.phone}</p>}
                </div>
                <button
                  onClick={() => handleQuickApproveUser(u.id)}
                  disabled={approvingUserId === u.id}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all shrink-0 shadow-sm"
                >
                  {approvingUserId === u.id ? '...' : 'Aprobar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Finanzas & Cobros del Mes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumen Financiero */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">payments</span>
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Resumen Financiero y Facturación</h2>
                  <p className="text-xs text-slate-400">Ventas cobradas en Mostrador + Tienda Web</p>
                </div>
              </div>
              <button
                onClick={() => setActiveView('finanzas')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Ver Finanzas
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {/* Hoy */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ingresos Hoy</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  ${financeMetrics.todayRev.toLocaleString('es-AR')}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                  <span>POS: ${financeMetrics.todayPos.toLocaleString('es-AR')}</span>
                  <span>•</span>
                  <span>Web: ${financeMetrics.todayWeb.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Esta Semana */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Últimos 7 Días</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  ${financeMetrics.weekRev.toLocaleString('es-AR')}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>
                  Flujo semanal activo
                </div>
              </div>

              {/* Este Mes */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Ingresos Este Mes</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  ${financeMetrics.monthRev.toLocaleString('es-AR')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Acumulado del mes actual
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500">
            <span>Incluye ventas completas, pagos registrados de cuotas y pedidos web aprobados.</span>
            <button
              onClick={() => setActiveView('ventas_realizadas')}
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-primary flex items-center gap-1"
            >
              Historial de Ventas
              <span className="material-symbols-outlined text-xs">receipt_long</span>
            </button>
          </div>
        </div>

        {/* Cobros y Cuotas del Mes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Cobros del Mes</h2>
                  <p className="text-xs text-slate-400">Cuotas y saldos pendientes</p>
                </div>
              </div>
              <button
                onClick={() => setActiveView('cobros_pendientes')}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                Cobrar
              </button>
            </div>

            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 mb-3">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Total por Cobrar</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                ${totalPendingDebt.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
                {pendingInstallments.length} cliente{pendingInstallments.length !== 1 ? 's con saldos' : ' con saldo'}
              </div>
            </div>

            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {pendingInstallments.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{item.clientName}</p>
                    <p className="text-[10px] text-slate-400">{item.source === 'web' ? 'Pedido Web' : 'Mostrador'} • {item.clientPhone || 'Sin tel.'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-amber-600 dark:text-amber-400">${item.pendingAmount.toLocaleString('es-AR')}</p>
                    <span className="text-[10px] text-slate-400">Saldo</span>
                  </div>
                </div>
              ))}
              {pendingInstallments.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  ¡No hay deudas ni cuotas pendientes este mes! 🎉
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveView('cobros_pendientes')}
            className="w-full mt-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            Ver todos los cobros pendientes
          </button>
        </div>
      </div>

      {/* Grid: Tareas del Día (Para Enviar, Retiros en Local, Pedidos en Revisión) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Pedidos Web en Revisión */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse"></span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Pedidos Web en Revisión</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {pendingReviewOrders.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {pendingReviewOrders.slice(0, 4).map(o => (
                <div key={o.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">#{o.order_number}</span>
                    <span className="text-xs font-black text-primary">${parseFloat(o.total || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{o.customer_name}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span>{o.shipping_type === 'delivery' ? 'Envío a domicilio' : 'Retiro en local'}</span>
                    <span>{o.created_at ? new Date(o.created_at).toLocaleDateString('es-AR') : ''}</span>
                  </div>
                </div>
              ))}
              {pendingReviewOrders.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">done_all</span>
                  <p>Todos los pedidos web fueron revisados</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveView('pedidos_web')}
            className="w-full mt-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-all"
          >
            Ir a Pedidos Web
          </button>
        </div>

        {/* 2. Envíos por Domicilio Pendientes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500 text-base">local_shipping</span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Envíos por Despachar</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                {pendingDeliveries.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {pendingDeliveries.slice(0, 4).map(o => (
                <div key={o.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">#{o.order_number}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Sin despachar</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">{o.customer_name}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {o.customer_address || o.customer_city ? `${o.customer_address || ''} ${o.customer_city ? `(${o.customer_city})` : ''}` : 'Dirección pendiente'}
                  </p>
                </div>
              ))}
              {pendingDeliveries.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">package_2</span>
                  <p>No hay paquetes pendientes de envío</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveView('pedidos_web')}
            className="w-full mt-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition-all"
          >
            Despachar Envíos
          </button>
        </div>

        {/* 3. Retiros en Local Pendientes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-base">storefront</span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Retiros en Local</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {pendingPickups.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {pendingPickups.slice(0, 4).map(o => (
                <div key={o.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">#{o.order_number}</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">${parseFloat(o.total || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">{o.customer_name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{o.customer_phone || 'Sin teléfono'}</p>
                </div>
              ))}
              {pendingPickups.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">check_circle</span>
                  <p>No hay retiros pendientes en sucursal</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveView('pedidos_web')}
            className="w-full mt-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl transition-all"
          >
            Ver Retiros en Pedidos
          </button>
        </div>
      </div>

      {/* Grid: Alertas de Stock y Resumen Mayoristas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas de Stock Bajo o Agotado con Descarte */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">warning</span>
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Alertas de Stock Bajo / Sin Stock
                  {visibleStockAlerts.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {visibleStockAlerts.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">Podés descartar los avisos que ya viste para mantener limpio el panel</p>
              </div>
            </div>

            {dismissedStockIds.length > 0 && (
              <button
                onClick={handleResetDismissedStock}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium flex items-center gap-1 self-start sm:self-auto"
                title="Restablecer avisos descartados"
              >
                <span className="material-symbols-outlined text-xs">restore</span>
                Restablecer avisos ({dismissedStockIds.length})
              </button>
            )}
          </div>

          {visibleStockAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl text-emerald-500">inventory</span>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {stockAlerts.length > 0 ? 'Todos los avisos de stock bajo fueron descartados.' : 'El inventario se encuentra con buen nivel de stock.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {visibleStockAlerts.slice(0, 6).map(item => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-slate-400 text-sm">image</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">SKU: {item.sku || 'S/D'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                      item.isOut
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 animate-pulse'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {item.isOut ? '¡Agotado! (0)' : `${item.totalStock} unidades`}
                    </span>

                    <button
                      onClick={() => handleDismissStock(item.productId)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-xs"
                      title="Descartar aviso de este producto"
                    >
                      <span className="material-symbols-outlined text-sm">visibility_off</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-xs text-slate-400">
              Mostrando {visibleStockAlerts.length} productos con stock crítico.
            </span>
            <button
              onClick={() => setActiveView('products')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Gestionar Inventario
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Resumen de Clientes Mayoristas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">star</span>
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Clientes Mayoristas</h2>
                  <p className="text-xs text-slate-400">Cuentas con precios especiales</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {wholesaleMetrics.totalActive} Activos
              </span>
            </div>

            <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/30 rounded-xl p-3.5 mb-3">
              <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                Total de mayoristas registrados: {wholesaleMetrics.totalActive}
              </div>
              <p className="text-[11px] text-purple-700/80 dark:text-purple-300/70 mt-0.5">
                Acceden a descuentos por compra por bulto o lista mayorista de precios.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Principales Mayoristas</span>
              {wholesaleMetrics.topWholesale.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No hay clientes mayoristas activos aún.</p>
              ) : (
                wholesaleMetrics.topWholesale.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{c.email}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                      {c.is_wholesale ? 'Permanente' : '30 Días'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveView('users')}
            className="w-full mt-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl transition-all"
          >
            Ver y Administrar Mayoristas
          </button>
        </div>
      </div>
    </div>
  );
}
