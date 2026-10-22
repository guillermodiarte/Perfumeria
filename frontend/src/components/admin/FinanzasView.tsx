'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function fmt(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('es-AR');
}

function fmtDec(n: number) {
  return (Number(n) || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MONTHS = [
  { value: '01', name: 'Enero', short: 'ene' },
  { value: '02', name: 'Febrero', short: 'feb' },
  { value: '03', name: 'Marzo', short: 'mar' },
  { value: '04', name: 'Abril', short: 'abr' },
  { value: '05', name: 'Mayo', short: 'may' },
  { value: '06', name: 'Junio', short: 'jun' },
  { value: '07', name: 'Julio', short: 'jul' },
  { value: '08', name: 'Agosto', short: 'ago' },
  { value: '09', name: 'Septiembre', short: 'sep' },
  { value: '10', name: 'Octubre', short: 'oct' },
  { value: '11', name: 'Noviembre', short: 'nov' },
  { value: '12', name: 'Diciembre', short: 'dic' },
];

const YEARS = ['2026', '2027', '2028', '2029', '2030'];

function parseYearMonth(dateStr?: string | null): { year: string; month: string } | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.includes('-')) {
    const parts = s.split('T')[0].split('-');
    if (parts.length >= 2) {
      return { year: parts[0], month: parts[1].padStart(2, '0') };
    }
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      return { year: parts[2].slice(0, 4), month: parts[1].padStart(2, '0') };
    }
  }
  return null;
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const s = String(dateStr).trim();
  const ym = parseYearMonth(s);
  if (!ym) return s;
  let day = '01';
  if (s.includes('-')) {
    day = s.split('T')[0].split('-')[2] || '01';
  } else if (s.includes('/')) {
    day = s.split('/')[0] || '01';
  }
  return `${day.padStart(2, '0')}/${ym.month}`;
}

function formatFullDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
      hours = hours % 12 || 12;
      return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
    }
  } catch {}
  return formatDisplayDate(dateStr);
}

