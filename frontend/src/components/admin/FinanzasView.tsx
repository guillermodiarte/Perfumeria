'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function fmt(n: number) {
    return Math.round(Number(n) || 0).toLocaleString('es-AR');
}

interface FinanzasViewProps {
    apiKey?: string;
    apiUrl?: string;
}

interface TransactionItem {
    id: string;
    date: string;
    type: 'Ingreso' | 'Gasto';
    amount: number;
    productName: string;
    quantity: number;
    variant: string;
    description: string;
    extra: string;
}

export default function FinanzasView({ apiKey, apiUrl }: FinanzasViewProps) {
    const localPurchases = useStockFlowStore(s => s.purchases);
    const localSales = useStockFlowStore(s => s.sales).filter(s => s.status === 'Pagada');

    const [filterType, setFilterType] = useState<'all' | 'Ingreso' | 'Gasto'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingDb, setLoadingDb] = useState(true);

    const [dbBatches, setDbBatches] = useState<any[]>([]);
    const [dbOrders, setDbOrders] = useState<any[]>([]);

    const effectiveApiUrl = apiUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    const fetchData = useCallback(async () => {
        setLoadingDb(true);
        const token = apiKey || (typeof window !== 'undefined' ? (localStorage.getItem('lyg_api_key') || localStorage.getItem('adminToken') || '') : '');
        const headers: Record<string, string> = {};
        if (token) {
            headers['X-API-KEY'] = token;
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const [batchesRes, ordersRes] = await Promise.all([
                fetch(`${effectiveApiUrl}/api/admin/purchase-batches?limit=100`, { headers }).catch(() => null),
                fetch(`${effectiveApiUrl}/api/orders/admin/all`, { headers }).catch(() => null),
            ]);

            if (batchesRes && batchesRes.ok) {
                const data = await batchesRes.json();
                setDbBatches(data.batches || []);
            }
            if (ordersRes && ordersRes.ok) {
                const data = await ordersRes.json();
                setDbOrders(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.warn('[FinanzasView] Error al consultar datos reales del servidor:', err);
        } finally {
            setLoadingDb(false);
        }
    }, [apiKey, effectiveApiUrl]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Combinar datos: Si hay datos en la BD de compras/órdenes, usarlos como fuente de la verdad
    const transactions = useMemo<TransactionItem[]>(() => {
        const hasDbData = dbBatches.length > 0 || dbOrders.length > 0;

        if (hasDbData) {
            const expenseTransactions: TransactionItem[] = dbBatches.flatMap((b: any) => {
                const batchDate = b.purchase_date || b.created_at || new Date().toISOString();
                if (Array.isArray(b.items) && b.items.length > 0) {
                    return b.items.map((it: any) => {
                        const totalItemARS = it.total_cost_per_unit_ars 
                            ? it.total_cost_per_unit_ars * (it.quantity || 1)
                            : ((it.unit_cost_ars || 0) + (it.shipping_per_unit_ars || 0)) * (it.quantity || 1);
                        return {
                            id: `batch-${b.id}-item-${it.id}`,
                            date: batchDate,
                            type: 'Gasto' as const,
                            amount: totalItemARS,
                            productName: it.product_name || 'Producto',
                            quantity: it.quantity || 1,
                            variant: it.variant_label || '',
                            description: `Compra de ${it.quantity}x ${it.product_name}${it.variant_label ? ` (${it.variant_label})` : ''}`,
                            extra: b.supplier_name ? `Proveedor: ${b.supplier_name}` : `Lote ${b.batch_number}`
                        };
                    });
                } else {
                    return [{
                        id: `batch-${b.id}`,
                        date: batchDate,
                        type: 'Gasto' as const,
                        amount: Number(b.total_cost_ars || 0),
                        productName: `Lote ${b.batch_number}`,
                        quantity: b.items_count || 1,
                        variant: '',
                        description: `Compra de Lote ${b.batch_number} (${b.items_count || 0} ítems)`,
                        extra: b.supplier_name ? `Proveedor: ${b.supplier_name}` : 'Ingreso a stock'
                    }];
                }
            });

            const incomeTransactions: TransactionItem[] = dbOrders
                .filter((o: any) => o.payment_status === 'approved' || o.payment_status === 'paid' || o.order_status === 'delivered' || o.order_status === 'completed')
                .map((o: any) => {
                    const client = o.customer_name || (o.customer ? `${o.customer.first_name} ${o.customer.last_name}` : 'Consumidor Final');
                    return {
                        id: `order-${o.id || o.order_number}`,
                        date: o.created_at || new Date().toISOString(),
                        type: 'Ingreso' as const,
                        amount: Number(o.total_ars || o.total || 0),
                        productName: `Pedido #${o.order_number}`,
                        quantity: Array.isArray(o.items) ? o.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0) : 1,
                        variant: '',
                        description: `Venta Pedido #${o.order_number} a ${client}`,
                        extra: client
                    };
                });

            return [...expenseTransactions, ...incomeTransactions].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
        }

        // Fallback a localStorage si la BD está vacía o no responde
        return [
            ...localPurchases.map(p => {
                const variantParts = [p.color, p.size].filter(Boolean);
                const variantText = variantParts.length > 0 ? ` (${variantParts.join(' - ')})` : '';
                return {
                    id: `local-pch-${p.id || Math.random()}`,
                    date: p.date,
                    type: 'Gasto' as const,
                    amount: p.totalCost,
                    productName: p.productName,
                    quantity: p.quantity,
                    variant: variantParts.join(' • '),
                    description: `Compra de ${p.quantity}x ${p.productName}${variantText}`,
                    extra: 'Ingreso a stock'
                };
            }),
            ...localSales.map(s => {
                const variantParts = [s.color, s.size].filter(Boolean);
                const variantText = variantParts.length > 0 ? ` (${variantParts.join(' - ')})` : '';
                const client = s.clientName ? ` a ${s.clientName}` : '';
                return {
                    id: `local-sale-${s.id || Math.random()}`,
                    date: s.date,
                    type: 'Ingreso' as const,
                    amount: s.revenue,
                    productName: s.productName,
                    quantity: s.quantity,
                    variant: variantParts.join(' • '),
                    description: `Venta de ${s.quantity}x ${s.productName}${variantText}${client}`,
                    extra: s.clientName || 'Consumidor Final'
                };
            })
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [dbBatches, dbOrders, localPurchases, localSales]);

    const totalExpenses = useMemo(() => {
        return transactions.filter(t => t.type === 'Gasto').reduce((acc, t) => acc + t.amount, 0);
    }, [transactions]);

    const totalRevenue = useMemo(() => {
        return transactions.filter(t => t.type === 'Ingreso').reduce((acc, t) => acc + t.amount, 0);
    }, [transactions]);

    const grossProfit = totalRevenue - totalExpenses;

    // Filtrar transacciones para la vista
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (filterType !== 'all' && t.type !== filterType) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    t.description.toLowerCase().includes(q) ||
                    (t.productName && t.productName.toLowerCase().includes(q)) ||
                    (t.extra && t.extra.toLowerCase().includes(q))
                );
            }
            return true;
        });
    }, [transactions, filterType, searchQuery]);

    // Generar datos para el gráfico mensual
    const chartData = useMemo(() => {
        const dataMap: Record<string, { name: string, dateObj: Date, ingresos: number, gastos: number }> = {};

        transactions.forEach(t => {
            const d = new Date(t.date);
            const monthStr = d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
            const name = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
            
            if (!dataMap[name]) {
                dataMap[name] = { name, dateObj: new Date(d.getFullYear(), d.getMonth(), 1), ingresos: 0, gastos: 0 };
            }
            if (t.type === 'Ingreso') {
                dataMap[name].ingresos += t.amount;
            } else {
                dataMap[name].gastos += t.amount;
            }
        });

        return Object.values(dataMap)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(({ name, ingresos, gastos }) => ({ name, ingresos, gastos }));
    }, [transactions]);

    const countIngresos = transactions.filter(t => t.type === 'Ingreso').length;
    const countGastos = transactions.filter(t => t.type === 'Gasto').length;

    return (
        <div className="space-y-4 sm:space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-6">
                {/* Ingresos Totales */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
                    <div className="size-10 sm:size-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-xl sm:text-2xl">account_balance_wallet</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Ingresos Totales</p>
                        <p className="text-base sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white truncate font-mono mt-0.5">
                            ${fmt(totalRevenue)}
                        </p>
                    </div>
                </div>

                {/* Gastos (Compras) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
                    <div className="size-10 sm:size-14 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-xl sm:text-2xl">shopping_cart</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Gastos (Compras)</p>
                        <p className="text-base sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white truncate font-mono mt-0.5">
                            ${fmt(totalExpenses)}
                        </p>
                    </div>
                </div>

                {/* Ganancia Bruta (ocupa ancho completo en mobile para máxima visibilidad) */}
                <div className={`col-span-2 md:col-span-1 bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border ${
                    grossProfit >= 0 ? 'border-primary/30 dark:border-primary/40' : 'border-rose-300 dark:border-rose-800'
                } flex items-center justify-between gap-3 sm:gap-4`}>
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className={`size-10 sm:size-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            grossProfit >= 0 ? 'bg-primary/10 text-primary' : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600'
                        }`}>
                            <span className="material-symbols-outlined text-xl sm:text-2xl">monitoring</span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Ganancia Bruta</p>
                                {totalRevenue > 0 && (
                                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                        grossProfit >= 0 
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' 
                                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                    }`}>
                                        {((grossProfit / totalRevenue) * 100).toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <p className={`text-lg sm:text-2xl lg:text-3xl font-black font-mono truncate mt-0.5 ${
                                grossProfit >= 0 ? 'text-primary' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                                ${fmt(grossProfit)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráfico Recharts */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">bar_chart</span>
                        Comparativa: Ingresos vs Gastos
                    </h3>
                    {loadingDb && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                            Sincronizando...
                        </span>
                    )}
                </div>
                <div className="h-60 sm:h-80 w-full">
                    {chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                            No hay datos para mostrar en el gráfico.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dx={-5} tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                    formatter={(value) => [`$${fmt(Number(value ?? 0))}`, undefined]}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                                <Bar dataKey="ingresos" name="Ingresos (Ventas)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                                <Bar dataKey="gastos" name="Gastos (Compras)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={45} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Historial de Transacciones */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                
                {/* Cabecera con título y filtros */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">history</span>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                            Historial de Transacciones
                        </h3>
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
                            {filteredTransactions.length}
                        </span>
                    </div>

                    {/* Filtros Tipo (Todos / Ingresos / Gastos) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <button
                            type="button"
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                filterType === 'all'
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            Todos ({transactions.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType('Ingreso')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                filterType === 'Ingreso'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                            }`}
                        >
                            <span className="size-1.5 rounded-full bg-emerald-400"></span>
                            Ingresos ({countIngresos})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType('Gasto')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                filterType === 'Gasto'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                            }`}
                        >
                            <span className="size-1.5 rounded-full bg-rose-400"></span>
                            Gastos ({countGastos})
                        </button>
                    </div>
                </div>

                {/* Buscador rápido */}
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por producto, cliente, lote..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    )}
                </div>

                {/* VISTA MOBILE: Tarjetas de transacciones (md:hidden) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                            No hay movimientos que coincidan con los filtros.
                        </div>
                    ) : (
                        filteredTransactions.map((t) => (
                            <div key={t.id} className="py-3 flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    {/* Icono de tipo */}
                                    <div className={`size-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                        t.type === 'Ingreso'
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                                            : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                                    }`}>
                                        <span className="material-symbols-outlined text-base">
                                            {t.type === 'Ingreso' ? 'arrow_downward' : 'arrow_upward'}
                                        </span>
                                    </div>

                                    {/* Contenido principal */}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-snug">
                                            {t.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                            <span>{new Date(t.date).toLocaleDateString('es-AR')}</span>
                                            <span>•</span>
                                            <span>{new Date(t.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className={`px-1.5 py-0.2 rounded font-black uppercase text-[8px] tracking-wider ${
                                                t.type === 'Ingreso'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                            }`}>
                                                {t.type}
                                            </span>
                                            {t.extra && (
                                                <span className="text-slate-400 truncate max-w-[140px]">
                                                    • {t.extra}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Monto */}
                                <div className="text-right flex-shrink-0 pt-0.5">
                                    <span className={`text-xs sm:text-sm font-black font-mono block ${
                                        t.type === 'Ingreso'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                        {t.type === 'Ingreso' ? '+' : '-'}${fmt(t.amount)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* VISTA DESKTOP: Tabla completa (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
                                <th className="pb-3 font-bold w-44">Fecha / Hora</th>
                                <th className="pb-3 font-bold w-24">Tipo</th>
                                <th className="pb-3 font-bold">Detalle de Transacción</th>
                                <th className="pb-3 font-bold text-right w-36">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-500">
                                        No hay movimientos financieros que coincidan.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                                        <td className="py-3.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                            {new Date(t.date).toLocaleDateString('es-AR')} {new Date(t.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="py-3.5">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                t.type === 'Ingreso' 
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            }`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="py-3.5 font-medium text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                                            {t.description}
                                        </td>
                                        <td className={`py-3.5 text-right font-black font-mono text-sm ${
                                            t.type === 'Ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {t.type === 'Ingreso' ? '+' : '-'}${fmt(t.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
