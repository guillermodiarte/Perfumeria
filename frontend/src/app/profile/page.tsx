'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Pencil, X, ShieldAlert, ArrowRight } from 'lucide-react';

// ─── Labels map ─────────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre Completo',
  email: 'Email',
  phone: 'Celular',
  province: 'Provincia',
  city: 'Localidad',
  postal_code: 'Código Postal',
  address: 'Dirección',
  password: 'Contraseña',
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  province: string;
  city: string;
  postal_code: string;
}

interface ChangeItem {
  key: string;
  label: string;
  oldVal: string;
  newVal: string;
  isPassword: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);

  // ── Build snapshot from user ─────────────────────────────────────────────
  const buildSnapshot = (): FormState => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    address: user?.address || '',
    province: user?.province || '',
    city: user?.city || '',
    postal_code: user?.postal_code || '',
  });

  const [formData, setFormData] = useState<FormState>(buildSnapshot);
  const [savedData, setSavedData] = useState<FormState>(buildSnapshot); // reflects last-saved state

  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedProvId, setSelectedProvId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [changes, setChanges] = useState<ChangeItem[]>([]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Load provinces on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetchApi('/api/locations/provinces')
      .then((data: any[]) => {
        setProvinces(data);
        if (user?.province) {
          const prov = data.find((p: any) => p.name === user.province);
          if (prov) {
            setSelectedProvId(prov.id.toString());
            fetchApi(`/api/locations/provinces/${prov.id}/cities`)
              .then((cData: any[]) => {
                setCities(cData);
                if (user?.city) {
                  const city = cData.find((c: any) => c.name === user.city);
                  if (city) setSelectedCityId(city.id.toString());
                }
              });
          }
        }
      })
      .catch(() => console.error('Error cargando provincias'));
  }, [user]);

  useEffect(() => {
    if (user && !isEditing) {
      const snap: FormState = {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        address: user.address || '',
        province: user.province || '',
        city: user.city || '',
        postal_code: user.postal_code || '',
      };
      setFormData(snap);
      setSavedData(snap);
    }
  }, [user, isEditing]);

  // ── Province change ──────────────────────────────────────────────────────
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provId = e.target.value;
    setSelectedProvId(provId);
    setSelectedCityId('');
    const selectedProv = provinces.find(p => p.id.toString() === provId);
    setFormData(prev => ({
      ...prev,
      province: selectedProv?.name || '',
      city: '',
      postal_code: '',
    }));
    if (provId) {
      fetchApi(`/api/locations/provinces/${provId}/cities`).then((data: any[]) => setCities(data));
    } else {
      setCities([]);
    }
  };

  // ── City change → auto-fill postal code ─────────────────────────────────
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    setSelectedCityId(cityId);
    const selectedCity = cities.find(c => c.id.toString() === cityId);
    setFormData(prev => ({
      ...prev,
      city: selectedCity?.name || '',
      postal_code: selectedCity?.postal_code || '',
    }));
  };

  // ── Cancel edit ──────────────────────────────────────────────────────────
  const handleCancelEdit = () => {
    setFormData(savedData);
    setIsEditing(false);
    setError('');
    // Restore province/city IDs from savedData
    const prov = provinces.find(p => p.name === savedData.province);
    if (prov) {
      setSelectedProvId(prov.id.toString());
      fetchApi(`/api/locations/provinces/${prov.id}/cities`).then((cData: any[]) => {
        setCities(cData);
        const city = cData.find((c: any) => c.name === savedData.city);
        if (city) setSelectedCityId(city.id.toString());
      });
    } else {
      setSelectedProvId('');
      setSelectedCityId('');
      setCities([]);
    }
  };

  // ── Detect changes before showing modal ─────────────────────────────────
  const handleSaveClick = () => {
    const detected: ChangeItem[] = [];

    (Object.keys(FIELD_LABELS) as (keyof FormState)[]).forEach(key => {
      if (key === 'password') {
        if (formData.password && formData.password.length > 0) {
          detected.push({ key, label: FIELD_LABELS[key], oldVal: '', newVal: '', isPassword: true });
        }
        return;
      }
      const oldVal = savedData[key];
      const newVal = formData[key];
      if (oldVal !== newVal) {
        detected.push({ key, label: FIELD_LABELS[key], oldVal, newVal, isPassword: false });
      }
    });

    if (detected.length === 0) {
      // nothing changed
      setIsEditing(false);
      return;
    }

    setChanges(detected);
    setShowModal(true);
  };

  // ── Confirmed save ───────────────────────────────────────────────────────
  const handleConfirmSave = async () => {
    setShowModal(false);
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password;

      const updatedUser = await fetchApi('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setUser(updatedUser);
      const newSaved = buildSnapshot();
      // Use the response to build savedData
      const freshSaved: FormState = {
        name: updatedUser.name || '',
        email: updatedUser.email || '',
        phone: updatedUser.phone || '',
        password: '',
        address: updatedUser.address || '',
        province: updatedUser.province || '',
        city: updatedUser.city || '',
        postal_code: updatedUser.postal_code || '',
      };
      setSavedData(freshSaved);
      setFormData({ ...freshSaved });
      setSuccess('Datos actualizados correctamente.');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input styles ──────────────────────────────────────────────────
  const readonlyCls = 'w-full px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none cursor-default select-text transition-colors text-sm sm:text-base';
  const editCls = 'w-full px-4 py-2.5 sm:py-3 bg-white dark:bg-slate-800 border-2 border-primary/40 focus:border-primary rounded-xl outline-none transition-all text-slate-800 dark:text-slate-100 text-sm sm:text-base shadow-sm focus:shadow-md';
  const selectReadonlyCls = 'w-full px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none cursor-default appearance-none text-sm sm:text-base';
  const selectEditCls = 'w-full px-4 py-2.5 sm:py-3 bg-white dark:bg-slate-800 border-2 border-primary/40 focus:border-primary rounded-xl outline-none transition-all text-slate-800 dark:text-slate-100 text-sm sm:text-base shadow-sm focus:shadow-md';

  // ── Province display helper ───────────────────────────────────────────────
  const provinceDisplay = provinces.find(p => p.id.toString() === selectedProvId)?.name || formData.province || '—';
  const cityDisplay = cities.find(c => c.id.toString() === selectedCityId)?.name || formData.city || '—';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 lg:p-10 w-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Mis Datos Personales</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">
            {isEditing ? 'Editá tu información. Los cambios se confirmarán antes de guardarse.' : 'Revisá tu información de contacto y envío.'}
          </p>
        </div>

        {!isEditing ? (
          <button
            onClick={() => { setIsEditing(true); setSuccess(''); setError(''); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-xl text-sm sm:text-base hover:bg-primary/90 transition-all shadow-sm hover:shadow-md shrink-0"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        ) : (
          <button
            onClick={handleCancelEdit}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-sm sm:text-base hover:bg-slate-200 dark:hover:bg-slate-600 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        )}
      </div>

      {/* ── Wholesale Account Status Banner ─────────────────────────────────── */}
      {user?.is_wholesale ? (
        <div className="mb-6 p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
          <div>
            <p className="font-bold text-sm text-purple-900 dark:text-purple-200">
              Cuenta Mayorista Permanente Activa
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
              Tenés acceso permanente a precios y condiciones mayoristas en todo el catálogo.
            </p>
          </div>
        </div>
      ) : user?.wholesale_until && new Date(user.wholesale_until) > new Date() ? (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
            <span className="material-symbols-outlined text-xl">schedule</span>
          </div>
          <div>
            <p className="font-bold text-sm text-blue-900 dark:text-blue-200">
              Cuenta Mayorista Activa (Válida hasta el {new Date(user.wholesale_until).toLocaleDateString('es-AR')})
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Si realizás una nueva compra mayorista antes del vencimiento, el beneficio se renueva automáticamente por 30 días más.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-xl mb-6 text-sm font-medium">
          {success}
        </div>
      )}

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
        {/* LEFT: Personal */}
        <div className="space-y-5">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
            Datos Personales
          </h3>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nombre Completo</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={editCls}
              />
            ) : (
              <div className={readonlyCls}>{formData.name || '—'}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            {isEditing ? (
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={editCls}
              />
            ) : (
              <div className={readonlyCls}>{formData.email || '—'}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Celular</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className={editCls}
              />
            ) : (
              <div className={readonlyCls}>{formData.phone || '—'}</div>
            )}
          </div>

          {isEditing && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nueva Contraseña <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="Dejar en blanco para no cambiar"
                className={editCls}
              />
            </div>
          )}
        </div>

        {/* RIGHT: Address */}
        <div className="space-y-5">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
            Dirección de Envío
          </h3>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Provincia</label>
            {isEditing ? (
              <select value={selectedProvId} onChange={handleProvinceChange} className={selectEditCls}>
                <option value="">Selecciona tu provincia...</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : (
              <div className={readonlyCls}>{provinceDisplay}</div>
            )}
          </div>

          {/* Localidad and C. Postal in a responsive combined row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Localidad</label>
              {isEditing ? (
                <select
                  value={selectedCityId}
                  onChange={handleCityChange}
                  disabled={!selectedProvId}
                  className={`${selectEditCls} disabled:opacity-50`}
                >
                  <option value="">Selecciona tu localidad...</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div className={readonlyCls}>{cityDisplay}</div>
              )}
            </div>

            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                C. Postal
                {isEditing && <span className="text-primary ml-1 font-normal text-xs">(auto)</span>}
              </label>
              <div className={`${readonlyCls} ${isEditing ? 'border-dashed border-primary/40 text-primary font-bold bg-primary/5' : 'font-medium'}`}>
                {formData.postal_code || '—'}
              </div>
            </div>
          </div>

          {/* Dirección Completa - Occupies 100% of the width with large comfortable input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Dirección Completa (Calle, N°, Piso, Depto)
              </label>
              {isEditing && (
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Espacio amplio para toda la dirección
                </span>
              )}
            </div>
            {isEditing ? (
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Ej: Av. Antártida Argentina 1035, Piso 2, Depto B"
                className={`${editCls} font-medium`}
              />
            ) : (
              <div className={`${readonlyCls} font-medium min-h-[48px] flex items-center`}>
                {formData.address || '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Save button (only in edit mode) ─────────────────────────────────── */}
      {isEditing && (
        <div className="pt-8 mt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={handleSaveClick}
            disabled={loading}
            className="w-full sm:w-auto px-10 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-sm hover:shadow-md text-base"
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      )}

      {/* ── Confirmation Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 dark:text-white text-base">Confirmar Cambios</h2>
                <p className="text-xs text-slate-500">Revisá los cambios antes de guardar</p>
              </div>
            </div>

            {/* Changes list */}
            <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
              {changes.map(ch => (
                <div key={ch.key} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    {ch.label}
                  </p>
                  {ch.isPassword ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg text-xs font-semibold">
                        🔒 Se modificará tu contraseña
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-lg line-through text-xs font-mono">
                        {ch.oldVal || '(vacío)'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-lg text-xs font-mono font-semibold">
                        {ch.newVal || '(vacío)'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm"
              >
                Confirmar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
