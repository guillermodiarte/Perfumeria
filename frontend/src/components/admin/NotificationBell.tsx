'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '@/utils/api';
import { useStockFlowStore } from '@/store/useStockStore';

interface NotificationBellProps {
  apiKey?: string;
  onNavigateView: (view: 'pedidos_web' | 'ventas_mostrador' | 'cobros_pendientes' | 'users') => void;
}

export default function NotificationBell({ apiKey, onNavigateView }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Zustand POS sales (para chequear cuotas adeudadas de mostrador)
  const sales = useStockFlowStore(s => s.sales);

  const [backendSummary, setBackendSummary] = useState<{
    pending_web_orders_count: number;
    installments_pending_this_month: any[];
    installments_pending_count: number;
    pending_customers_count: number;
    total_notifications_count: number;
    current_month: string;
  }>({
    pending_web_orders_count: 0,
    installments_pending_this_month: [],
    installments_pending_count: 0,
    pending_customers_count: 0,
    total_notifications_count: 0,
    current_month: new Date().toISOString().substring(0, 7)
  });

  const getToken = () => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') : '');

  const fetchSummary = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/notifications/summary`, {
        headers: { 'X-API-KEY': token }
      });
      if (res.ok) {
        const data = await res.json();
        setBackendSummary(data);
      }
    } catch (e) {
      // Silencioso para polling
    }
  }, [apiKey]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 45000); // cada 45s
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calcular cuotas de mostrador pendientes este mes
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const posInstallmentsPending = sales.filter(s => {
    const pending = s.pendingAmount ?? s.remainingAmount ?? 0;
    return (
      s.status !== 'Cancelada' &&
      pending > 0 &&
      (s.paymentType === 'cuotas' || (s.paymentType === 'partial' && pending > 0)) &&
      s.lastNotifiedMonth !== currentMonthStr
    );
  });

  const totalNotifications = 
    backendSummary.pending_web_orders_count + 
    backendSummary.installments_pending_count + 
    posInstallmentsPending.length +
    backendSummary.pending_customers_count;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de la Campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
        title="Notificaciones del Sistema"
      >
        <span className="material-symbols-outlined text-2xl">notifications</span>
        
        {totalNotifications > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
            {totalNotifications > 99 ? '99+' : totalNotifications}
          </span>
        )}
      </button>

      {/* Dropdown Menú */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-fadeIn">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">notifications_active</span>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">Notificaciones</h4>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {totalNotifications} {totalNotifications === 1 ? 'aviso' : 'avisos'}
            </span>
          </div>

          {/* Contenido */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
            
            {/* Aviso 1: Pedidos Web Pendientes */}
            {backendSummary.pending_web_orders_count > 0 && (
              <div 
                onClick={() => { onNavigateView('pedidos_web'); setIsOpen(false); }}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-lg">shopping_cart</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white">
                    {backendSummary.pending_web_orders_count === 1
                      ? '1 nuevo pedido web online'
                      : `${backendSummary.pending_web_orders_count} nuevos pedidos online`}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Hay pedidos que requieren revisión y aprobación en Pedidos Web.
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-base self-center">
                  chevron_right
                </span>
              </div>
            )}

            {/* Aviso 2: Cuotas del Mes (Web) */}
            {backendSummary.installments_pending_count > 0 && (
              <div 
                onClick={() => { onNavigateView('cobros_pendientes'); setIsOpen(false); }}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors flex items-start gap-3 group bg-amber-50/30 dark:bg-amber-950/10"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Recordatorio: Cobro mensual de cuotas
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {backendSummary.installments_pending_count} pedido(s) web con cuotas pendientes este mes.
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-base self-center">
                  chevron_right
                </span>
              </div>
            )}

            {/* Aviso 3: Cuotas del Mes (Mostrador) */}
            {posInstallmentsPending.length > 0 && (
              <div 
                onClick={() => { onNavigateView('cobros_pendientes'); setIsOpen(false); }}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors flex items-start gap-3 group bg-indigo-50/30 dark:bg-indigo-950/10"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-lg">point_of_sale</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-indigo-900 dark:text-indigo-200">
                    {posInstallmentsPending.length} cuota(s) de mostrador a cobrar
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Ventas físicas con cuotas o saldos pendientes para este mes.
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-base self-center">
                  chevron_right
                </span>
              </div>
            )}

            {/* Aviso 4: Clientes Pendientes */}
            {backendSummary.pending_customers_count > 0 && (
              <div 
                onClick={() => { onNavigateView('users'); setIsOpen(false); }}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-lg">person_add</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white">
                    {backendSummary.pending_customers_count} cliente(s) por dar de alta
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Nuevos registros esperando aprobación en Clientes.
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-base self-center">
                  chevron_right
                </span>
              </div>
            )}

            {/* Estado vacío */}
            {totalNotifications === 0 && (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500">task_alt</span>
                <p className="font-bold text-slate-700 dark:text-slate-300">Todo al día</p>
                <p className="text-[11px] text-slate-500 mt-0.5">No hay pedidos pendientes ni cuotas sin gestionar para este mes.</p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700 text-center">
            <button
              onClick={() => { onNavigateView('cobros_pendientes'); setIsOpen(false); }}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Ver todos los cobros pendientes →
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
