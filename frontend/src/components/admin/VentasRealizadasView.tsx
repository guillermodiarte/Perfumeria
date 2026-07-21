'use client';
import { useState } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';

export default function VentasRealizadasView() {
    const sales = useStockFlowStore(s => s.sales);
    const confirmSale = useStockFlowStore(s => s.confirmSale);
    const cancelSale = useStockFlowStore(s => s.cancelSale);
    const [searchTerm, setSearchTerm] = useState('');

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
        // Fallback for old mock data without ticketId
        const tId = sale.ticketId || `TICK-${sale.id.toUpperCase()}`;
        if (!acc[tId]) {
            acc[tId] = {
                ticketId: tId,
                date: sale.date,
                clientName: sale.clientName,
                clientPhone: sale.clientPhone,
                itemsCount: 0,
                total: 0,
                status: sale.status || 'Pagada',
                saleId: sale.id
            };
        }
        acc[tId].itemsCount += sale.quantity;
        acc[tId].total += sale.revenue;
        return acc;
    }, {} as Record<string, any>)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col min-h-[500px]">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
                        Ventas Realizadas
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Consulta el historial de tickets fiscales emitidos.
                    </p>
                </div>
                
                <div className="relative w-full md:w-80">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente, producto o Ticket ID..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white font-medium text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 uppercase tracking-widest">
                            <th className="pb-3 font-bold">Fecha / Hora</th>
                            <th className="pb-3 font-bold">Ticket ID</th>
                            <th className="pb-3 font-bold">Cliente</th>
                            <th className="pb-3 font-bold text-center">Cant. Artículos</th>
                            <th className="pb-3 font-bold text-right">Total</th>
                            <th className="pb-3 font-bold text-center">Estado</th>
                            <th className="pb-3 font-bold text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-50 dark:divide-slate-800/50">
                        {groupedTickets.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                                        <p>No se encontraron tickets con esos criterios.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : groupedTickets.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                <td className="py-4 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    {new Date(t.date).toLocaleDateString('es-AR')} {new Date(t.date).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                                </td>
                                <td className="py-4 font-mono text-xs text-slate-400 font-bold">{t.ticketId}</td>
                                <td className="py-4">
                                    <p className="font-bold text-slate-800 dark:text-white">{t.clientName || 'Consumidor Final'}</p>
                                    {t.clientPhone && <p className="text-xs text-slate-400">{t.clientPhone}</p>}
                                </td>
                                <td className="py-4 text-center">
                                    <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold size-7 rounded-lg text-xs">
                                        {t.itemsCount}
                                    </span>
                                </td>
                                <td className="py-4 text-right font-black text-slate-800 dark:text-white">
                                    ${t.total.toLocaleString()}
                                </td>
                                <td className="py-4 text-center">
                                    {t.status === 'Pagada' && <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">Pagada</span>}
                                    {t.status === 'Pendiente' && <span className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-bold uppercase tracking-wider">Pendiente</span>}
                                    {t.status === 'Cancelada' && <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-wider">Cancelada</span>}
                                </td>
                                <td className="py-4 text-center">
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                        {t.status === 'Pendiente' ? (
                                            <>
                                                <button 
                                                    onClick={() => confirmSale(t.saleId)}
                                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                    Confirmar
                                                </button>
                                                <button 
                                                    onClick={() => cancelSale(t.saleId)}
                                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={() => generateTicketPDF(t.ticketId, sales, true)}
                                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">print</span>
                                                    Imprimir
                                                </button>
                                                <button 
                                                    onClick={() => generateTicketPDF(t.ticketId, sales, false)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">download</span>
                                                    PDF
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {groupedTickets.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl px-6 py-3 flex items-center gap-4">
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total filtrado</span>
                        <span className="text-2xl font-black text-primary">
                            ${groupedTickets.reduce((acc, t) => acc + t.total, 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
