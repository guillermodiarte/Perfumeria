'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/utils/api';
import { useStockFlowStore } from '@/store/useStockStore';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  dni?: string;
  address?: string;
  province?: string;
  city?: string;
  postal_code?: string;
  email_verified: boolean;
  is_approved: boolean;
  is_wholesale?: boolean;
  is_special_wholesale?: boolean;
  customer_type?: 'normal' | 'wholesale' | 'special_wholesale';
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

  // Modal Crear Cliente Manualmente (Administrador)
  const [showCreateManualModal, setShowCreateManualModal] = useState(false);
  const [manualModalError, setManualModalError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    phone: '',
    dni: '',
    address: '',
    province: '',
    city: '',
    postal_code: '',
    password: 'perfumeria123',
    customer_type: 'normal' as 'normal' | 'wholesale' | 'special_wholesale',
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  const updateManualField = (field: string, value: any) => {
    if (manualModalError) setManualModalError(null);
    setManualForm(prev => ({ ...prev, [field]: value }));
  };

  // Provincias y Localidades (selector dinámico como el registro original)
  const [provinces, setProvinces] = useState<{ id: number; name: string }[]>([]);

  // Para crear cliente
  const [manualProvId, setManualProvId] = useState('');
  const [manualCities, setManualCities] = useState<{ id: number; name: string; postal_code?: string }[]>([]);
  const [manualCityId, setManualCityId] = useState('');
  const [loadingManualCities, setLoadingManualCities] = useState(false);

  // Para editar cliente
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editProvId, setEditProvId] = useState('');
  const [editCities, setEditCities] = useState<{ id: number; name: string; postal_code?: string }[]>([]);
  const [editCityId, setEditCityId] = useState('');
  const [loadingEditCities, setLoadingEditCities] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    dni: '',
    address: '',
    province: '',
    city: '',
    postal_code: '',
    password: '',
    customer_type: 'normal' as 'normal' | 'wholesale' | 'special_wholesale',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Cargar provincias una sola vez al montar
  useEffect(() => {
    fetch('/api/locations/provinces')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProvinces(data);
      })
      .catch(err => console.error('Error cargando provincias:', err));
  }, []);

  const handleManualProvinceChange = async (provId: string) => {
    setManualProvId(provId);
    setManualCityId('');
    const foundProv = provinces.find(p => p.id.toString() === provId);
    updateManualField('province', foundProv?.name || '');
    updateManualField('city', '');
    updateManualField('postal_code', '');

    if (provId) {
      setLoadingManualCities(true);
      try {
        const res = await fetch(`/api/locations/provinces/${provId}/cities`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setManualCities(data);
        } else {
          setManualCities([]);
        }
      } catch {
        setManualCities([]);
      } finally {
        setLoadingManualCities(false);
      }
    } else {
      setManualCities([]);
    }
  };

  const handleManualCityChange = (cityId: string) => {
    setManualCityId(cityId);
    const foundCity = manualCities.find(c => c.id.toString() === cityId);
    updateManualField('city', foundCity?.name || '');
    if (foundCity?.postal_code) {
      updateManualField('postal_code', foundCity.postal_code);
    }
  };

  const handleEditProvinceChange = async (provId: string) => {
    setEditProvId(provId);
    setEditCityId('');
    const foundProv = provinces.find(p => p.id.toString() === provId);
    updateEditField('province', foundProv?.name || '');
    updateEditField('city', '');
    updateEditField('postal_code', '');

    if (provId) {
      setLoadingEditCities(true);
      try {
        const res = await fetch(`/api/locations/provinces/${provId}/cities`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setEditCities(data);
        } else {
          setEditCities([]);
        }
      } catch {
        setEditCities([]);
      } finally {
        setLoadingEditCities(false);
      }
    } else {
      setEditCities([]);
    }
  };

  const handleEditCityChange = (cityId: string) => {
    setEditCityId(cityId);
    const foundCity = editCities.find(c => c.id.toString() === cityId);
    updateEditField('city', foundCity?.name || '');
    if (foundCity?.postal_code) {
      updateEditField('postal_code', foundCity.postal_code);
    }
  };

  const updateEditField = (field: string, value: any) => {
    if (editModalError) setEditModalError(null);
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenEdit = async (c: Customer) => {
    setEditingCustomer(c);
    setEditModalError(null);
    setEditForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      dni: c.dni || '',
      address: c.address || '',
      province: c.province || '',
      city: c.city || '',
      postal_code: c.postal_code || '',
      password: '',
      customer_type: (c.customer_type || (c.is_special_wholesale ? 'special_wholesale' : c.is_wholesale ? 'wholesale' : 'normal')) as any,
    });

    // Auto-detectar provincia y cargar localidades para edición
    if (c.province) {
      let currentProvinces = provinces;
      if (currentProvinces.length === 0) {
        try {
          const pRes = await fetch('/api/locations/provinces');
          currentProvinces = await pRes.json();
          if (Array.isArray(currentProvinces)) setProvinces(currentProvinces);
        } catch {}
      }

      const foundProv = currentProvinces.find(p => p.name.trim().toLowerCase() === c.province?.trim().toLowerCase());
      if (foundProv) {
        setEditProvId(foundProv.id.toString());
        setLoadingEditCities(true);
        try {
          const res = await fetch(`/api/locations/provinces/${foundProv.id}/cities`);
          const cData = await res.json();
          if (Array.isArray(cData)) {
            setEditCities(cData);
            if (c.city) {
              const foundCity = cData.find((ci: any) => ci.name.trim().toLowerCase() === c.city?.trim().toLowerCase());
              if (foundCity) {
                setEditCityId(foundCity.id.toString());
              } else {
                setEditCityId('');
              }
            }
          }
        } catch {
          setEditCities([]);
        } finally {
          setLoadingEditCities(false);
        }
      } else {
        setEditProvId('');
        setEditCities([]);
        setEditCityId('');
      }
    } else {
      setEditProvId('');
      setEditCities([]);
      setEditCityId('');
    }
  };

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

  // Cambiar tipo de cliente (Normal, Mayorista, Mayorista Especial)
  const handleUpdateCustomerType = async (customer: Customer, newType: 'normal' | 'wholesale' | 'special_wholesale') => {
    setActionLoadingId(customer.id);
    try {
      const isWholesale = newType === 'wholesale' || newType === 'special_wholesale';
      const isSpecialWholesale = newType === 'special_wholesale';
      const res = await fetch(`${API_URL}/api/admin/users/${customer.id}/wholesale`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_type: newType,
          is_wholesale: isWholesale,
          is_special_wholesale: isSpecialWholesale,
        }),
      });
      if (res.ok) {
        const label = newType === 'special_wholesale' ? 'Mayorista Especial (Precios Manuales)' : newType === 'wholesale' ? 'Mayorista Estándar' : 'Cliente Normal';
        showAlert(`✓ ${customer.name} ahora es ${label}.`, 'success');
        fetchCustomers();
      } else {
        showAlert('Error al actualizar tipo de cliente.', 'error');
      }
    } catch {
      showAlert('Error de red.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Crear cliente manualmente desde el panel de admin
  const handleCreateManualCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualModalError(null);

    // Validaciones locales antes de enviar al servidor
    if (!manualForm.name.trim()) {
      const msg = '⚠️ El nombre completo del cliente es obligatorio.';
      setManualModalError(msg);
      showAlert(msg, 'error');
      return;
    }
    if (!manualForm.email.trim()) {
      const msg = '⚠️ El correo electrónico es obligatorio.';
      setManualModalError(msg);
      showAlert(msg, 'error');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualForm.email.trim())) {
      const msg = '⚠️ El formato del correo electrónico no es válido (ejemplo: usuario@correo.com).';
      setManualModalError(msg);
      showAlert(msg, 'error');
      return;
    }
    if (!manualForm.phone.trim()) {
      const msg = '⚠️ El teléfono / WhatsApp del cliente es obligatorio.';
      setManualModalError(msg);
      showAlert(msg, 'error');
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          name: manualForm.name.trim(),
          email: manualForm.email.trim().toLowerCase(),
          phone: manualForm.phone.trim(),
          dni: manualForm.dni.trim(),
          address: manualForm.address.trim(),
          province: manualForm.province.trim(),
          city: manualForm.city.trim(),
          postal_code: manualForm.postal_code.trim(),
          password: manualForm.password || 'perfumeria123',
          customer_type: manualForm.customer_type,
          is_wholesale: manualForm.customer_type === 'wholesale' || manualForm.customer_type === 'special_wholesale',
          is_special_wholesale: manualForm.customer_type === 'special_wholesale',
        }),
      });

      if (res.ok) {
        const typeLabel = manualForm.customer_type === 'special_wholesale'
          ? 'Mayorista Especial'
          : manualForm.customer_type === 'wholesale'
          ? 'Mayorista'
          : 'Normal';
        showAlert(`✅ Cliente "${manualForm.name}" creado exitosamente como ${typeLabel}.`, 'success');
        setShowCreateManualModal(false);
        setManualModalError(null);
        setManualProvId('');
        setManualCities([]);
        setManualCityId('');
        setManualForm({
          name: '',
          email: '',
          phone: '',
          dni: '',
          address: '',
          province: '',
          city: '',
          postal_code: '',
          password: 'perfumeria123',
          customer_type: 'normal',
        });
        fetchCustomers();
      } else {
        const err = await res.json().catch(() => ({}));
        const errorDetail = err.detail || (err.technical ? `Error en la base de datos: ${err.technical}` : '❌ Error inesperado al crear el cliente. Por favor intentá nuevamente.');
        setManualModalError(errorDetail);
        showAlert(errorDetail, 'error');
      }
    } catch (err: any) {
      console.error('Error de red al crear cliente:', err);
      const networkError = '❌ No se pudo conectar con el servidor. Verificá que el servidor esté activo e intentá nuevamente.';
      setManualModalError(networkError);
      showAlert(networkError, 'error');
    } finally {
      setSubmittingManual(false);
    }
  };

  // Guardar edición de cliente
  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditModalError(null);

    // Validaciones locales
    if (!editForm.name.trim()) {
      const msg = '⚠️ El nombre completo del cliente es obligatorio.';
      setEditModalError(msg);
      showAlert(msg, 'error');
      return;
    }
    if (!editForm.email.trim()) {
      const msg = '⚠️ El correo electrónico es obligatorio.';
      setEditModalError(msg);
      showAlert(msg, 'error');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      const msg = '⚠️ El formato del correo electrónico no es válido (ejemplo: usuario@correo.com).';
      setEditModalError(msg);
      showAlert(msg, 'error');
      return;
    }
    if (!editForm.phone.trim()) {
      const msg = '⚠️ El teléfono / WhatsApp del cliente es obligatorio.';
      setEditModalError(msg);
      showAlert(msg, 'error');
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${editingCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim(),
          dni: editForm.dni.trim(),
          address: editForm.address.trim(),
          province: editForm.province.trim(),
          city: editForm.city.trim(),
          postal_code: editForm.postal_code.trim(),
          password: editForm.password ? editForm.password.trim() : undefined,
          customer_type: editForm.customer_type,
          is_wholesale: editForm.customer_type === 'wholesale' || editForm.customer_type === 'special_wholesale',
          is_special_wholesale: editForm.customer_type === 'special_wholesale',
        }),
      });

      if (res.ok) {
        showAlert(`✅ Cliente "${editForm.name}" actualizado exitosamente.`, 'success');
        setEditingCustomer(null);
        setEditModalError(null);
        fetchCustomers();
      } else {
        const err = await res.json().catch(() => ({}));
        const errorDetail = err.detail || '❌ Error al actualizar el cliente.';
        setEditModalError(errorDetail);
        showAlert(errorDetail, 'error');
      }
    } catch (err: any) {
      console.error('Error al actualizar cliente:', err);
      const networkError = '❌ Error de conexión al actualizar el cliente.';
      setEditModalError(networkError);
      showAlert(networkError, 'error');
    } finally {
      setSubmittingEdit(false);
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Solicitudes de Registro y Clientes</h3>
              <p className="text-xs text-slate-500 mt-0.5">Aprobá las solicitudes de registro y gestioná los tipos de clientes</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono..."
                  className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white w-full sm:w-64 md:w-72"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setManualModalError(null);
                  setManualProvId('');
                  setManualCities([]);
                  setManualCityId('');
                  setShowCreateManualModal(true);
                }}
                className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                Nuevo Cliente
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-4">
            {([
              { key: 'pending', label: 'Pendientes de Aprobación', count: pending.length, color: 'amber' },
              { key: 'approved', label: 'Aprobados (Web)', count: approved.length, color: 'green' },
              { key: 'mostrador', label: 'Clientes Mostrador', count: posClients.length, color: 'cyan' },
              { key: 'all', label: 'Todos (Web)', count: customers.length, color: 'slate' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  filter === tab.key
                    ? tab.color === 'amber' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : tab.color === 'green' ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black shrink-0 ${
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

                    {/* Mayorista / Tipo de Cliente */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {c.is_special_wholesale || c.customer_type === 'special_wholesale' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-sm" title="Ventas con precios manuales por producto">
                            <span className="material-symbols-outlined text-[13px] text-amber-600">crown</span>
                            Mayorista Especial
                          </span>
                        ) : c.is_wholesale || c.customer_type === 'wholesale' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            <span className="material-symbols-outlined text-[12px]">verified</span>
                            Mayorista
                          </span>
                        ) : c.wholesale_until && new Date(c.wholesale_until) > new Date() ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title={`Vence el ${new Date(c.wholesale_until).toLocaleDateString('es-AR')}`}>
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            30D ({Math.ceil((new Date(c.wholesale_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Normal</span>
                        )}

                        <select
                          value={c.is_special_wholesale || c.customer_type === 'special_wholesale' ? 'special_wholesale' : (c.is_wholesale || c.customer_type === 'wholesale') ? 'wholesale' : 'normal'}
                          onChange={(e) => handleUpdateCustomerType(c, e.target.value as any)}
                          disabled={actionLoadingId === c.id}
                          className="text-[11px] font-bold rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-slate-300"
                        >
                          <option value="normal">👤 Normal</option>
                          <option value="wholesale">🏷️ Mayorista</option>
                          <option value="special_wholesale">👑 Mayorista Especial</option>
                        </select>
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
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          disabled={actionLoadingId === c.id}
                          className="size-8 inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-primary hover:border-primary/50 transition-all disabled:opacity-30 shadow-sm"
                          title="Editar cliente"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
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
      {/* Modal Crear Cliente Manualmente (Administrador) */}
      {showCreateManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">person_add</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Crear Nuevo Cliente</h3>
                  <p className="text-xs text-slate-500">Alta manual de usuario con perfil y modalidad de compra</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateManualModal(false)}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateManualCustomer} className="space-y-4 pt-4">
              
              {/* Selector de Tipo de Cliente */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Tipo de Cliente / Modalidad de Precios <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => updateManualField('customer_type', 'normal')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      manualForm.customer_type === 'normal'
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-base">person</span>
                      Normal
                    </div>
                    <p className="text-[11px] opacity-75">Cliente regular minorista con precios de catálogo.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateManualField('customer_type', 'wholesale')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      manualForm.customer_type === 'wholesale'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-base text-purple-600">verified</span>
                      Mayorista
                    </div>
                    <p className="text-[11px] opacity-75">Aplica descuentos y lista de precios mayoristas.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateManualField('customer_type', 'special_wholesale')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      manualForm.customer_type === 'special_wholesale'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-base text-amber-600">crown</span>
                      Mayorista Especial
                    </div>
                    <p className="text-[11px] opacity-75">Asignación manual de precios por producto en ventas.</p>
                  </button>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.name}
                    onChange={e => updateManualField('name', e.target.value)}
                    placeholder="Ej: Laura González"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={manualForm.email}
                    onChange={e => updateManualField('email', e.target.value)}
                    placeholder="cliente@correo.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    value={manualForm.phone}
                    onChange={e => updateManualField('phone', e.target.value)}
                    placeholder="Ej: 3764123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">DNI / Identificación</label>
                  <input
                    type="text"
                    value={manualForm.dni}
                    onChange={e => updateManualField('dni', e.target.value)}
                    placeholder="Ej: 35123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                {/* Selector de Provincia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Provincia
                  </label>
                  <select
                    value={manualProvId}
                    onChange={e => handleManualProvinceChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  >
                    <option value="">Seleccionar Provincia...</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Selector de Localidad / Ciudad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Localidad / Ciudad
                  </label>
                  <select
                    value={manualCityId}
                    onChange={e => handleManualCityChange(e.target.value)}
                    disabled={!manualProvId || loadingManualCities}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white disabled:opacity-50"
                  >
                    <option value="">
                      {loadingManualCities ? 'Cargando localidades...' : !manualProvId ? 'Elegí primero una provincia' : 'Seleccionar Localidad...'}
                    </option>
                    {manualCities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Código Postal */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={manualForm.postal_code}
                    onChange={e => updateManualField('postal_code', e.target.value)}
                    placeholder="Ej: 3600"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dirección (Calle, N°, Piso, Depto)
                  </label>
                  <input
                    type="text"
                    value={manualForm.address}
                    onChange={e => updateManualField('address', e.target.value)}
                    placeholder="Ej: Av. Antártida Argentina 1035, Piso 2, Depto B"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña Inicial</label>
                  <input
                    type="text"
                    value={manualForm.password}
                    onChange={e => updateManualField('password', e.target.value)}
                    placeholder="perfumeria123"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">El cliente puede usar esta clave para acceder a la tienda online.</p>
                </div>
              </div>

              {manualForm.customer_type === 'special_wholesale' && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="material-symbols-outlined text-lg text-amber-600 shrink-0">crown</span>
                  <div>
                    <p className="font-bold">Modalidad Mayorista Especial seleccionada</p>
                    <p className="text-[11px] opacity-85 mt-0.5">Al registrar ventas a este cliente en Caja / Punto de Venta, podrás editar manualmente el precio de venta de cada producto añadido.</p>
                  </div>
                </div>
              )}

              {manualModalError && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-2xl p-4 text-xs font-semibold flex items-start gap-3 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-red-600 text-xl shrink-0">error</span>
                  <div className="flex-1">
                    <p className="font-bold text-red-900 dark:text-red-100">No se pudo registrar el cliente:</p>
                    <p className="mt-0.5 leading-relaxed font-normal">{manualModalError}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateManualModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
                >
                  {submittingManual ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Creando Cliente...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">how_to_reg</span>
                      Crear Cliente
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar Cliente (Administrador) */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">edit_note</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Editar Cliente</h3>
                  <p className="text-xs text-slate-500">Modificar datos, modalidad de precios y acceso de {editingCustomer.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-4 pt-4">
              
              {/* Selector de Tipo de Cliente */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Tipo de Cliente / Modalidad de Precios <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => updateEditField('customer_type', 'normal')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      editForm.customer_type === 'normal'
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-base">person</span>
                      Normal
                    </div>
                    <p className="text-[11px] opacity-75">Cliente regular minorista con precios de catálogo.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateEditField('customer_type', 'wholesale')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      editForm.customer_type === 'wholesale'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-base text-purple-600">verified</span>
                      Mayorista
                    </div>
                    <p className="text-[11px] opacity-75">Aplica descuentos y lista de precios mayoristas.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateEditField('customer_type', 'special_wholesale')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      editForm.customer_type === 'special_wholesale'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-base text-amber-600">crown</span>
                      Mayorista Especial
                    </div>
                    <p className="text-[11px] opacity-75">Asignación manual de precios por producto en ventas.</p>
                  </button>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => updateEditField('name', e.target.value)}
                    placeholder="Ej: Laura González"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => updateEditField('email', e.target.value)}
                    placeholder="cliente@correo.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={e => updateEditField('phone', e.target.value)}
                    placeholder="Ej: 3764123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">DNI / Identificación</label>
                  <input
                    type="text"
                    value={editForm.dni}
                    onChange={e => updateEditField('dni', e.target.value)}
                    placeholder="Ej: 35123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                {/* Selector de Provincia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Provincia
                  </label>
                  <select
                    value={editProvId}
                    onChange={e => handleEditProvinceChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  >
                    <option value="">Seleccionar Provincia...</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Selector de Localidad / Ciudad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Localidad / Ciudad
                  </label>
                  <select
                    value={editCityId}
                    onChange={e => handleEditCityChange(e.target.value)}
                    disabled={!editProvId || loadingEditCities}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white disabled:opacity-50"
                  >
                    <option value="">
                      {loadingEditCities ? 'Cargando localidades...' : !editProvId ? 'Elegí primero una provincia' : 'Seleccionar Localidad...'}
                    </option>
                    {editCities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Código Postal */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={editForm.postal_code}
                    onChange={e => updateEditField('postal_code', e.target.value)}
                    placeholder="Ej: 3600"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dirección (Calle, N°, Piso, Depto)
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => updateEditField('address', e.target.value)}
                    placeholder="Ej: Av. Antártida Argentina 1035, Piso 2, Depto B"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nueva Contraseña (Opcional)</label>
                  <input
                    type="text"
                    value={editForm.password}
                    onChange={e => updateEditField('password', e.target.value)}
                    placeholder="Dejar en blanco para conservar la actual"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary dark:text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Si escribís una nueva contraseña, se actualizará el acceso del cliente a la tienda online.</p>
                </div>
              </div>

              {editForm.customer_type === 'special_wholesale' && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="material-symbols-outlined text-lg text-amber-600 shrink-0">crown</span>
                  <div>
                    <p className="font-bold">Modalidad Mayorista Especial seleccionada</p>
                    <p className="text-[11px] opacity-85 mt-0.5">Al registrar ventas a este cliente en Caja / Punto de Venta, podrás editar manualmente el precio de venta de cada producto añadido.</p>
                  </div>
                </div>
              )}

              {editModalError && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-2xl p-4 text-xs font-semibold flex items-start gap-3 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-red-600 text-xl shrink-0">error</span>
                  <div className="flex-1">
                    <p className="font-bold text-red-900 dark:text-red-100">No se pudo actualizar el cliente:</p>
                    <p className="mt-0.5 leading-relaxed font-normal">{editModalError}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
                >
                  {submittingEdit ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Guardando Cambios...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      Guardar Cambios
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