export interface ExpenseRecord {
  id: number;
  category: 'servicios' | 'insumos';
  date: string;
  title: string;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  amount: number;
  payment_method?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface SaleItemDetail {
  id: string;
  date: string;
  year: string;
  month: string;
  amount: number;
  totalAmount: number;
  pendingAmount: number;
  isWholesale: boolean;
  channel: 'mostrador' | 'web';
  clientName: string;
  itemsSummary: string;
  installmentNote?: string;
  paymentType?: string;
}

interface FinanzasViewProps {
  apiKey?: string;
  apiUrl?: string;
  currentAdminRole?: string;
  showAlert?: (msg: string) => void;
}

const COMMON_CHIPS_SERVICIOS = [
  'Luz Local',
  'Alquiler',
  'Agua / Expensas',
  'Internet / Posnet',
  'Monotributo',
  'Ingresos Brutos / Rentas',
  'Contador / Asesoría',
  'Limpieza Local',
  'Publicidad / Pauta',
];

const COMMON_CHIPS_INSUMOS = [
  'Bolsas con Logo',
  'Atomizadores Decants 5ml',
  'Atomizadores Decants 10ml',
  'Cinta de Embalar',
  'Papel de Seda / Viruta',
  'Etiquetas / Stickers',
  'Cajas para Envío',
  'Mantenimiento / Iluminación',
];

export default function FinanzasView({
  apiKey,
  apiUrl,
  currentAdminRole = '',
  showAlert = (msg: string) => alert(msg),
}: FinanzasViewProps) {
  const localPurchases = useStockFlowStore((s) => s.purchases);
  const posSales = useStockFlowStore((s) => s.sales);

  const isViewer = currentAdminRole === 'viewer';

  // ── Filtros Temporales (Mes y Año 2026-2030) ─────────────────────────────
  const now = new Date();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // ── Datos Asíncronos ────────────────────────────────────────────────────
  const [loadingDb, setLoadingDb] = useState(true);
  const [dbBatches, setDbBatches] = useState<any[]>([]);
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  // ── Filtros del Historial de Transacciones ──────────────────────────────
  const [historyFilterType, setHistoryFilterType] = useState<
    'all' | 'Ingreso' | 'Pendiente' | 'Gasto'
  >('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // ── Modales de Gastos ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [expenseFormCategory, setExpenseFormCategory] = useState<'servicios' | 'insumos'>('servicios');
  const [expenseFormDate, setExpenseFormDate] = useState<string>(
    `${selectedYear}-${selectedMonth}-${String(now.getDate()).padStart(2, '0')}`
  );
  const [expenseFormTitle, setExpenseFormTitle] = useState('');
  const [expenseFormDesc, setExpenseFormDesc] = useState('');
  const [expenseFormQty, setExpenseFormQty] = useState<string>('1');
  const [expenseFormUnitPrice, setExpenseFormUnitPrice] = useState<string>('');
  const [expenseFormTotal, setExpenseFormTotal] = useState<string>('');
  const [expenseFormPayment, setExpenseFormPayment] = useState<string>('Transferencia');
  const [savingExpense, setSavingExpense] = useState(false);

  // Modal confirmación de borrado
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState<ExpenseRecord | null>(null);

  const effectiveApiUrl = apiUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  // ── Cargar Datos (Batches, Órdenes y Gastos) ────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingDb(true);
    const token =
      apiKey ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('lyg_api_key') || localStorage.getItem('adminToken') || ''
        : '');
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-API-KEY'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const [batchesRes, ordersRes, expensesRes] = await Promise.all([
        fetch(`${effectiveApiUrl}/api/admin/purchase-batches?limit=250`, { headers }).catch(() => null),
        fetch(`${effectiveApiUrl}/api/orders/admin/all`, { headers }).catch(() => null),
        fetch(`${effectiveApiUrl}/api/admin/expenses?year=${selectedYear}`, { headers }).catch(() => null),
      ]);

      if (batchesRes && batchesRes.ok) {
        const data = await batchesRes.json();
        setDbBatches(data.batches || []);
      }
      if (ordersRes && ordersRes.ok) {
        const data = await ordersRes.json();
        setDbOrders(Array.isArray(data) ? data : []);
      }
      if (expensesRes && expensesRes.ok) {
        const expData = await expensesRes.json();
        setExpenses(Array.isArray(expData) ? expData : []);
      }
    } catch (err) {
      console.warn('[FinanzasView] Error al sincronizar datos:', err);
    } finally {
      setLoadingDb(false);
    }
  }, [apiKey, effectiveApiUrl, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actualizar fecha del formulario al cambiar mes o año
  useEffect(() => {
    const today = new Date();
    const dayStr = String(today.getDate()).padStart(2, '0');
    setExpenseFormDate(`${selectedYear}-${selectedMonth}-${dayStr}`);
  }, [selectedYear, selectedMonth]);

  // Auto-cálculo de total para Insumos
  useEffect(() => {
    if (expenseFormCategory === 'insumos') {
      const q = parseFloat(expenseFormQty) || 0;
      const u = parseFloat(expenseFormUnitPrice) || 0;
      if (q > 0 && u > 0) {
        setExpenseFormTotal(String(Math.round(q * u)));
      }
    }
  }, [expenseFormQty, expenseFormUnitPrice, expenseFormCategory]);

  // ── 1. PROCESAR VENTAS Y COBROS PENDIENTES (Mostrador + Web) ────────────
  const processedSales = useMemo<SaleItemDetail[]>(() => {
    const list: SaleItemDetail[] = [];

    // Mostrador (POS)
    const posTickets = new Map<string, typeof posSales>();
    posSales.forEach((s) => {
      if (s.ticketId && s.ticketId.startsWith('WEB-')) return;
      const tId = s.ticketId || `TICK-${s.id}`;
      if (!posTickets.has(tId)) posTickets.set(tId, []);
      posTickets.get(tId)!.push(s);
    });

    posTickets.forEach((records, tId) => {
      const first = records[0];
      if (first.status === 'Cancelada') return;

      const ym = parseYearMonth(first.date);
      if (!ym) return;

      const itemsRev = records.reduce((acc, r) => acc + (r.revenue || 0), 0);
      const isFullyPaid = first.status === 'Pagada' || first.paymentStatus === 'full';
      const explicitPending = first.pendingAmount ?? first.remainingAmount;
      const pendingClamped = isFullyPaid
        ? 0
        : explicitPending !== undefined
        ? Math.max(0, Number(explicitPending))
        : 0;

      const paidClamped = isFullyPaid
        ? itemsRev
        : first.paidAmount !== undefined
        ? Math.min(itemsRev, Math.max(0, Number(first.paidAmount)))
        : Math.max(0, itemsRev - pendingClamped);

      const isWholesale = Boolean(
        first.isWholesale || records.some((r) => r.isWholesale || (r as any).saleType === 'mayorista')
      );

      let installmentNote: string | undefined = undefined;
      if (paidClamped > 0 && pendingClamped > 0) {
        if (first.installmentsCount && first.installmentsCount > 1) {
          const monthly =
            first.installmentMonthlyAmount || Math.round(itemsRev / first.installmentsCount);
          const cuotaNum = Math.min(
            first.installmentsCount,
            Math.max(1, Math.round(paidClamped / (monthly || 1)))
          );
          installmentNote = `${cuotaNum}° cuota pagada ($${fmt(paidClamped)} de $${fmt(itemsRev)} total)`;
        } else {
          installmentNote = `Pago parcial de $${fmt(paidClamped)} de $${fmt(itemsRev)} total`;
        }
      }

      list.push({
        id: `pos-${tId}`,
        date: first.date || '',
        year: ym.year,
        month: ym.month,
        amount: paidClamped,
        totalAmount: itemsRev,
        pendingAmount: pendingClamped,
        isWholesale,
        channel: 'mostrador',
        clientName: first.clientName || 'Consumidor Final',
        itemsSummary: records.map((r) => `${r.quantity}x ${r.productName}`).join(', '),
        installmentNote,
        paymentType: first.paymentType,
      });
    });

    // Pedidos Web
    dbOrders.forEach((o: any) => {
      const st = (o.status || '').toLowerCase();
      if (st.includes('cancel') || st.includes('rechaz')) return;

      const ym = parseYearMonth(o.created_at || o.date);
      if (!ym) return;

      const totalItems = Array.isArray(o.items)
        ? o.items.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 1)), 0)
        : Number(o.total || 0);

      const isPaid = (o.payment_status || '').toLowerCase() === 'paid';
      const paid = isPaid ? totalItems : Math.min(totalItems, Math.max(0, Number(o.paid_amount || 0)));
      const pending = Math.max(0, totalItems - paid);

      const isWholesale = Boolean(
        o.is_wholesale || o.customer?.is_wholesale || (o.customer?.customer_type || '').includes('wholesale')
      );

      list.push({
        id: `web-${o.order_number || o.id}`,
        date: o.created_at || '',
        year: ym.year,
        month: ym.month,
        amount: paid,
        totalAmount: totalItems,
        pendingAmount: pending,
        isWholesale,
        channel: 'web',
        clientName: o.customer?.name || o.shipping_address_json?.name || 'Cliente Web',
        itemsSummary: Array.isArray(o.items)
          ? o.items.map((it: any) => `${it.quantity}x ${it.product_name}`).join(', ')
          : `Orden #${o.order_number}`,
        paymentType: o.payment_type,
      });
    });

    return list;
  }, [posSales, dbOrders]);

  // ── 2. PROCESAR COMPRAS DE MERCADERÍA ────────────────────────────────────
  const processedPurchases = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      year: string;
      month: string;
      supplier: string;
      itemsCount: number;
      totalCost: number;
    }> = [];

    if (dbBatches.length > 0) {
      dbBatches.forEach((b: any) => {
        const batchDate = b.purchase_date || b.created_at || '';
        const ym = parseYearMonth(batchDate);
        if (!ym) return;
        const total = Number(b.total_cost_ars || 0);
        list.push({
          id: `batch-${b.id}`,
          date: batchDate,
          year: ym.year,
          month: ym.month,
          supplier: b.supplier?.name || b.supplier_name || `Lote ${b.batch_number}`,
          itemsCount: b.items_count || (Array.isArray(b.items) ? b.items.length : 1),
          totalCost: total,
        });
      });
    } else {
      localPurchases.forEach((p) => {
        const ym = parseYearMonth(p.date);
        if (!ym) return;
        list.push({
          id: `local-pch-${p.id}`,
          date: p.date,
          year: ym.year,
          month: ym.month,
          supplier: p.supplierName || 'Ingreso a stock',
          itemsCount: p.quantity || 1,
          totalCost: p.totalCost || 0,
        });
      });
    }

    return list;
  }, [dbBatches, localPurchases]);

  // ── 3. FILTRADO DEL MES SELECCIONADO ────────────────────────────────────
  const currentMonthSales = useMemo(() => {
    return processedSales.filter((s) => s.year === selectedYear && s.month === selectedMonth);
  }, [processedSales, selectedYear, selectedMonth]);

  const currentMonthPendingSales = useMemo(() => {
    return currentMonthSales.filter((s) => s.pendingAmount > 0);
  }, [currentMonthSales]);

  const currentMonthPurchases = useMemo(() => {
    return processedPurchases.filter((p) => p.year === selectedYear && p.month === selectedMonth);
  }, [processedPurchases, selectedYear, selectedMonth]);

  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const ym = parseYearMonth(e.date);
      return ym && ym.year === selectedYear && ym.month === selectedMonth;
    });
  }, [expenses, selectedYear, selectedMonth]);

  const currentMonthServicios = useMemo(() => {
    return currentMonthExpenses.filter((e) => e.category === 'servicios');
  }, [currentMonthExpenses]);

  const currentMonthInsumos = useMemo(() => {
    return currentMonthExpenses.filter((e) => e.category === 'insumos');
  }, [currentMonthExpenses]);

  // ── 4. TOTALES Y KPIS DEL MES ───────────────────────────────────────────
  const totalIncomeMonth = useMemo(() => {
    return currentMonthSales.reduce((acc, s) => acc + s.amount, 0);
  }, [currentMonthSales]);

  const totalPendingMonth = useMemo(() => {
    return currentMonthPendingSales.reduce((acc, s) => acc + s.pendingAmount, 0);
  }, [currentMonthPendingSales]);

  const totalPendingAllTime = useMemo(() => {
    return processedSales.reduce((acc, s) => acc + s.pendingAmount, 0);
  }, [processedSales]);

  const totalServiciosMonth = useMemo(() => {
    return currentMonthServicios.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [currentMonthServicios]);

  const totalInsumosMonth = useMemo(() => {
    return currentMonthInsumos.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [currentMonthInsumos]);

  const totalPurchasesMonth = useMemo(() => {
    return currentMonthPurchases.reduce((acc, p) => acc + p.totalCost, 0);
  }, [currentMonthPurchases]);

  const totalExpensesMonth = useMemo(() => {
    return totalServiciosMonth + totalInsumosMonth + totalPurchasesMonth;
  }, [totalServiciosMonth, totalInsumosMonth, totalPurchasesMonth]);

  const netProfitMonth = totalIncomeMonth - totalExpensesMonth;
  const netMarginPercent =
    totalIncomeMonth > 0 ? ((netProfitMonth / totalIncomeMonth) * 100).toFixed(1) : '0';

  // ── 5. DATOS PARA GRÁFICOS ──────────────────────────────────────────────

  // A. Gastos por Tipo (Donut Chart)
  const donutExpensesData = useMemo(() => {
    const data = [
      { name: 'Mercadería', value: Math.round(totalPurchasesMonth), color: '#a855f7' },
      { name: 'Impuestos / Servicios', value: Math.round(totalServiciosMonth), color: '#06b6d4' },
      { name: 'Insumos / Mant.', value: Math.round(totalInsumosMonth), color: '#0284c7' },
    ];
    return data.filter((d) => d.value > 0);
  }, [totalPurchasesMonth, totalServiciosMonth, totalInsumosMonth]);

  // B. Canales de Venta del Mes
  const channelsData = useMemo(() => {
    let mostrador = 0;
    let web = 0;
    let mayorista = 0;

    currentMonthSales.forEach((s) => {
      if (s.isWholesale) {
        mayorista += s.amount;
      } else if (s.channel === 'web') {
        web += s.amount;
      } else {
        mostrador += s.amount;
      }
    });

    return [
      { name: 'Mostrador', total: Math.round(mostrador), color: '#3b82f6' },
      { name: 'Web', total: Math.round(web), color: '#10b981' },
      { name: 'Mayorista', total: Math.round(mayorista), color: '#f59e0b' },
    ];
  }, [currentMonthSales]);

  // C. Comparativa: Ingresos vs Pendientes vs Gastos (12 Meses del Año Seleccionado)
  const annualComparisonData = useMemo(() => {
    return MONTHS.map((m) => {
      const monthSales = processedSales.filter((s) => s.year === selectedYear && s.month === m.value);
      const monthIncome = monthSales.reduce((acc, s) => acc + s.amount, 0);
      const monthPending = monthSales.reduce((acc, s) => acc + s.pendingAmount, 0);

      const monthPurchases = processedPurchases
        .filter((p) => p.year === selectedYear && p.month === m.value)
        .reduce((acc, p) => acc + p.totalCost, 0);

      const monthOtherExpenses = expenses
        .filter((e) => {
          const ym = parseYearMonth(e.date);
          return ym && ym.year === selectedYear && ym.month === m.value;
        })
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      const monthExpenses = monthPurchases + monthOtherExpenses;

      return {
        name: m.short,
        fullName: m.name,
        ingresos: Math.round(monthIncome),
        pendientes: Math.round(monthPending),
        gastos: Math.round(monthExpenses),
      };
    });
  }, [selectedYear, processedSales, processedPurchases, expenses]);

  // ── 6. HISTORIAL UNIFICADO DE TRANSACCIONES (Para el Mes Seleccionado) ────
  interface UnifiedTx {
    id: string;
    rawDate: string;
    date: string;
    type: 'Ingreso' | 'Pendiente' | 'Gasto';
    badgeLabel: string;
    title: string;
    description: string;
    amount: number;
    totalAmount?: number;
    pendingAmount?: number;
    isWholesale?: boolean;
    channel?: string;
    installmentNote?: string;
  }

  const unifiedTransactions = useMemo<UnifiedTx[]>(() => {
    const list: UnifiedTx[] = [];

    // 1. Ingresos y Pendientes de Ventas
    currentMonthSales.forEach((s) => {
      const isPurePending = s.amount === 0 && s.pendingAmount > 0;
      const isPartial = s.amount > 0 && s.pendingAmount > 0;

      if (isPurePending) {
        list.push({
          id: s.id,
          rawDate: s.date,
          date: formatFullDateTime(s.date),
          type: 'Pendiente',
          badgeLabel: 'PENDIENTE',
          title: `${s.channel === 'web' ? 'Pedido Web' : 'Venta Mostrador'} #${s.id.replace('pos-', '').replace('web-', '')} (${s.itemsSummary}) a ${s.clientName}`,
          description: `Total adeudado: $${fmt(s.pendingAmount)} (Pendiente de cobro)`,
          amount: 0,
          totalAmount: s.totalAmount,
          pendingAmount: s.pendingAmount,
          isWholesale: s.isWholesale,
          channel: s.channel,
          installmentNote: s.installmentNote,
        });
      } else {
        list.push({
          id: s.id,
          rawDate: s.date,
          date: formatFullDateTime(s.date),
          type: 'Ingreso',
          badgeLabel: 'INGRESO',
          title: `${s.channel === 'web' ? 'Pedido Web' : 'Venta Mostrador'} #${s.id.replace('pos-', '').replace('web-', '')} (${s.itemsSummary}) a ${s.clientName}`,
          description: isPartial
            ? `Cobrado: $${fmt(s.amount)} • Saldo pendiente: $${fmt(s.pendingAmount)}${s.installmentNote ? ` (${s.installmentNote})` : ''}`
            : `Venta cobrada totalmente en ${s.channel === 'web' ? 'tienda web' : 'caja local'}`,
          amount: s.amount,
          totalAmount: s.totalAmount,
          pendingAmount: s.pendingAmount,
          isWholesale: s.isWholesale,
          channel: s.channel,
          installmentNote: s.installmentNote,
        });

        // Si es pago parcial, agregar también una entrada al filtro de pendientes
        if (isPartial) {
          list.push({
            id: `${s.id}-pending`,
            rawDate: s.date,
            date: formatFullDateTime(s.date),
            type: 'Pendiente',
            badgeLabel: 'PENDIENTE',
            title: `${s.channel === 'web' ? 'Pedido Web' : 'Venta Mostrador'} #${s.id.replace('pos-', '').replace('web-', '')} a ${s.clientName}`,
            description: `Saldo pendiente: $${fmt(s.pendingAmount)} (de $${fmt(s.totalAmount)} total)`,
            amount: s.amount,
            totalAmount: s.totalAmount,
            pendingAmount: s.pendingAmount,
            isWholesale: s.isWholesale,
            channel: s.channel,
            installmentNote: s.installmentNote,
          });
        }
      }
    });

    // 2. Gastos en Compras de Mercadería
    currentMonthPurchases.forEach((p) => {
      list.push({
        id: p.id,
        rawDate: p.date,
        date: formatFullDateTime(p.date),
        type: 'Gasto',
        badgeLabel: 'GASTO',
        title: `Compra de Mercadería: ${p.supplier} (${p.itemsCount} ítems)`,
        description: 'Ingreso de stock / lote a proveedores',
        amount: p.totalCost,
      });
    });

    // 3. Gastos de Impuestos y Servicios
    currentMonthServicios.forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        rawDate: e.date,
        date: formatFullDateTime(e.date),
        type: 'Gasto',
        badgeLabel: 'GASTO',
        title: `Servicio: ${e.title}`,
        description: e.description || (e.payment_method ? `Pago: ${e.payment_method}` : 'Impuestos y Servicios'),
        amount: Number(e.amount),
      });
    });

    // 4. Gastos de Insumos y Mantenimiento
    currentMonthInsumos.forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        rawDate: e.date,
        date: formatFullDateTime(e.date),
        type: 'Gasto',
        badgeLabel: 'GASTO',
        title: `Insumos: ${e.title}${e.quantity && e.quantity > 1 ? ` (${e.quantity} uds)` : ''}`,
        description: e.description || (e.payment_method ? `Pago: ${e.payment_method}` : 'Insumos y Mantenimiento'),
        amount: Number(e.amount),
      });
    });

    // Ordenar por fecha descendente
    return list.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || ''));
  }, [currentMonthSales, currentMonthPurchases, currentMonthServicios, currentMonthInsumos]);

  const filteredUnifiedTransactions = useMemo(() => {
    return unifiedTransactions.filter((t) => {
      if (historyFilterType === 'Ingreso' && t.type !== 'Ingreso') return false;
      if (historyFilterType === 'Pendiente' && t.type !== 'Pendiente') return false;
      if (historyFilterType === 'Gasto' && t.type !== 'Gasto') return false;

      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.installmentNote && t.installmentNote.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [unifiedTransactions, historyFilterType, historySearchQuery]);

  const countHistoryIngresos = useMemo(
    () => unifiedTransactions.filter((t) => t.type === 'Ingreso').length,
    [unifiedTransactions]
  );
  const countHistoryPendientes = useMemo(
    () => unifiedTransactions.filter((t) => t.type === 'Pendiente').length,
    [unifiedTransactions]
  );
  const countHistoryGastos = useMemo(
    () => unifiedTransactions.filter((t) => t.type === 'Gasto').length,
    [unifiedTransactions]
  );

  // ── 7. HANDLERS PARA AGREGAR / EDITAR / ELIMINAR GASTOS ─────────────────
  const openNewExpenseModal = (category: 'servicios' | 'insumos' = 'servicios') => {
    setEditingExpense(null);
    setExpenseFormCategory(category);
    const dayStr = String(now.getDate()).padStart(2, '0');
    setExpenseFormDate(`${selectedYear}-${selectedMonth}-${dayStr}`);
    setExpenseFormTitle('');
    setExpenseFormDesc('');
    setExpenseFormQty('1');
    setExpenseFormUnitPrice('');
    setExpenseFormTotal('');
    setExpenseFormPayment('Transferencia');
    setIsModalOpen(true);
  };

  const openEditExpenseModal = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setExpenseFormCategory(exp.category);
    setExpenseFormDate(exp.date ? exp.date.slice(0, 10) : `${selectedYear}-${selectedMonth}-01`);
    setExpenseFormTitle(exp.title || '');
    setExpenseFormDesc(exp.description || '');
    setExpenseFormQty(String(exp.quantity || 1));
    setExpenseFormUnitPrice(exp.unit_price ? String(exp.unit_price) : '');
    setExpenseFormTotal(String(exp.amount || ''));
    setExpenseFormPayment(exp.payment_method || 'Transferencia');
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseFormTitle.trim()) {
      showAlert('Por favor ingresa un detalle o concepto para el gasto');
      return;
    }

    const totalNum = parseFloat(expenseFormTotal);
    if (isNaN(totalNum) || totalNum <= 0) {
      showAlert('El monto total debe ser mayor a 0');
      return;
    }

    setSavingExpense(true);
    const token =
      apiKey ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('lyg_api_key') || localStorage.getItem('adminToken') || ''
        : '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['X-API-KEY'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = {
      category: expenseFormCategory,
      date: expenseFormDate,
      title: expenseFormTitle.trim(),
      description: expenseFormDesc.trim() || null,
      quantity: expenseFormCategory === 'insumos' ? parseFloat(expenseFormQty) || 1 : null,
      unit_price: expenseFormCategory === 'insumos' ? parseFloat(expenseFormUnitPrice) || 0 : null,
      amount: totalNum,
      payment_method: expenseFormPayment,
    };

    try {
      const url = editingExpense
        ? `${effectiveApiUrl}/api/admin/expenses/${editingExpense.id}`
        : `${effectiveApiUrl}/api/admin/expenses`;
      const method = editingExpense ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al guardar el gasto');
      }

      setIsModalOpen(false);
      showAlert(editingExpense ? 'Gasto actualizado con éxito' : 'Gasto registrado correctamente');
      fetchData();
    } catch (err: any) {
      showAlert(err.message || 'Error de conexión');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteConfirmExpense) return;
    const token =
      apiKey ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('lyg_api_key') || localStorage.getItem('adminToken') || ''
        : '');
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-API-KEY'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${effectiveApiUrl}/api/admin/expenses/${deleteConfirmExpense.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al eliminar el gasto');
      }

      setDeleteConfirmExpense(null);
      showAlert('Gasto eliminado');
      fetchData();
    } catch (err: any) {
      showAlert(err.message || 'Error de conexión');
    }
  };

  // ── 8. EXPORTAR REPORTE CSV ─────────────────────────────────────────────
  const exportMonthReportCsv = () => {
    const monthObj = MONTHS.find((m) => m.value === selectedMonth);
    const monthName = monthObj ? monthObj.name : selectedMonth;

    let csv = `\uFEFFReporte de Finanzas — ${monthName} ${selectedYear}\n\n`;
    csv += `RESUMEN DEL MES\n`;
    csv += `Ingresos Totales (Cobrados);$${fmtDec(totalIncomeMonth)}\n`;
    csv += `Cobros Pendientes del Mes;$${fmtDec(totalPendingMonth)}\n`;
    csv += `Cobros Pendientes Históricos;$${fmtDec(totalPendingAllTime)}\n`;
    csv += `Gastos en Compras de Mercadería;$${fmtDec(totalPurchasesMonth)}\n`;
    csv += `Gastos en Impuestos y Servicios;$${fmtDec(totalServiciosMonth)}\n`;
    csv += `Gastos en Insumos y Mantenimiento;$${fmtDec(totalInsumosMonth)}\n`;
    csv += `GASTOS TOTALES;-$${fmtDec(totalExpensesMonth)}\n`;
    csv += `GANANCIA REAL;$${fmtDec(netProfitMonth)} (${netMarginPercent}%)\n\n`;

    csv += `COBROS PENDIENTES DEL MES\n`;
    csv += `Fecha;Cliente;Canal;Total Venta;Cobrado;Saldo Pendiente;Nota\n`;
    currentMonthPendingSales.forEach((s) => {
      csv += `${formatDisplayDate(s.date)};"${s.clientName}";"${s.channel}";$${fmtDec(s.totalAmount)};$${fmtDec(s.amount)};$${fmtDec(s.pendingAmount)};"${s.installmentNote || ''}"\n`;
    });
    csv += `TOTAL PENDIENTE DEL MES;;;;;-$${fmtDec(totalPendingMonth)}\n\n`;

    csv += `IMPUESTOS Y SERVICIOS\n`;
    csv += `Fecha;Detalle;Forma de Pago;Total\n`;
    currentMonthServicios.forEach((e) => {
      csv += `${formatDisplayDate(e.date)};"${e.title}";"${e.payment_method || ''}";$${fmtDec(e.amount)}\n`;
    });
    csv += `TOTAL SERVICIOS;;;-$${fmtDec(totalServiciosMonth)}\n\n`;

    csv += `INSUMOS Y MANTENIMIENTO\n`;
    csv += `Fecha;Detalle;Cantidad;P. Unitario;Total\n`;
    currentMonthInsumos.forEach((e) => {
      csv += `${formatDisplayDate(e.date)};"${e.title}";${e.quantity || 1};$${fmtDec(e.unit_price || 0)};$${fmtDec(e.amount)}\n`;
    });
    csv += `TOTAL INSUMOS;;;;-$${fmtDec(totalInsumosMonth)}\n\n`;

    csv += `COMPRAS DE MERCADERÍA / PROVEEDORES\n`;
    csv += `Fecha;Proveedor / Lote;Ítems;Total Costo\n`;
    currentMonthPurchases.forEach((p) => {
      csv += `${formatDisplayDate(p.date)};"${p.supplier}";${p.itemsCount};$${fmtDec(p.totalCost)}\n`;
    });
    csv += `TOTAL MERCADERÍA;;;-$${fmtDec(totalPurchasesMonth)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Finanzas_${monthName}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedMonthObj = MONTHS.find((m) => m.value === selectedMonth);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ═══ CABECERA Y FILTROS TEMPORALES ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Finanzas
            </h1>
            {loadingDb && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full animate-pulse">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                Sincronizando
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Balance operativo, control de ingresos, cobros pendientes, compras y gastos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Mes */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 transition cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
              expand_more
            </span>
          </div>

          {/* Selector de Año (2026 - 2030) */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 transition cursor-pointer focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
              expand_more
            </span>
          </div>

          {/* Exportar Reporte */}
          <button
            type="button"
            onClick={exportMonthReportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-700 transition"
            title="Exportar resumen de finanzas a CSV/Excel"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar</span>
          </button>

          {/* Botón Principal: + Agregar Gasto */}
          {!isViewer && (
            <button
              type="button"
              onClick={() => openNewExpenseModal('servicios')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs sm:text-sm rounded-2xl shadow-sm hover:shadow transition"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Agregar Gasto</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ FILA 1: 4 TARJETAS KPIS SIMÉTRICAS (Como en la versión previa) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Ventas de Mercadería (Ingresos Cobrados) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-800/60 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              Ventas de Mercadería
            </span>
            <span className="size-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              ${fmt(totalIncomeMonth)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span>{currentMonthSales.filter((s) => s.amount > 0).length} ventas cobradas</span>
          </div>
        </div>

        {/* 2. Cobros Pendientes (En Amarillo/Ámbar destacado) */}
        <div className="bg-amber-50/70 dark:bg-amber-950/20 rounded-3xl p-4 sm:p-5 border border-amber-200 dark:border-amber-800/60 shadow-sm relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-700/80 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
              Cobros Pendientes
            </span>
            <span className="size-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl">pending_actions</span>
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl lg:text-2xl font-black text-amber-900 dark:text-amber-200 tracking-tight font-mono">
              ${fmt(totalPendingMonth)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-amber-700/80 dark:text-amber-400/80 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
            <span>{currentMonthPendingSales.length} operaciones con saldo</span>
            {totalPendingAllTime > totalPendingMonth && (
              <span className="text-[10px] font-bold" title="Total acumulado histórico de cobros pendientes">
                ${fmt(totalPendingAllTime)} total
              </span>
            )}
          </div>
        </div>

        {/* 3. Gastos (Compras + Op.) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-300 dark:hover:border-rose-800/60 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              Gastos Totales
            </span>
            <span className="size-9 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl">shopping_cart</span>
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              ${fmt(totalExpensesMonth)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span>Stock + Servicios + Insumos</span>
          </div>
        </div>

        {/* 4. Ganancia Real Efectiva */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Ganancia Real
              </span>
              {totalIncomeMonth > 0 && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    netProfitMonth >= 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {netMarginPercent}%
                </span>
              )}
            </div>
            <span
              className={`size-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                netProfitMonth >= 0
                  ? 'bg-primary/10 text-primary'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-xl">monitoring</span>
            </span>
          </div>
          <div className="mt-2.5">
            <span
              className={`text-lg sm:text-xl lg:text-2xl font-black tracking-tight font-mono ${
                netProfitMonth >= 0 ? 'text-primary' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {netProfitMonth >= 0 ? '$ ' : '-$ '}
              {fmt(Math.abs(netProfitMonth))}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span>Balance del período</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {netProfitMonth >= 0 ? 'Superávit' : 'Déficit'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ FILA 2: GRÁFICOS Y ANÁLISIS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Ingresos por Canal (Mes) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Ingresos por Canal ({selectedMonthObj?.name})
              </h3>
              <p className="text-[11px] text-slate-400">Distribución de facturación por canal</p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-lg">storefront</span>
          </div>

          <div className="h-48 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any) => [`$${fmt(Number(val))}`, 'Total']}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={38}>
                  {channelsData.map((entry, index) => (
                    <Cell key={`channel-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            {channelsData.map((c) => (
              <div key={c.name} className="px-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">{c.name}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ${fmt(c.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Gastos por Tipo (Mes) [Donut Chart] */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Gastos por Tipo ({selectedMonthObj?.name})
              </h3>
              <p className="text-[11px] text-slate-400">Desglose de egresos operativos</p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-lg">pie_chart</span>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center">
            {donutExpensesData.length === 0 ? (
              <div className="text-center text-slate-400 text-xs">
                No hay gastos registrados en {selectedMonthObj?.name} {selectedYear}
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutExpensesData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {donutExpensesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '11px',
                      }}
                      formatter={(val: any, name: any) => [`$${fmt(Number(val))}`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    ${fmt(totalExpensesMonth)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-purple-500"></span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Mercadería</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-cyan-500"></span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Impuestos / Servicios</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500"></span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">Insumos / Mant.</span>
            </div>
          </div>
        </div>

        {/* Gráfico 3: Comparativa: Ingresos vs Pendientes vs Gastos (Exacto como en la imagen previa) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">bar_chart</span>
                Comparativa Anual ({selectedYear})
              </h3>
              <p className="text-[11px] text-slate-400">Ingresos vs Pendientes vs Gastos</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="size-2 rounded-full bg-emerald-500"></span> Cobrados
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                <span className="size-2 rounded-full bg-amber-500"></span> Pendientes
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                <span className="size-2 rounded-full bg-rose-500"></span> Gastos
              </span>
            </div>
          </div>

          <div className="h-48 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, name: any) => [
                    `$${fmt(Number(val))}`,
                    name === 'ingresos'
                      ? 'Ingresos (Cobrados)'
                      : name === 'pendientes'
                      ? 'Cobros Pendientes'
                      : 'Gastos',
                  ]}
                  labelFormatter={(l: any, payload: any) => {
                    const it = payload && payload[0] ? payload[0].payload : null;
                    return it ? `${it.fullName} ${selectedYear}` : l;
                  }}
                />
                <Bar dataKey="gastos" name="gastos" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={8} />
                <Bar dataKey="pendientes" name="pendientes" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={8} />
                <Bar dataKey="ingresos" name="ingresos" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Mes activo: <b className="text-slate-800 dark:text-white">{selectedMonthObj?.name}</b></span>
            <span>Año: <b className="text-slate-800 dark:text-white">{selectedYear}</b></span>
          </div>
        </div>
      </div>

      {/* ═══ FILA 3: COBROS PENDIENTES DEL MES (Tarjeta Específica) ═══ */}
      <div className="bg-amber-50/40 dark:bg-amber-950/15 rounded-3xl p-5 border border-amber-200/80 dark:border-amber-800/60 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-amber-200/60 dark:border-amber-800/60 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl">pending_actions</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200">
                  Cobros Pendientes y Cuotas ({selectedMonthObj?.name})
                </h3>
                <span className="text-[11px] font-bold bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
                  {currentMonthPendingSales.length}
                </span>
              </div>
              <p className="text-[11px] text-amber-800/70 dark:text-amber-400/80">
                Ventas de mostrador y pedidos web con saldo a cobrar en el período
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Total Pendiente Mes: <b className="font-mono text-sm">${fmt(totalPendingMonth)}</b>
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-amber-900/60 dark:text-amber-400/60 uppercase text-[10px] tracking-wider border-b border-amber-200/40 dark:border-amber-800/40">
                <th className="py-2 px-2 font-bold">Fecha</th>
                <th className="py-2 px-2 font-bold">Canal</th>
                <th className="py-2 px-2 font-bold">Cliente</th>
                <th className="py-2 px-2 font-bold">Detalle / Cuotas</th>
                <th className="py-2 px-2 font-bold text-right">Total Venta</th>
                <th className="py-2 px-2 font-bold text-right">Cobrado</th>
                <th className="py-2 px-2 font-bold text-right text-amber-900 dark:text-amber-300">
                  Saldo Pendiente
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/30 dark:divide-amber-800/30">
              {currentMonthPendingSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-amber-800/60 dark:text-amber-400/60 text-xs italic">
                    ¡Excelente! No hay ventas con saldo pendiente registradas en {selectedMonthObj?.name} {selectedYear}
                  </td>
                </tr>
              ) : (
                currentMonthPendingSales.map((s) => (
                  <tr key={s.id} className="hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition">
                    <td className="py-2.5 px-2 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDisplayDate(s.date)}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          s.channel === 'web'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        }`}
                      >
                        {s.channel === 'web' ? 'Web' : 'Caja'}
                      </span>
                      {s.isWholesale && (
                        <span className="ml-1 inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">
                          Mayorista
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-slate-100">
                      {s.clientName}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate max-w-xs">
                        {s.itemsSummary}
                      </span>
                      {s.installmentNote && (
                        <span className="inline-block text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-1.5 py-0.2 rounded mt-0.5">
                          {s.installmentNote}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      ${fmt(s.totalAmount)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      ${fmt(s.amount)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-amber-900 dark:text-amber-200 text-xs sm:text-sm whitespace-nowrap">
                      ${fmt(s.pendingAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ FILA 4: TABLAS DE GASTOS DESGLOSADAS (Impuestos y Servicios + Insumos y Mantenimiento) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── TABLA A: Impuestos y Servicios ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="size-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">receipt</span>
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Impuestos y Servicios
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Luz, alquiler, internet, tributos y servicios fijos
                  </p>
                </div>
              </div>

              {!isViewer && (
                <button
                  type="button"
                  onClick={() => openNewExpenseModal('servicios')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 font-bold text-xs transition border border-cyan-200 dark:border-cyan-800"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Agregar</span>
                </button>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2 px-2 font-bold">Fecha</th>
                    <th className="py-2 px-2 font-bold">Detalle</th>
                    <th className="py-2 px-2 font-bold text-right">Total</th>
                    {!isViewer && <th className="py-2 px-2 font-bold text-center w-16">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentMonthServicios.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isViewer ? 3 : 4}
                        className="py-8 text-center text-slate-400 text-xs italic"
                      >
                        No hay impuestos ni servicios cargados en {selectedMonthObj?.name} {selectedYear}
                      </td>
                    </tr>
                  ) : (
                    currentMonthServicios.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-2 font-semibold text-slate-500 whitespace-nowrap">
                          {formatDisplayDate(exp.date)}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            {exp.title}
                          </span>
                          {exp.payment_method && (
                            <span className="inline-block text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1.5 py-0.2 rounded font-medium mt-0.5">
                              {exp.payment_method}
                            </span>
                          )}
                          {exp.description && (
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-xs">
                              {exp.description}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          ${fmt(exp.amount)}
                        </td>
                        {!isViewer && (
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditExpenseModal(exp)}
                                className="size-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                                title="Editar"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmExpense(exp)}
                                className="size-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition"
                                title="Eliminar"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Subtotal Servicios:</span>
            <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
              -${fmt(totalServiciosMonth)}
            </span>
          </div>
        </div>

        {/* ── TABLA B: Insumos y Mantenimiento ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="size-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">inventory_2</span>
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Insumos y Mantenimiento
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bolsas, atomizadores para decants, packaging y arreglos
                  </p>
                </div>
              </div>

              {!isViewer && (
                <button
                  type="button"
                  onClick={() => openNewExpenseModal('insumos')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs transition border border-blue-200 dark:border-blue-800"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Agregar</span>
                </button>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2 px-2 font-bold">Fecha</th>
                    <th className="py-2 px-2 font-bold">Detalle</th>
                    <th className="py-2 px-2 font-bold text-center">Cant.</th>
                    <th className="py-2 px-2 font-bold text-right">P. Unit</th>
                    <th className="py-2 px-2 font-bold text-right">Total</th>
                    {!isViewer && <th className="py-2 px-2 font-bold text-center w-16">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentMonthInsumos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isViewer ? 5 : 6}
                        className="py-8 text-center text-slate-400 text-xs italic"
                      >
                        No hay insumos ni mantenimiento cargados en {selectedMonthObj?.name} {selectedYear}
                      </td>
                    </tr>
                  ) : (
                    currentMonthInsumos.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-2 font-semibold text-slate-500 whitespace-nowrap">
                          {formatDisplayDate(exp.date)}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">
                            {exp.title}
                          </span>
                          {exp.payment_method && (
                            <span className="inline-block text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded font-medium mt-0.5">
                              {exp.payment_method}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-600 dark:text-slate-300">
                          {exp.quantity || 1}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500 whitespace-nowrap">
                          {exp.unit_price ? `$${fmt(exp.unit_price)}` : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          ${fmt(exp.amount)}
                        </td>
                        {!isViewer && (
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditExpenseModal(exp)}
                                className="size-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                                title="Editar"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmExpense(exp)}
                                className="size-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition"
                                title="Eliminar"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Subtotal Insumos:</span>
            <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
              -${fmt(totalInsumosMonth)}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ FILA 5: COMPRAS DE MERCADERÍA / PROVEEDORES DEL MES ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">local_shipping</span>
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Compras de Mercadería y Stock ({selectedMonthObj?.name})
              </h3>
              <p className="text-[11px] text-slate-400">
                Lotes ingresados de perfumes, combos y productos
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-xl">
            {currentMonthPurchases.length} lotes
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="py-2 px-2 font-bold">Fecha</th>
                <th className="py-2 px-2 font-bold">Proveedor / Lote</th>
                <th className="py-2 px-2 font-bold text-center">Unidades / Ítems</th>
                <th className="py-2 px-2 font-bold text-right">Total Invertido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {currentMonthPurchases.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 text-xs italic">
                    No hay ingresos de mercadería registrados en {selectedMonthObj?.name} {selectedYear}
                  </td>
                </tr>
              ) : (
                currentMonthPurchases.map((pch) => (
                  <tr key={pch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-2 font-semibold text-slate-500 whitespace-nowrap">
                      {formatDisplayDate(pch.date)}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">
                      {pch.supplier}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300 font-bold">
                      {pch.itemsCount} uds.
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      -${fmt(pch.totalCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500">Subtotal Mercadería del Mes:</span>
          <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
            -${fmt(totalPurchasesMonth)}
          </span>
        </div>
      </div>

      {/* ═══ FILA 6: HISTORIAL DE TRANSACCIONES (Con Filtros y Buscador exactos de la versión previa) ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        {/* Cabecera y Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">history</span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Historial de Transacciones ({selectedMonthObj?.name})
            </h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
              {filteredUnifiedTransactions.length}
            </span>
          </div>

          {/* Filtros Tipo (Todos / Ingresos / Cobros Pendientes / Gastos) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => setHistoryFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                historyFilterType === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({unifiedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilterType('Ingreso')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                historyFilterType === 'Ingreso'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
              }`}
            >
              <span className="size-1.5 rounded-full bg-emerald-400"></span>
              Ingresos Cobrados ({countHistoryIngresos})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilterType('Pendiente')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                historyFilterType === 'Pendiente'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
              }`}
            >
              <span className="size-1.5 rounded-full bg-amber-400"></span>
              Cobros Pendientes ({countHistoryPendientes})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilterType('Gasto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                historyFilterType === 'Gasto'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
              }`}
            >
              <span className="size-1.5 rounded-full bg-rose-400"></span>
              Gastos ({countHistoryGastos})
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            placeholder="Buscar por producto, cliente, lote, concepto..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Lista de Transacciones */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredUnifiedTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No se encontraron transacciones con los filtros seleccionados
            </div>
          ) : (
            filteredUnifiedTransactions.map((tx) => (
              <div
                key={tx.id}
                className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-xl transition"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap w-36">
                    {tx.date}
                  </span>

                  <span
                    className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${
                      tx.type === 'Ingreso'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : tx.type === 'Pendiente'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {tx.badgeLabel}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {tx.title}
                    </p>
                    {tx.type === 'Pendiente' ? (
                      <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        <span>{tx.description}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {tx.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-4">
                  {tx.type === 'Pendiente' ? (
                    <div>
                      <span className="text-[10px] text-slate-400 block">$0 cobrado</span>
                      <span className="text-sm font-black text-amber-700 dark:text-amber-300 font-mono">
                        ${fmt(tx.pendingAmount || 0)}
                      </span>
                    </div>
                  ) : tx.type === 'Ingreso' ? (
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      +${fmt(tx.amount)}
                    </span>
                  ) : (
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                      -${fmt(tx.amount)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ MODAL CREAR / EDITAR GASTO ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="size-9 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">
                    {editingExpense ? 'edit' : 'add'}
                  </span>
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Se sumará a la tabla de gastos de {selectedMonthObj?.name} {selectedYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="size-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-4">
              {/* Selector de Categoría (Tabs) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Categoría de Gasto
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setExpenseFormCategory('servicios')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      expenseFormCategory === 'servicios'
                        ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">receipt</span>
                    <span>Impuestos y Servicios</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseFormCategory('insumos')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      expenseFormCategory === 'insumos'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">inventory_2</span>
                    <span>Insumos y Mantenimiento</span>
                  </button>
                </div>
              </div>

              {/* Chips de Sugerencia Rápida */}
              <div>
                <span className="block text-[11px] font-bold text-slate-400 mb-1">
                  Sugerencias rápidas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(expenseFormCategory === 'servicios'
                    ? COMMON_CHIPS_SERVICIOS
                    : COMMON_CHIPS_INSUMOS
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setExpenseFormTitle(chip)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalle y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Detalle / Concepto *
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseFormTitle}
                    onChange={(e) => setExpenseFormTitle(e.target.value)}
                    placeholder="Ej: Luz Local, Bolsas Kraft x500..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseFormDate}
                    onChange={(e) => setExpenseFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Campos específicos para Insumos (Cantidad y P. Unitario) */}
              {expenseFormCategory === 'insumos' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                  <div>
                    <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={expenseFormQty}
                      onChange={(e) => setExpenseFormQty(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">
                      Precio Unitario ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={expenseFormUnitPrice}
                      onChange={(e) => setExpenseFormUnitPrice(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Monto Total y Forma de Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monto Total ($ ARS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={expenseFormTotal}
                      onChange={(e) => setExpenseFormTotal(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Forma de Pago
                  </label>
                  <select
                    value={expenseFormPayment}
                    onChange={(e) => setExpenseFormPayment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="Transferencia">Transferencia</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Descripción / Nota opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nota / Detalle adicional (opcional)
                </label>
                <textarea
                  rows={2}
                  value={expenseFormDesc}
                  onChange={(e) => setExpenseFormDesc(e.target.value)}
                  placeholder="Ej: Factura Nº, número de operación, etc."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Botones de Acción */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingExpense && (
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>{editingExpense ? 'Actualizar Gasto' : 'Guardar Gasto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL CONFIRMAR ELIMINACIÓN ═══ */}
      {deleteConfirmExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ¿Eliminar este gasto?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Se eliminará <b>{deleteConfirmExpense.title}</b> por un total de{' '}
              <b className="text-rose-600">${fmt(deleteConfirmExpense.amount)}</b>.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmExpense(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteExpense}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
