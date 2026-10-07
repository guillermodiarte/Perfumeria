'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { fetchApi } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';

// ─── SVG provider icons ───────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

// ─── OAuth button ──────────────────────────────────────────────────────────────

interface OAuthButtonProps {
  provider: 'google' | 'facebook' | 'twitter';
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  borderClass: string;
  hoverClass: string;
  onClick: () => void;
  loading: boolean;
}

function OAuthButton({ label, icon, bgClass, textClass, borderClass, hoverClass, onClick, loading }: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-200 ${bgClass} ${textClass} ${borderClass} ${hoverClass} disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Main AuthModal ────────────────────────────────────────────────────────────

export default function AuthModal() {
  const { isOpen, view, closeModal, setView, executePendingAction } = useAuthModalStore();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const { data: session, status } = useSession();

  // Login State (manual — kept but only for reference, disabled in UI)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State (kept for later, hidden in UI)
  const [regData, setRegData] = useState({
    name: '', email: '', phone: '', password: '',
    address: '', province: '', province_id: '',
    city: '', city_id: '', postal_code: ''
  });
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  // Shared State
  const [error, setError] = useState('');
  const [pendingMsg, setPendingMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closeModal]);

  // Fetch provinces on mount if needed (register kept for later)
  useEffect(() => {
    if (isOpen && view === 'register' && provinces.length === 0) {
      fetchApi('/api/locations/provinces')
        .then(data => setProvinces(data))
        .catch(() => console.error('Error cargando provincias'));
    }
  }, [isOpen, view, provinces.length]);

  const handleOAuth = (provider: string) => {
    setOauthLoading(provider);
    setError('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_logged_out');
    }
    signIn(provider);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_logged_out');
    }
    setError(''); setPendingMsg(''); setLoading(true);
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
      const msg: string = err.message || 'Error al iniciar sesión';
      if (msg.startsWith('pending_approval:')) {
        setPendingMsg(msg.replace('pending_approval:', ''));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setPendingMsg(''); setLoading(true);
    try {
      await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(regData)
      });
      setSuccessMsg('¡Solicitud enviada! Tu cuenta está a la espera de la aprobación de un administrador. Te avisaremos cuando esté lista.');
    } catch (err: any) {
      const msg: string = err.message || 'Error al registrarse';
      if (msg.startsWith('pending_approval:')) {
        setPendingMsg(msg.replace('pending_approval:', ''));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

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

  if (!isOpen) return null;

  const isOAuthLoading = oauthLoading !== null;

  // ─── Shared OAuth buttons block ─────────────────────────────────────────────
  const OAuthButtons = (
    <div className="space-y-3">
      <OAuthButton
        provider="google"
        label="Continuar con Google"
        icon={<GoogleIcon />}
        bgClass="bg-white dark:bg-slate-900"
        textClass="text-slate-700 dark:text-slate-200"
        borderClass="border-slate-300 dark:border-slate-600"
        hoverClass="hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-sm"
        onClick={() => handleOAuth('google')}
        loading={isOAuthLoading}
      />
      <OAuthButton
        provider="facebook"
        label="Continuar con Facebook"
        icon={<FacebookIcon />}
        bgClass="bg-[#1877F2] dark:bg-[#1877F2]"
        textClass="text-white"
        borderClass="border-[#1877F2]"
        hoverClass="hover:bg-[#166FE5] hover:border-[#166FE5] hover:shadow-sm"
        onClick={() => handleOAuth('facebook')}
        loading={isOAuthLoading}
      />
      <OAuthButton
        provider="twitter"
        label="Continuar con X (Twitter)"
        icon={<XIcon />}
        bgClass="bg-black dark:bg-white"
        textClass="text-white dark:text-black"
        borderClass="border-black dark:border-white"
        hoverClass="hover:bg-gray-900 dark:hover:bg-gray-100 hover:shadow-sm"
        onClick={() => handleOAuth('twitter')}
        loading={isOAuthLoading}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />

      <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-700 rounded-full z-10"
        >
          <span className="material-symbols-outlined text-lg block">close</span>
        </button>

        <div className="p-8 overflow-y-auto">
          {view === 'login' ? (
            // ─── LOGIN VIEW ─────────────────────────────────────────────────
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">lock_open</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Iniciar Sesión</h2>
                <p className="text-slate-500 mt-2 text-sm">Elegí con qué cuenta querés acceder</p>
              </div>

              {/* Messages */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  {error}
                </div>
              )}
              {pendingMsg && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-6 text-sm font-bold flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">schedule</span>
                  <span>{pendingMsg}</span>
                </div>
              )}

              {/* OAuth Buttons */}
              {OAuthButtons}

              {/* Divider — manual login still works for existing email/password users */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">o con email</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none transition-colors"
                    placeholder="tucorreo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Contraseña</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || isOAuthLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                </button>
              </form>

              {/* Link to register (disabled until SMTP ready) */}
              <div className="mt-6 text-center text-sm text-slate-500">
                ¿No tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setView('register')}
                  className="text-primary font-bold hover:underline"
                >
                  Registrarse
                </button>
              </div>
            </div>
          ) : (
            // ─── REGISTER VIEW ───────────────────────────────────────────────
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Crear Cuenta</h2>
                <p className="text-slate-500 mt-1 text-sm">Registrate fácilmente con tus redes sociales</p>
              </div>

              {/* Messages */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-4 text-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  {error}
                </div>
              )}
              {pendingMsg && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-4 text-sm font-bold flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">schedule</span>
                  <span>{pendingMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl mb-4 text-sm font-bold flex items-start gap-3">
                  <span className="material-symbols-outlined text-green-600 text-lg shrink-0 mt-0.5">check_circle</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {/* OAuth Buttons (same as login — sign-up happens automatically) */}
              {OAuthButtons}

              {/* Manual register — DISABLED until SMTP is set up */}
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 p-5">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-xl shrink-0 mt-0.5">construction</span>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Registro manual temporalmente deshabilitado</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Por el momento podés registrarte usando Google, Facebook o X. El registro con email estará disponible próximamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hidden form (preserved for when SMTP is ready) */}
              <form onSubmit={handleRegister} className="hidden space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                    <input required type="text" value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input required type="email" value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
                    <input required type="password" value={regData.password} onChange={e => setRegData({ ...regData, password: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Celular</label>
                    <input required type="text" value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
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
                    <input required type="text" value={regData.address} onChange={e => setRegData({ ...regData, address: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm" />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl mt-6 transition-all disabled:opacity-50">
                  {loading ? 'Procesando...' : 'Crear Cuenta'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                ¿Ya tenés cuenta?{' '}
                <button type="button" onClick={() => setView('login')} className="text-primary font-bold hover:underline">
                  Iniciar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
