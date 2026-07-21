'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';

export default function AuthModal() {
  const { isOpen, view, closeModal, setView, executePendingAction } = useAuthModalStore();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closeModal]);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register State
  const [regData, setRegData] = useState({
    name: '', email: '', phone: '', password: '', 
    address: '', province: '', province_id: '', 
    city: '', city_id: '', postal_code: ''
  });
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  // Shared State
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch provinces on mount if needed
  useEffect(() => {
    if (isOpen && view === 'register' && provinces.length === 0) {
      fetchApi('/api/locations/provinces')
        .then(data => setProvinces(data))
        .catch(() => console.error("Error cargando provincias"));
    }
  }, [isOpen, view, provinces.length]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProv = provinces.find(p => p.id.toString() === e.target.value);
    if (!selectedProv) return;
    setRegData({ ...regData, province: selectedProv.name, province_id: selectedProv.id.toString(), city: '', city_id: '', postal_code: '' });
    fetchApi(`/api/locations/provinces/${selectedProv.id}/cities`)
      .then(data => setCities(data));
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCity = cities.find(c => c.id.toString() === e.target.value);
    if (!selectedCity) return;
    setRegData({ ...regData, city: selectedCity.name, city_id: selectedCity.id.toString(), postal_code: selectedCity.postal_code || '' });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      setToken(data.access_token);
      const userProfile = await fetchApi('/api/auth/me', { headers: { 'X-API-KEY': data.access_token } });
      setUser(userProfile);
      
      closeModal();
      executePendingAction();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(regData)
      });
      setSuccessMsg('¡Registro exitoso! Verifica tu correo.');
      // Switch back to login after short delay so they can login (or auto login if we supported it)
      setTimeout(() => {
        setSuccessMsg('');
        setView('login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
      
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md md:max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <button onClick={closeModal} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-700 rounded-full">
          <span className="material-symbols-outlined text-lg block">close</span>
        </button>

        <div className="p-8 overflow-y-auto">
          {view === 'login' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Iniciar Sesión</h2>
                <p className="text-slate-500 mt-2">Accede a tu cuenta para continuar</p>
              </div>

              {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold">{error}</div>}
              {successMsg && <div className="bg-green-50 text-green-600 p-4 rounded-xl mb-6 text-sm font-bold">{successMsg}</div>}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Contraseña</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl mt-6 transition-all disabled:opacity-50">
                  {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                </button>
              </form>
              
              <div className="mt-6 text-center text-sm text-slate-500">
                ¿No tienes una cuenta? <button type="button" onClick={() => setView('register')} className="text-primary font-bold hover:underline">Regístrate</button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Crear Cuenta</h2>
                <p className="text-slate-500 mt-1">Completa tus datos para registrarte</p>
              </div>

              {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-bold">{error}</div>}
              {successMsg && <div className="bg-green-50 text-green-600 p-4 rounded-xl mb-4 text-sm font-bold">{successMsg}</div>}

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                    <input required type="text" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input required type="email" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
                    <input required type="password" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Celular</label>
                    <input required type="text" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>

                  <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-700 my-2 pt-2" />

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Provincia</label>
                    <select required value={regData.province_id} onChange={handleProvinceChange} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm">
                      <option value="">Seleccione una provincia</option>
                      {provinces.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Localidad</label>
                    <select required value={regData.city_id} onChange={handleCityChange} disabled={!regData.province_id} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none disabled:opacity-50 text-sm">
                      <option value="">Seleccione una localidad</option>
                      {cities.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">C. Postal</label>
                    <input required readOnly type="text" value={regData.postal_code} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-500 text-sm" placeholder="Automático" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                    <input required type="text" value={regData.address} onChange={e => setRegData({...regData, address: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl mt-6 transition-all disabled:opacity-50">
                  {loading ? 'Procesando...' : 'Crear Cuenta'}
                </button>
              </form>
              
              <div className="mt-6 text-center text-sm text-slate-500">
                ¿Ya tienes una cuenta? <button type="button" onClick={() => setView('login')} className="text-primary font-bold hover:underline">Iniciar Sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
