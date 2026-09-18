'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/utils/api';
import { useStockFlowStore } from '@/store/useStockStore';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  province?: string;
  city?: string;
  postal_code?: string;
  email_verified: boolean;
  is_approved: boolean;
  is_wholesale?: boolean;
  wholesale_until?: string | null;
  created_at?: string;
}

type FilterTab = 'pending' | 'approved' | 'mostrador' | 'all';

interface ClientesViewProps {
  apiKey: string;
  onPendingCountChange?: (count: number) => void;
}

export default function ClientesView({ apiKey, onPendingCountChange }: ClientesViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [adminEmails, setAdminEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Zustand sales para Clientes de Mostrador
  const sales = useStockFlowStore(s => s.sales);

  // Modal Crear Cuenta Web desde Mostrador
  const [createWebModalClient, setCreateWebModalClient] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('perfumeria123');
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Mayorista automático (Super Admin)
  const [autoWholesaleEnabled, setAutoWholesaleEnabled] = useState(false);
  const [loadingWholesaleToggle, setLoadingWholesaleToggle] = useState(false);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3500);
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const [res, adminRes, settingRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: { 'X-API-KEY': apiKey } }),
        fetch(`${API_URL}/api/admin/admins`, { headers: { 'X-API-KEY': apiKey } }).catch(() => null),
        fetch(`${API_URL}/api/admin/settings/wholesale-auto`, { headers: { 'X-API-KEY': apiKey } }).catch(() => null)
      ]);

      if (adminRes && adminRes.ok) {
        const admins = await adminRes.json();
        setAdminEmails(new Set(admins.map((a: any) => a.email.toLowerCase())));
      }

      if (settingRes && settingRes.ok) {
        const sData = await settingRes.json();
        setAutoWholesaleEnabled(sData.enabled ?? false);
      }

      if (res.ok) {
        const data: Customer[] = await res.json();
        setCustomers(data);
        const pending = data.filter(c => !c.is_approved).length;
        onPendingCountChange?.(pending);
      }
    } catch (e) {
      console.error('Error al cargar clientes', e);
    } finally {
      setLoading(false);
    }
  }, [apiKey, onPendingCountChange]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Alternar configuración mayorista automático (Super Admin)
  const handleToggleAutoWholesale = async () => {
    setLoadingWholesaleToggle(true);
    try {
      const nextVal = !autoWholesaleEnabled;
      const res = await fetch(`${API_URL}/api/admin/settings/wholesale-auto`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal })
      });
      if (res.ok) {
        setAutoWholesaleEnabled(nextVal);
        showAlert(nextVal ? '✓ Activada cuenta mayorista automática por 30 días.' : 'Desactivada cuenta mayorista automática.', 'success');
      } else {
        showAlert('Solo el super administrador puede modificar esta opción.', 'error');
      }
    } catch {
      showAlert('Error de red.', 'error');
    } finally {
      setLoadingWholesaleToggle(false);
    }
  };

  // Alternar cuenta mayorista permanente de un cliente
  const handleTogglePermanentWholesale = async (customer: Customer) => {
    setActionLoadingId(customer.id);
    const nextVal = !customer.is_wholesale;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${customer.id}/wholesale`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_wholesale: nextVal })
      });
      if (res.ok) {
        showAlert(nextVal ? `✓ ${customer.name} ahora tiene Cuenta Mayorista Permanente.` : `Se removió la cuenta mayorista permanente de ${customer.name}.`, 'success');
        fetchCustomers();
      } else {
        showAlert('Error al actualizar cuenta mayorista.', 'error');
      }
    } catch {
      showAlert('Error de red.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproval = async (customer: Customer, approve: boolean) => {
    setActionLoadingId(customer.id);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${customer.id}/approval`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: approve })
      });
      if (res.ok) {
        showAlert(approve ? `✓ ${customer.name} fue dado de alta exitosamente.` : `${customer.name} fue suspendido.`, 'success');
        fetchCustomers();
      } else {
        showAlert('Error al actualizar el estado.', 'error');
      }
    } catch {
      showAlert('Error de red.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (customer: Customer) => {
    setActionLoadingId(customer.id);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${customer.id}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        showAlert(`${customer.name} fue eliminado.`, 'success');
        setDeleteConfirmId(null);
        fetchCustomers();
      } else {
        showAlert('Error al eliminar.', 'error');
      }
    } catch {
      showAlert('Error de red.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pending = customers.filter(c => !c.is_approved);
  const approved = customers.filter(c => c.is_approved);

  // Clientes de mostrador únicos agrupados por teléfono o nombre
  const posClients = (() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      email: string;
      totalRevenue: number;
      salesCount: number;
      lastDate: string;
      hasWebAccount: boolean;
      webCustomerId?: number;
    }>();

    sales.forEach(sale => {
      const phoneClean = (sale.clientPhone || '').trim();
      const nameClean = (sale.clientName || '').trim();
      const key = phoneClean || nameClean;
      if (!key) return;

      const rev = (sale.quantity || 1) * (sale.unitSalePrice || 0);
      const existing = map.get(key);

      // Check if this client matches a customer in DB
      const matchedCustomer = customers.find(c => {
        if (sale.clientEmail && c.email.toLowerCase() === sale.clientEmail.toLowerCase()) return true;
        if (phoneClean && c.phone && c.phone.replace(/\D/g, '') === phoneClean.replace(/\D/g, '')) return true;
        return false;
      });

      if (existing) {
        existing.totalRevenue += rev;
        existing.salesCount += 1;
        if (!existing.email && sale.clientEmail) existing.email = sale.clientEmail;
        if (new Date(sale.date) > new Date(existing.lastDate)) existing.lastDate = sale.date;
        if (matchedCustomer) {
          existing.hasWebAccount = true;
          existing.webCustomerId = matchedCustomer.id;
        }
      } else {
        map.set(key, {
          name: nameClean || 'Cliente',
          phone: phoneClean,
          email: sale.clientEmail || '',
          totalRevenue: rev,
          salesCount: 1,
          lastDate: sale.date || '',
          hasWebAccount: !!matchedCustomer,
          webCustomerId: matchedCustomer?.id,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  })();

  const filteredPosClients = posClients.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const handleCreateWebAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientEmail.trim()) {
      showAlert('El email es requerido para crear la cuenta web.', 'error');
      return;
    }
    setCreatingAccount(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim().toLowerCase(),
          password: newClientPassword,
        }),
      });
      if (res.ok) {
        showAlert(`✓ Cuenta web creada con éxito para ${newClientName}.`, 'success');
        setCreateWebModalClient(null);
        fetchCustomers();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert(err.detail || 'Error al crear la cuenta web.', 'error');
      }
    } catch {
      showAlert('Error de conexión con el servidor.', 'error');
    } finally {
      setCreatingAccount(false);
    }
  };

  const filtered = customers
    .filter(c => {
      if (filter === 'pending') return !c.is_approved;
      if (filter === 'approved') return c.is_approved;
      return true;
    })
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.province?.toLowerCase().includes(q)
      );
    });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'Z');
      return d.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const whatsappLink = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="space-y-5">

      {/* Alert Toast */}
      {alertMsg && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-sm font-bold transition-all animate-in slide-in-from-right-4 duration-300 ${alertMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <span className="material-symbols-outlined text-lg">{alertMsg.type === 'success' ? 'check_circle' : 'error'}</span>
          {alertMsg.text}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId !== null && (() => {
        const c = customers.find(x => x.id === deleteConfirmId);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full text-center space-y-4">
              <div className="size-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">¿Eliminar cliente?</h3>
              <p className="text-sm text-slate-500">Se eliminará permanentemente la cuenta de <span className="font-bold text-slate-700 dark:text-slate-300">{c.name}</span> ({c.email}). Esta acción no se puede deshacer.</p>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(c)} disabled={actionLoadingId === c.id} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors text-sm disabled:opacity-50">
                  {actionLoadingId === c.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Banner Configuración Super Admin Mayoristas */}
      <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-primary/10 border border-purple-200 dark:border-purple-800/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
            <span className="material-symbols-outlined text-xl">loyalty</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Cuenta Mayorista Automática por 30 Días</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Si un cliente realiza una compra mayorista, su cuenta se convierte automáticamente en mayorista por 30 días, renovándose por 30 días más cada vez que vuelva a comprar.
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleAutoWholesale}
          disabled={loadingWholesaleToggle}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 shadow-sm ${
            autoWholesaleEnabled
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {autoWholesaleEnabled ? 'toggle_on' : 'toggle_off'}
          </span>
          {autoWholesaleEnabled ? 'Activado (Automático)' : 'Desactivado'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
          <div className="size-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{pending.length}</div>
            <div className="text-xs text-slate-500 font-medium">Pendientes</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
          <div className="size-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{approved.length}</div>
            <div className="text-xs text-slate-500 font-medium">Aprobados</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
          <div className="size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">group</span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{customers.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Clientes</div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Solicitudes de Registro y Clientes</h3>
              <p className="text-xs text-slate-500 mt-0.5">Aprobá las solicitudes de registro para habilitar compras</p>
            </div>
            <div className="sm:ml-auto relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email, teléfono..."
                className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white w-72"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {([
              { key: 'pending', label: 'Pendientes de Aprobación', count: pending.length, color: 'amber' },
              { key: 'approved', label: 'Aprobados (Web)', count: approved.length, color: 'green' },
              { key: 'mostrador', label: 'Clientes Mostrador (POS)', count: posClients.length, color: 'cyan' },
              { key: 'all', label: 'Todos Web', count: customers.length, color: 'slate' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === tab.key
                    ? tab.color === 'amber' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : tab.color === 'green' ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black ${
                  filter === tab.key
                    ? 'bg-white/70 text-current'
                    : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filter === 'mostrador' ? (
          filteredPosClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <span className="material-symbols-outlined text-5xl">point_of_sale</span>
              <p className="font-medium text-sm">No se encontraron clientes de mostrador con ventas registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente Mostrador</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Historial Compras</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Última Compra</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cuenta Web</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredPosClients.map((client, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{client.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {client.email ? (
                            <span className="text-primary font-medium">{client.email}</span>
                          ) : (
                            <span className="text-slate-400 italic">Sin email registrado</span>
                          )}
                        </p>
                        {client.phone && (
                          <a
                            href={whatsappLink(client.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium mt-0.5"
                          >
                            <span className="material-symbols-outlined text-xs">phone</span>
                            {client.phone}
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-black text-sm text-slate-900 dark:text-white">${client.totalRevenue.toLocaleString('es-AR')}</p>
                        <p className="text-xs text-slate-500">{client.salesCount} venta{client.salesCount > 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 hidden md:table-cell">
                        {client.lastDate ? new Date(client.lastDate).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {client.hasWebAccount ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            Cuenta Web Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Solo Mostrador
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!client.hasWebAccount ? (
                          <button
                            onClick={() => {
                              setCreateWebModalClient(client);
                              setNewClientName(client.name);
                              setNewClientPhone(client.phone);
                              setNewClientEmail(client.email || '');
                              setNewClientPassword('perfumeria123');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-sm shadow-primary/20"
                          >
                            <span className="material-symbols-outlined text-sm">person_add</span>
                            Crear Cuenta Web
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
                            <span className="material-symbols-outlined text-sm">check</span>
                            Vinculado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
            <span className="font-medium">Cargando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <span className="material-symbols-outlined text-5xl">person_search</span>
            <p className="font-medium text-sm">
              {filter === 'pending' ? 'No hay solicitudes pendientes 🎉' : 'No se encontraron clientes'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mayorista</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Ubicación</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden xl:table-cell">Solicitud</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors ${!c.is_approved ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                    
                    {/* Estado */}
                    <td className="px-5 py-4">
                      {c.is_approved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          <span className="size-1.5 rounded-full bg-green-500 inline-block"></span>
                          Aprobado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                          <span className="size-1.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* Cliente */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</span>
                        {adminEmails.has(c.email.toLowerCase()) && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Este usuario también posee una cuenta de Administrador de la tienda">
                            <span className="material-symbols-outlined text-[12px]">shield_person</span>
                            Admin de Tienda
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.email}</div>
                      <a
                        href={whatsappLink(c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium mt-0.5 group"
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        {c.phone}
                      </a>
                    </td>

                    {/* Mayorista */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.is_wholesale ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            <span className="material-symbols-outlined text-[12px]">verified</span>
                            Permanente
                          </span>
                        ) : c.wholesale_until && new Date(c.wholesale_until) > new Date() ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title={`Vence el ${new Date(c.wholesale_until).toLocaleDateString('es-AR')}`}>
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            30D ({Math.ceil((new Date(c.wholesale_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Regular</span>
                        )}

                        <button
                          onClick={() => handleTogglePermanentWholesale(c)}
                          disabled={actionLoadingId === c.id}
                          title={c.is_wholesale ? "Quitar cuenta mayorista permanente" : "Hacer mayorista permanente"}
                          className={`p-1 rounded-lg border text-xs transition-colors ${
                            c.is_wholesale 
                              ? 'text-purple-600 border-purple-200 hover:bg-purple-50' 
                              : 'text-slate-400 border-slate-200 hover:text-purple-600 hover:border-purple-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {c.is_wholesale ? 'star' : 'star_border'}
                          </span>
                        </button>
                      </div>
                    </td>

                    {/* Ubicación */}
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">{c.city || '—'}{c.province ? `, ${c.province}` : ''}</div>
                      {c.address && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{c.address}</div>}
                      {c.postal_code && <div className="text-xs text-slate-400">CP: {c.postal_code}</div>}
                    </td>

                    {/* Fecha */}
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <div className="text-xs text-slate-500">{formatDate(c.created_at)}</div>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!c.is_approved ? (
                          <button
                            onClick={() => handleApproval(c, true)}
                            disabled={actionLoadingId === c.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm shadow-green-200"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {actionLoadingId === c.id ? 'sync' : 'how_to_reg'}
                            </span>
                            {actionLoadingId === c.id ? 'Procesando...' : 'Aprobar'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproval(c, false)}
                            disabled={actionLoadingId === c.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 dark:bg-slate-700 dark:hover:bg-amber-900/30 text-slate-600 hover:text-amber-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {actionLoadingId === c.id ? 'sync' : 'pause_circle'}
                            </span>
                            Suspender
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmId(c.id)}
                          disabled={actionLoadingId === c.id}
                          className="size-8 inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-500 hover:border-red-300 transition-all disabled:opacity-30"
                          title="Eliminar cliente"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear Cuenta Web para Cliente Mostrador */}
      {createWebModalClient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">person_add</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Crear Cuenta Web</h3>
                  <p className="text-xs text-slate-500">Habilitar acceso online para cliente de mostrador</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateWebModalClient(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateWebAccount} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  placeholder="Ej: 3764123456"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={e => setNewClientEmail(e.target.value)}
                  required
                  placeholder="cliente@ejemplo.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">Este correo servirá como usuario de inicio de sesión.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña Provisoria</label>
                <input
                  type="text"
                  value={newClientPassword}
                  onChange={e => setNewClientPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">Podés indicarle esta clave al cliente para que ingrese a la tienda.</p>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5 text-emerald-600">check_circle</span>
                <span>La cuenta se creará <strong>aprobada automáticamente</strong> para que el cliente pueda comprar inmediatamente.</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateWebModalClient(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20 disabled:opacity-50"
                >
                  {creatingAccount ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Creando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">how_to_reg</span>
                      Crear y Vincular
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

