'use client';
import { useMemo } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function FinanzasView() {
    const purchases = useStockFlowStore(s => s.purchases);
    const sales = useStockFlowStore(s => s.sales).filter(s => s.status === 'Pagada');

    const totalExpenses = purchases.reduce((acc, p) => acc + p.totalCost, 0);
    const totalRevenue = sales.reduce((acc, s) => acc + s.revenue, 0);
    const grossProfit = totalRevenue - totalExpenses;

    // Combine and sort transactions for the table
    const transactions = [
        ...purchases.map(p => ({ ...p, type: 'Gasto', amount: p.totalCost, description: `Compra de ${p.quantity}x ${p.productName} (${p.color} - ${p.size})` })),
        ...sales.map(s => ({ ...s, type: 'Ingreso', amount: s.revenue, description: `Venta de ${s.quantity}x ${s.productName} (${pColor(s.color)} - ${s.size}) a ${s.clientName || 'Consumidor Final'}` }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    function pColor(c: string) { return c || ''; }

    // Generate Chart Data (Monthly)
    const chartData = useMemo(() => {
        const dataMap: Record<string, { name: string, dateObj: Date, ingresos: number, gastos: number }> = {};

        [...purchases, ...sales].forEach(record => {
            const d = new Date(record.date);
            const monthStr = d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
            const name = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
            
            if (!dataMap[name]) {
                dataMap[name] = { name, dateObj: new Date(d.getFullYear(), d.getMonth(), 1), ingresos: 0, gastos: 0 };
            }
            if ('revenue' in record) {
                dataMap[name].ingresos += record.revenue;
            } else {
                dataMap[name].gastos += record.totalCost;
            }
        });

        return Object.values(dataMap)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(({ name, ingresos, gastos }) => ({ name, ingresos, gastos }));
    }, [purchases, sales]);


    return (
        <div className="space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="size-14 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ingresos Totales</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">${totalRevenue.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="size-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">shopping_cart</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Gastos (Compras)</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">${totalExpenses.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className={`size-14 rounded-full flex items-center justify-center ${grossProfit >= 0 ? 'bg-primary/10 text-primary' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                        <span className="material-symbols-outlined text-2xl">monitoring</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ganancia Bruta</p>
                        <p className={`text-3xl font-black ${grossProfit >= 0 ? 'text-primary' : 'text-red-600'}`}>
                            ${grossProfit.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Gráfico Recharts */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">bar_chart</span>
                    Comparativa: Ingresos vs Gastos
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(val) => `$${val / 1000}k`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, undefined]}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="ingresos" name="Ingresos (Ventas)" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            <Bar dataKey="gastos" name="Gastos (Compras)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Historial Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">history</span>
                    Historial de Transacciones
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 uppercase tracking-widest">
                                <th className="pb-3 font-bold">Fecha / Hora</th>
                                <th className="pb-3 font-bold">Tipo</th>
                                <th className="pb-3 font-bold">Detalle de Transacción</th>
                                <th className="pb-3 font-bold text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {transactions.length === 0 ? (
                                <tr><td colSpan={4} className="py-8 text-center text-slate-500">No hay movimientos financieros.</td></tr>
                            ) : transactions.map((t, idx) => (
                                <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="py-4 font-medium text-slate-500 dark:text-slate-400 w-48">
                                        {new Date(t.date).toLocaleDateString('es-AR')} {new Date(t.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${t.type === 'Ingreso' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="py-4 font-medium text-slate-800 dark:text-slate-200">{t.description}</td>
                                    <td className={`py-4 text-right font-black ${t.type === 'Ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {t.type === 'Ingreso' ? '+' : '-'}${t.amount.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
