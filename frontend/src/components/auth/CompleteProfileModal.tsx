'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/utils/api';
import { AlertTriangle, LogOut, CheckCircle2 } from 'lucide-react';

export default function CompleteProfileModal() {
  const user = useAuthStore(s => s.user);
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const logout = useAuthStore(s => s.logout);

  const [mounted, setMounted] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Location dropdowns
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedProvId, setSelectedProvId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPendingEmail = Boolean(user?.email && user.email.includes('@pending.oauth'));

  // Determine if profile is incomplete
  const isProfileIncomplete = Boolean(
    mounted &&
    user &&
    user.role !== 'admin' &&
    (!user.name?.trim() ||
     !user.phone?.trim() ||
     !user.province?.trim() ||
     !user.city?.trim() ||
     !user.postal_code?.trim() ||
     !user.address?.trim() ||
     isPendingEmail)
  );

  // Initialize form fields from user data when modal becomes relevant
  useEffect(() => {
    if (user && isProfileIncomplete) {
      setName(user.name || '');
      setEmail(isPendingEmail ? '' : user.email || '');
      setPhone(user.phone || '');
      setDni(user.dni || '');
      setAddress(user.address || '');
      setPostalCode(user.postal_code || '');
      setProvince(user.province || '');
      setCity(user.city || '');
    }
  }, [user, isProfileIncomplete, isPendingEmail]);

  // Load provinces
  useEffect(() => {
    if (isProfileIncomplete && provinces.length === 0) {
      fetchApi('/api/locations/provinces')
        .then((data: any[]) => {
          setProvinces(data);
          if (user?.province) {
            const found = data.find((p: any) => p.name === user.province);
            if (found) {
              setSelectedProvId(found.id.toString());
              fetchApi(`/api/locations/provinces/${found.id}/cities`)
                .then(cData => setCities(cData))
                .catch(() => {});
            }
          }
        })
        .catch(() => console.error('Error cargando provincias'));
    }
  }, [isProfileIncomplete, provinces.length, user?.province]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provId = e.target.value;
    setSelectedProvId(provId);
    setSelectedCityId('');
    const foundProv = provinces.find(p => p.id.toString() === provId);
    setProvince(foundProv?.name || '');
    setCity('');
    setPostalCode('');

    if (provId) {
      fetchApi(`/api/locations/provinces/${provId}/cities`)
        .then((data: any[]) => setCities(data))
        .catch(() => setCities([]));
    } else {
      setCities([]);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    setSelectedCityId(cityId);
    const foundCity = cities.find(c => c.id.toString() === cityId);
    setCity(foundCity?.name || '');
    setPostalCode(foundCity?.postal_code || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Por favor ingresá tu nombre completo.');
    if (isPendingEmail && (!email.trim() || !email.includes('@'))) {
      return setError('Por favor ingresá un correo electrónico válido.');
    }
    if (!phone.trim()) return setError('El número de celular es requerido.');
    if (!province.trim()) return setError('Por favor seleccioná tu provincia.');
    if (!city.trim()) return setError('Por favor seleccioná tu localidad.');
    if (!postalCode.trim()) return setError('El código postal es requerido.');
    if (!address.trim()) return setError('Por favor ingresá tu dirección completa.');

    setLoading(true);
    try {
      const payload: any = {
        name: name.trim(),
        phone: phone.trim(),
        dni: dni.trim() || null,
        province: province.trim(),
        city: city.trim(),
        postal_code: postalCode.trim(),
        address: address.trim(),
      };

      if (isPendingEmail) {
        payload.email = email.trim().toLowerCase();
      }

      const updatedUser = await fetchApi('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (updatedUser.access_token) {
        setToken(updatedUser.access_token);
      }
      setUser(updatedUser);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleExitRequest = () => {
    setShowExitWarning(true);
  };

  const handleConfirmLogout = () => {
    setShowExitWarning(false);
    logout();
  };

  if (!isProfileIncomplete) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={handleExitRequest}
      />

      {/* Main Modal Container */}
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button that prompts warning */}
        <button
          onClick={handleExitRequest}
          title="Cerrar"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-700 rounded-full z-20"
        >
          <span className="material-symbols-outlined text-lg block">close</span>
        </button>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">assignment_ind</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Completá tus datos para continuar
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Para finalizar la creación de tu cuenta y poder realizar pedidos, por favor completá tus datos de contacto y entrega. Solo te tomará un minuto.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Datos Personales */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-primary text-base">person</span>
                Datos Personales
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email {isPendingEmail && <span className="text-red-500">*</span>}
                  </label>
                  {isPendingEmail ? (
                    <div>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-600 rounded-xl focus:border-primary outline-none text-sm transition-colors"
                      />
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                        Tu red social no compartió tu email. Ingresalo para vincular tu cuenta.
                      </p>
                    </div>
                  ) : (
                    <input
                      readOnly
                      type="email"
                      value={user?.email || ''}
                      className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-sm cursor-not-allowed outline-none select-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Celular <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ej: 3513146924"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    DNI <span className="text-slate-400 font-normal">(opcional - para envíos)</span>
                  </label>
                  <input
                    type="text"
                    value={dni}
                    onChange={e => setDni(e.target.value)}
                    placeholder="Ej: 35123456"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Dirección de Envío */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-700">
                <span className="material-symbols-outlined text-primary text-base">local_shipping</span>
                Dirección de Envío
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Provincia <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedProvId}
                    onChange={handleProvinceChange}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Localidad <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedCityId}
                    onChange={handleCityChange}
                    disabled={!selectedProvId}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm disabled:opacity-50"
                  >
                    <option value="">Seleccionar...</option>
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    C. Postal <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    placeholder="Ej: 3600"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dirección Completa (Calle, N°, Piso, Depto) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Ej: Av. Antártida Argentina 1035, Piso 2, Depto B"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none text-sm transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleExitRequest}
                className="w-full sm:w-auto px-5 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold text-sm transition-colors text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    <span>Guardando datos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Guardar y Continuar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Exit Warning Confirmation Dialog ─────────────────────────────── */}
      {showExitWarning && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white text-center mb-2">
              Datos obligatorios para continuar
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-6 leading-relaxed">
              Estos datos son necesarios para identificar tu usuario y procesar tus pedidos. Si salís sin completarlos, <strong className="text-red-500 font-bold">se cerrará tu sesión</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowExitWarning(false)}
                className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition-all text-center"
              >
                Completar datos
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
