'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const token = useAuthStore(s => s.token);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    address: user?.address || '',
    province: user?.province || '',
    city: user?.city || '',
    postal_code: user?.postal_code || ''
  });

  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Track selected IDs for dropdowns based on names stored in user
  const [selectedProvId, setSelectedProvId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApi('/api/locations/provinces')
      .then(data => {
        setProvinces(data);
        if (user?.province) {
          const prov = data.find((p: any) => p.name === user.province);
          if (prov) {
            setSelectedProvId(prov.id.toString());
            fetchApi(`/api/locations/provinces/${prov.id}/cities`)
              .then(cData => {
                setCities(cData);
                if (user?.city) {
                  const city = cData.find((c: any) => c.name === user.city);
                  if (city) setSelectedCityId(city.id.toString());
                }
              });
          }
        }
      })
      .catch(() => console.error("Error cargando provincias"));
  }, [user]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provId = e.target.value;
    setSelectedProvId(provId);
    setSelectedCityId('');
    
    const selectedProv = provinces.find(p => p.id.toString() === provId);
    if (!selectedProv) return;

    setFormData({ 
      ...formData, 
      province: selectedProv.name,
      city: '',
      postal_code: '' 
    });

    fetchApi(`/api/locations/provinces/${provId}/cities`)
      .then(data => setCities(data));
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    setSelectedCityId(cityId);
    
    const selectedCity = cities.find(c => c.id.toString() === cityId);
    if (!selectedCity) return;

    setFormData({
      ...formData,
      city: selectedCity.name,
      postal_code: selectedCity.postal_code || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password;

      const updatedUser = await fetchApi('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      setUser(updatedUser);
      setSuccess('Datos actualizados correctamente.');
    } catch (err: any) {
      setError(err.message || 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Mis Datos Personales</h1>
        <p className="text-slate-500 mt-2">Actualiza tu información de contacto y envío.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-xl mb-6 text-sm font-medium">
          {success}
          {user && !user.email_verified && " Se ha enviado un nuevo enlace de verificación a tu correo."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Datos Personales</h3>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Celular</label>
              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nueva Contraseña (Opcional)</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Dejar en blanco para no cambiar" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Dirección de Envío</h3>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Provincia</label>
              <select value={selectedProvId} onChange={handleProvinceChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none">
                <option value="">Selecciona tu provincia...</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Localidad</label>
              <select value={selectedCityId} onChange={handleCityChange} disabled={!selectedProvId} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none disabled:opacity-50">
                <option value="">Selecciona tu localidad...</option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">C. Postal</label>
                <input readOnly type="text" value={formData.postal_code} className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-500" placeholder="Automático" />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Dirección (Calle, N°)</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto px-8 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
