'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductosView from '@/components/admin/ProductosView';
import DashboardView from '@/components/admin/DashboardView';
import SeccionesView from '@/components/admin/SeccionesView';
import ConfiguracionView from '@/components/admin/ConfiguracionView';
import ComprasView from '@/components/admin/ComprasView';
import VentasView from '@/components/admin/VentasView';
import VentasRealizadasView from '@/components/admin/VentasRealizadasView';
import PedidosWebView from '@/components/admin/PedidosWebView';
import VentasMostradorView from '@/components/admin/VentasMostradorView';
import CobrosPendientesView from '@/components/admin/CobrosPendientesView';
import NotificationBell from '@/components/admin/NotificationBell';
import FinanzasView from '@/components/admin/FinanzasView';
import ClientesView from '@/components/admin/ClientesView';
import Logo from '@/components/ui/Logo';
import { API_URL } from '@/utils/api';

export default function AdminDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  type ViewId = 'dashboard' | 'products' | 'sections' | 'compras' | 'ventas' | 'pedidos_web' | 'ventas_mostrador' | 'cobros_pendientes' | 'ventas_realizadas' | 'users' | 'admins' | 'finanzas' | 'media' | 'configuracion';
  const VALID_VIEWS: ViewId[] = ['dashboard', 'products', 'sections', 'compras', 'ventas', 'pedidos_web', 'ventas_mostrador', 'cobros_pendientes', 'ventas_realizadas', 'users', 'admins', 'finanzas', 'media', 'configuracion'];
  const getSavedView = (): ViewId => {
    if (typeof window === 'undefined') return 'dashboard';
    const v = localStorage.getItem('lyg_active_view') as ViewId | null;
    return v && VALID_VIEWS.includes(v) ? v : 'dashboard';
  };
  const [activeView, setActiveViewState] = useState<ViewId>('dashboard');
  const setActiveView = (v: ViewId) => {
    localStorage.setItem('lyg_active_view', v);
    setActiveViewState(v);
  };
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentAdminRole, setCurrentAdminRole] = useState<string>('');
  const [currentAdminName, setCurrentAdminName] = useState<string>('');
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState('editor');

  // User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');

  // Custom Alert Modal State
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const showAlert = (msg: string) => setAlertMessage(msg);

  // Key counter to force reset SeccionesView when clicking menu item again
  const [sectionsKey, setSectionsKey] = useState(0);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionData, setSectionData] = useState<any>({});

  // Media State
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [mediaCategories, setMediaCategories] = useState<string[]>([]);
  const [selectedMediaCategory, setSelectedMediaCategory] = useState<string>('');
  const [mediaSearch, setMediaSearch] = useState('');
  const [deleteConfirmParams, setDeleteConfirmParams] = useState<{ category: string, filename: string } | null>(null);
  const [isExportingMedia, setIsExportingMedia] = useState(false);
  const [isImportingMedia, setIsImportingMedia] = useState(false);

  // Pending customers badge count
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setActiveViewState(getSavedView());
    const saved = localStorage.getItem('lyg_api_key');
    if (saved) {
      verifyToken(saved).finally(() => {
        setCheckingAuth(false);
      });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categories`);
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (e) { }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/products`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/admins`, {
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        const token = data.access_token;
        setApiKey(token);
        setCurrentAdminRole(data.role || 'admin');
        setCurrentAdminName(data.name || 'Admin');
        setCurrentAdminEmail(data.email || email);
        setIsAuthenticated(true);
        localStorage.setItem('lyg_api_key', token);
        fetchProducts();
        fetchCategories();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert(err.detail || "Credenciales incorrectas");
      }
    } catch (e) {
      showAlert("Error al conectar con el servidor. Verifica tu conexión.");
    }
  };

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/me`, { headers: { 'X-API-KEY': token } });
      if (res.ok) {
        const me = await res.json();
        setCurrentAdminRole(me.role || 'admin');
        setCurrentAdminName(me.name || 'Admin');
        setCurrentAdminEmail(me.email || '');
        setIsAuthenticated(true);
        setApiKey(token);
        fetchProducts();
        fetchCategories();
      } else {
        handleLogout();
      }
    } catch (e) {
      console.error(e);
      handleLogout();
    }
  };

  useEffect(() => {
    if (apiKey && isAuthenticated) {
      if (activeView === 'admins') {
        if (currentAdminRole === 'super_admin') {
          fetchAdmins();
        } else {
          setActiveView('products');
        }
      } else {
        fetchUsers();
      }
      if (activeView === 'sections' && currentAdminRole !== 'super_admin') {
        setActiveView('products');
      }
      if (activeView === 'media') {
        fetchMedia(selectedMediaCategory);
      }
    }
  }, [apiKey, isAuthenticated, activeView, currentAdminRole]);

  const handleLogout = () => {
    setApiKey('');
    setIsAuthenticated(false);
    setCurrentAdminRole('');
    setCurrentAdminName('');
    setCurrentAdminEmail('');
    localStorage.removeItem('lyg_api_key');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Borrar este producto?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) fetchProducts();
    } catch (e) {
      console.error("Error al borrar", e);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return showAlert("Falta el Email");
    if (!editingUser && !userPassword) return showAlert("Falta la Contraseña");

    const isAdminView = activeView === 'admins';
    const payload: any = { email: userEmail, role: newUserRole };
    if (userName) payload.name = userName;
    if (userPhone) payload.phone = userPhone;
    if (userPassword) payload.password = userPassword;

    const baseUrl = isAdminView ? `${API_URL}/api/admin/admins` : `${API_URL}/api/admin/users`;
    const url = editingUser ? `${baseUrl}/${editingUser.id}` : baseUrl;
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showAlert(editingUser ? "Usuario actualizado" : "Usuario creado con éxito");
        if (isAdminView) fetchAdmins(); else fetchUsers();
        setShowUserModal(false);
      } else {
        const data = await res.json();
        showAlert(data.detail || "Error guardando usuario");
      }
    } catch (e) {
      showAlert("Falla de red.");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Borrar este usuario admin?')) return;
    const isAdminView = activeView === 'admins';
    const baseUrl = isAdminView ? `${API_URL}/api/admin/admins` : `${API_URL}/api/admin/users`;
    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        if (isAdminView) fetchAdmins(); else fetchUsers();
      } else {
        const d = await res.json();
        showAlert(d.detail);
      }
    } catch (e) {
      console.error("Error al borrar", e);
    }
  };

  const fetchMedia = async (category: string = '') => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/media${category ? `?category=${category}` : ''}`, {
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        setMediaCategories(data.categories);
        setMediaFiles(data.files);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const category = selectedMediaCategory || 'Otros';

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/media?category=${category}`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey },
        body: formData
      });
      if (res.ok) {
        showAlert('Archivo subido exitosamente.');
        fetchMedia(selectedMediaCategory);
      } else {
        showAlert('Error al subir el archivo.');
      }
    } catch (err) {
      showAlert('Error de red al subir archivo.');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>, slideIdx: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/media?category=Banners`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        const newSlides = [...sectionData.slides];
        newSlides[slideIdx].mediaUrl = data.url;
        setSectionData({ ...sectionData, slides: newSlides });
        showAlert('Archivo subido exitosamente y asignado al slide.');
      } else {
        showAlert('Error al subir el archivo.');
      }
    } catch (err) {
      showAlert('Error de red al subir archivo.');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleMoveMedia = async (category: string, filename: string, targetCategory: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/media/move?category=${encodeURIComponent(category)}&filename=${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_category: targetCategory })
      });
      if (res.ok) {
        fetchMedia(selectedMediaCategory);
      } else {
        showAlert('Error al mover archivo.');
      }
    } catch (err) {
      showAlert('Error de red al mover archivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = (category: string, filename: string) => {
    setDeleteConfirmParams({ category, filename });
  };

  const executeDeleteMedia = async () => {
    if (!deleteConfirmParams) return;
    const { category, filename } = deleteConfirmParams;
    setDeleteConfirmParams(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/media?category=${encodeURIComponent(category)}&filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        fetchMedia(selectedMediaCategory);
      } else {
        showAlert('Error al eliminar archivo.');
      }
    } catch (err) {
      showAlert('Error de red al eliminar archivo.');
    }
  };

  const handleExportAllMedia = async () => {
    try {
      setIsExportingMedia(true);
      const res = await fetch(`${API_URL}/api/admin/backup/images`, {
        headers: { 'X-API-KEY': apiKey }
      });
      if (!res.ok) {
        throw new Error('Error al exportar multimedia');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `multimedia_perfumeria_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showAlert('¡Multimedia exportado exitosamente! El archivo ZIP se ha descargado.');
    } catch (err: any) {
      console.error(err);
      showAlert('Error al exportar multimedia en archivo ZIP.');
    } finally {
      setIsExportingMedia(false);
    }
  };

  const handleImportAllMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      showAlert('Por favor, selecciona un archivo comprimido en formato .zip');
      e.target.value = '';
      return;
    }

    const confirmImport = window.confirm(`¿Deseas importar el archivo "${file.name}"? Se extraerán e integrarán las imágenes y carpetas en la galería.`);
    if (!confirmImport) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsImportingMedia(true);
      const res = await fetch(`${API_URL}/api/admin/backup/images`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey },
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showAlert(data.message || '¡Multimedia importado exitosamente!');
        fetchMedia(selectedMediaCategory);
      } else {
        showAlert(data.detail || 'Error al importar archivo ZIP.');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error de red al importar archivo ZIP.');
    } finally {
      setIsImportingMedia(false);
      e.target.value = '';
    }
  };

  const handleEditSection = async (key: string) => {
    const defaultData: Record<string, any> = {
      'home_banner': { slides: [] },
      'home_categories': { categoryIds: [] },
      'home_latest': { useAuto: true, productIds: [] },
      'site_header': { logoUrl: '', showSocials: true, facebookUrl: '', instagramUrl: '' },
      'site_footer': { logoUrl: '', copyRight: '' }
    };

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/settings/${key}`);
      if (res.ok) {
        const data = await res.json();
        let value = data.value || defaultData[key];
        if (key === 'home_banner' && !value.slides) {
          value = { slides: [{ title: value.title || '', subtitle: value.subtitle || '', mediaUrl: value.videoUrl || '', link: '/catalog' }] };
        }
        setSectionData(value);
      } else {
        setSectionData(defaultData[key]);
      }
    } catch (e) {
      console.error(e);
      setSectionData(defaultData[key]);
    } finally {
      setEditingSection(key);
      setLoading(false);
    }
  };

  const handleSaveSection = async () => {
    if (!editingSection) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/settings/${editingSection}`, {
        method: 'PUT',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: sectionData })
      });
      if (res.ok) {
        showAlert("Configuración de la sección guardada correctamente.");
        setEditingSection(null);
      } else {
        showAlert("Error al guardar la sección.");
      }
    } catch (e) {
      console.error(e);
      showAlert("Error de red.");
    } finally {
      setLoading(false);
    }
  };

  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
  });

  if (checkingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {alertMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="size-14 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">info</span>
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-2">Notificación del Sistema</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">{alertMessage}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-center border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setAlertMessage(null)} className="w-full py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center mb-6">
              <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
              </div>
              <h2 className="text-2xl font-black text-center dark:text-white">Admin StockFlow</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ingresa tus credenciales de acceso</p>
            </div>
            <input
              type="email" placeholder="Tu Correo Electrónico"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 focus:ring-2 focus:ring-primary outline-none mb-4 dark:text-white"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative mb-6">
              <input
                type={showLoginPassword ? "text" : "password"} placeholder="Tu Contraseña"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 focus:ring-2 focus:ring-primary outline-none pr-12 dark:text-white"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors flex items-center justify-center p-1">
                <span className="material-symbols-outlined text-[20px]">{showLoginPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            <button onClick={handleLogin} className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
              Ingresar al Panel
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark shrink-0">
        <div className="p-6 flex items-center gap-3">
          {currentAdminRole === 'super_admin' ? (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white shadow-md shadow-purple-500/20 flex-shrink-0">
                <span className="material-symbols-outlined text-2xl">shield_person</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Super Admin
                </h2>
                <span className="inline-block text-[11px] font-bold text-purple-600 dark:text-purple-400">
                  Panel Maestro
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Logo height={38} className="w-auto" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3 mt-2">Menú Principal</div>

          <button onClick={() => setActiveView('dashboard')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'dashboard' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-500'}`}>
              <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
            </span>
            <span>Dashboard</span>
          </button>

          <button onClick={() => setActiveView('products')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'products' ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'products' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30' : 'bg-violet-100 dark:bg-violet-950/60 text-violet-500'}`}>
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </span>
            <span>Productos</span>
          </button>

          {currentAdminRole === 'super_admin' && (
            <button
              onClick={() => { setActiveView('sections'); setSectionsKey(k => k + 1); }}
              className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'sections' ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'sections' ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30' : 'bg-pink-100 dark:bg-pink-950/60 text-pink-500'}`}>
                <span className="material-symbols-outlined text-[18px]">web</span>
              </span>
              <span>Secciones</span>
            </button>
          )}

          <button onClick={() => setActiveView('compras')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'compras' ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'compras' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-orange-100 dark:bg-orange-950/60 text-orange-500'}`}>
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            </span>
            <span>Compras</span>
          </button>

          <button onClick={() => setActiveView('ventas')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'ventas' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'ventas' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-500'}`}>
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            </span>
            <span>Vender (Caja)</span>
          </button>

          <button onClick={() => setActiveView('ventas_realizadas')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'ventas_realizadas' || activeView === 'ventas_mostrador' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'ventas_realizadas' || activeView === 'ventas_mostrador' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-500'}`}>
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </span>
            <span>Ventas Realizadas</span>
          </button>

          <button onClick={() => setActiveView('pedidos_web')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'pedidos_web' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'pedidos_web' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-500'}`}>
              <span className="material-symbols-outlined text-[18px]">language</span>
            </span>
            <span>Pedidos Web</span>
          </button>

          <button onClick={() => setActiveView('cobros_pendientes')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'cobros_pendientes' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'cobros_pendientes' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-500'}`}>
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </span>
            <span>Cobros Pendientes</span>
          </button>

          <button onClick={() => setActiveView('users')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'users' ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'users' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'bg-sky-100 dark:bg-sky-950/60 text-sky-500'}`}>
              <span className="material-symbols-outlined text-[18px]">group</span>
            </span>
            <span>Clientes</span>
            {pendingCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          {currentAdminRole === 'super_admin' && (
            <button onClick={() => setActiveView('admins')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'admins' ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'admins' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-500'}`}>
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
              </span>
              <span>Administradores</span>
            </button>
          )}

          <button onClick={() => setActiveView('finanzas')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'finanzas' ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'finanzas' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-teal-100 dark:bg-teal-950/60 text-teal-500'}`}>
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </span>
            <span>Finanzas</span>
          </button>

          <button onClick={() => setActiveView('media')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'media' ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'media' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30' : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-500'}`}>
              <span className="material-symbols-outlined text-[18px]">folder_special</span>
            </span>
            <span>Biblioteca</span>
          </button>

          <button onClick={() => setActiveView('configuracion')} className={`flex w-full text-left items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeView === 'configuracion' ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${activeView === 'configuracion' ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </span>
            <span>Configuración</span>
          </button>

          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3 mt-6">Sistema</div>
          <Link href="/" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all font-semibold text-sm">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
            </span>
            <span>Ver Tienda</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className={`size-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
              currentAdminRole === 'super_admin' ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md shadow-purple-500/20' : 'bg-primary'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {currentAdminRole === 'super_admin' ? 'shield_person' : 'person'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate dark:text-white">{currentAdminName || 'Admin'}</p>
              <div className="text-xs truncate">
                {currentAdminRole === 'super_admin' ? (
                  <span className="inline-flex items-center gap-0.5 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
                    ★ Super Admin
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {currentAdminRole === 'editor' ? 'Editor' : 'Administrador'}
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" className="text-slate-400 hover:text-primary transition-colors cursor-pointer p-1">
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-8 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
            <span className="material-symbols-outlined text-primary text-xl">admin_panel_settings</span>
            <span className="capitalize">
              {activeView === 'dashboard' ? 'Panel de Control General' :
               activeView === 'products' ? 'Productos y Stock' :
               activeView === 'sections' ? 'Secciones y Banner' :
               activeView === 'compras' ? 'Compras de Proveedores' :
               activeView === 'ventas' ? 'Punto de Venta / Caja' :
               (activeView === 'ventas_realizadas' || activeView === 'ventas_mostrador') ? 'Historial de Ventas Realizadas' :
               activeView === 'pedidos_web' ? 'Pedidos Tienda Web' :
               activeView === 'cobros_pendientes' ? 'Cobros Pendientes y Cuotas' :
               activeView === 'users' ? 'Clientes Registrados' :
               activeView === 'admins' ? 'Administradores' :
               activeView === 'finanzas' ? 'Finanzas y Caja' :
               activeView === 'media' ? 'Biblioteca de Archivos' : 'Configuración'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Campana de Notificaciones */}
            <NotificationBell 
              apiKey={apiKey} 
              onNavigateView={(v) => setActiveView(v as ViewId)} 
            />

            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span className="hidden sm:inline">Ver Tienda</span>
            </Link>
          </div>
        </header>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 bg-background-light dark:bg-background-dark/30">
          <>
            {activeView === 'dashboard' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto">
                <DashboardView setActiveView={setActiveView} apiKey={apiKey} pendingUserCount={pendingCount} />
              </div>
            ) : activeView === 'products' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><ProductosView showAlert={showAlert} apiKey={apiKey} apiUrl={API_URL} /></div>
            ) : (activeView === 'sections' && currentAdminRole === 'super_admin') ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto">
                <SeccionesView key={sectionsKey} apiKey={apiKey} apiUrl={API_URL} showAlert={showAlert} />
              </div>
            ) : activeView === 'media' ? (
              <div className="space-y-6">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Biblioteca de Medios</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona todas las imágenes y archivos subidos al servidor.</p>
                  </div>

                  {/* Botones de acción arriba a la derecha */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm hover:shadow flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-xl">upload_file</span>
                      <span>Agregar Archivos</span>
                      <input type="file" className="hidden" onChange={handleMediaUpload} />
                    </label>

                    {/* Exportar Todo (ZIP) */}
                    {currentAdminRole === 'super_admin' && (
                      <button
                        onClick={handleExportAllMedia}
                        disabled={isExportingMedia || isImportingMedia || loading}
                        className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Descargar todo el multimedia comprimido en un archivo .zip"
                      >
                        {isExportingMedia ? (
                          <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-xl">archive</span>
                        )}
                        <span>{isExportingMedia ? 'Exportando ZIP...' : 'Exportar Todo'}</span>
                      </button>
                    )}

                    {/* Importar ZIP */}
                    {currentAdminRole === 'super_admin' && (
                      <label
                        className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 text-sm ${isImportingMedia || isExportingMedia || loading ? 'opacity-50 pointer-events-none' : ''}`}
                        title="Importar un archivo ZIP con imágenes o carpetas a la galería"
                      >
                        {isImportingMedia ? (
                          <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-xl">unarchive</span>
                        )}
                        <span>{isImportingMedia ? 'Importando ZIP...' : 'Importar'}</span>
                        <input
                          type="file"
                          accept=".zip"
                          className="hidden"
                          disabled={isImportingMedia || isExportingMedia || loading}
                          onChange={handleImportAllMedia}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="relative w-full md:w-80">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                      type="text"
                      value={mediaSearch}
                      onChange={e => setMediaSearch(e.target.value)}
                      placeholder="Buscar archivos..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white text-sm"
                    />
                  </div>

                  {/* Category Pills */}
                  <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                    <button
                      onClick={() => { setSelectedMediaCategory(''); fetchMedia(''); }}
                      className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedMediaCategory === '' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                      Todo
                    </button>
                    {mediaCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedMediaCategory(cat); fetchMedia(cat); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedMediaCategory === cat ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid de Archivos */}
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {mediaFiles.filter(f => !f.filename.startsWith('.') && f.filename.toLowerCase().includes(mediaSearch.toLowerCase())).map((file, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden group shadow-sm hover:shadow-md transition-all relative">
                      {/* Preview */}
                      <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative flex items-center justify-center overflow-hidden">
                        {file.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={file.url} alt={file.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : file.filename.match(/\.(mp4|webm)$/i) ? (
                          <div className="w-full h-full relative">
                            <video src={file.url} className="w-full h-full object-cover"></video>
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><span className="material-symbols-outlined text-white text-4xl drop-shadow-lg">play_circle</span></div>
                          </div>
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-slate-300">draft</span>
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm p-4">
                          <div className="flex gap-2">
                            <button onClick={() => { navigator.clipboard.writeText(file.url); showAlert("URL Copiada"); }} className="size-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors tooltip" title="Copiar URL">
                              <span className="material-symbols-outlined text-lg">content_copy</span>
                            </button>
                            {currentAdminRole === 'super_admin' && (
                              <button onClick={() => handleDeleteMedia(file.category, file.filename)} className="size-10 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors tooltip" title="Eliminar">
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            )}
                          </div>
                          {currentAdminRole === 'super_admin' && (
                            <select
                              className="w-full text-center h-8 rounded-lg bg-white/20 hover:bg-white/40 text-white outline-none cursor-pointer text-xs font-bold appearance-none px-2"
                              value=""
                              onChange={(e) => { if (e.target.value) handleMoveMedia(file.category, file.filename, e.target.value); }}
                            >
                              <option value="" disabled className="text-black bg-white">Mover a...</option>
                              {mediaCategories.filter(c => c !== file.category).map(c =>
                                <option key={c} value={c} className="text-black bg-white">{c}</option>
                              )}
                            </select>
                          )}
                        </div>

                        {/* Category Badge */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded border border-white/10 text-[10px] font-bold text-white tracking-wide">
                          {file.category}
                        </div>
                      </div>

                      {/* Footer Details */}
                      <div className="p-3">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={file.filename}>{file.filename}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-slate-400 font-medium">{file.size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {mediaFiles.length === 0 && !loading && (
                    <div className="col-span-full py-16 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <div className="size-16 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 mb-4">
                        <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No hay archivos</h3>
                      <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Selecciona "Agregar Archivos" para subir imágenes o videos a tu biblioteca.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeView === 'compras' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><ComprasView showAlert={showAlert} apiKey={apiKey} apiUrl={API_URL} /></div>
            ) : activeView === 'ventas' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><VentasView showAlert={showAlert} /></div>
            ) : (activeView === 'ventas_realizadas' || activeView === 'ventas_mostrador') ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><VentasRealizadasView apiKey={apiKey} showAlert={showAlert} /></div>
            ) : activeView === 'pedidos_web' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><PedidosWebView apiKey={apiKey} showAlert={showAlert} currentAdminRole={currentAdminRole} /></div>
            ) : activeView === 'cobros_pendientes' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><CobrosPendientesView apiKey={apiKey} showAlert={showAlert} /></div>
            ) : activeView === 'finanzas' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto"><FinanzasView /></div>
            ) : activeView === 'configuracion' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto">
                <ConfiguracionView
                  isSuperAdmin={currentAdminRole === 'super_admin'}
                  apiKey={apiKey}
                  showAlert={showAlert}
                />
              </div>
            ) : activeView === 'users' ? (
              <div className="max-w-[1600px] w-full px-2 mx-auto">
                <ClientesView apiKey={apiKey} onPendingCountChange={setPendingCount} />
              </div>
            ) : (activeView === 'admins' && currentAdminRole === 'super_admin') ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold dark:text-white">Cuentas Administradoras</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Gestiona los usuarios con acceso al panel de administración</p>
                  </div>
                  <button onClick={() => {
                    setEditingUser(null);
                    setUserEmail('');
                    setUserPassword('');
                    setNewUserRole('admin');
                    setUserName('');
                    setUserPhone('');
                    setShowUserModal(true);
                  }} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-all">
                    <span className="material-symbols-outlined text-[16px]">person_add</span> Nuevo Admin
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-700/30">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Usuario</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rol</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{u.id}</td>
                          <td className="px-6 py-4 text-sm font-bold dark:text-white">
                            <div className="flex flex-col items-start justify-center">
                              <span>{u.name || 'Sin Nombre'}</span>
                              <span className="text-xs text-slate-500 font-normal">{u.email} {u.phone ? `• ${u.phone}` : ''}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] tracking-wide ${
                              u.role === 'super_admin'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : u.role === 'admin'
                                  ? 'bg-primary/10 text-primary border border-primary/20'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              {u.role === 'super_admin' && <span className="material-symbols-outlined text-[12px]">shield_person</span>}
                              {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Administrador' : 'Editor'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => {
                                setEditingUser(u);
                                setUserEmail(u.email);
                                setUserName(u.name || '');
                                setUserPhone(u.phone || '');
                                setNewUserRole(u.role || 'admin');
                                setUserPassword('');
                                setShowUserModal(true);
                              }} title="Editar" className="size-8 inline-flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/30 transition-all cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              {u.role !== 'super_admin' ? (
                                <button onClick={() => handleDeleteUser(u.id)} title="Eliminar" className="size-8 inline-flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer">
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              ) : (
                                <span title="El Super Administrador no puede eliminarse" className="size-8 inline-flex items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-400 dark:text-purple-500 cursor-not-allowed">
                                  <span className="material-symbols-outlined text-[16px]">lock</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">No hay administradores registrados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        </div>
      </main>

      {/* MODAL CONFIGURACIÓN SECCIÓN */}

      {/* MODAL CONFIGURACIÓN DE USUARIOS */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-background-dark w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{editingUser ? 'edit' : 'person_add'}</span>
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <form id="userForm" onSubmit={handleSaveUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nombre Completo</label>
                    <input type="text" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white" placeholder="Ej: Juan Pérez" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Teléfono <span className="text-xs font-normal text-slate-400">(Opcional)</span></label>
                    <input type="tel" value={userPhone} onChange={e => setUserPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white" placeholder="Ej: +54 9 11 ..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Correo Electrónico <span className="text-primary">*</span></label>
                    <input type="email" required value={userEmail} onChange={e => setUserEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Contraseña {editingUser && <span className="text-xs font-normal text-slate-400">(Dejar vacío para no cambiar)</span>}</label>
                    <div className="relative">
                      <input type={showAddPassword ? "text" : "password"} required={!editingUser} value={userPassword} onChange={e => setUserPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white pr-12" placeholder={editingUser ? "••••••••" : ""} />
                      <button type="button" onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors flex items-center justify-center p-1">
                        <span className="material-symbols-outlined text-[20px]">{showAddPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Rol de Usuario <span className="text-primary">*</span></label>
                    <select required value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white appearance-none">
                      <option value="super_admin">Super Administrador (Acceso Total)</option>
                      <option value="admin">Administrador</option>
                      <option value="editor">Editor</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button type="submit" form="userForm" className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-[18px]">save</span>
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700 m-auto mt-10 md:mt-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">edit_square</span>
                Editar Sección
              </h2>
              <button onClick={() => setEditingSection(null)} className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
              {editingSection === 'home_banner' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Diapositivas del Carrusel</h3>
                    <button
                      onClick={() => setSectionData({
                        ...sectionData,
                        slides: [...(sectionData.slides || []), { title: '', subtitle: '', mediaUrl: '', link: '/catalog' }]
                      })}
                      className="px-3 py-1.5 bg-primary/10 text-primary font-bold text-sm rounded-lg hover:bg-primary/20 transition flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">add</span> Añadir Slide
                    </button>
                  </div>

                  {(!sectionData.slides || sectionData.slides.length === 0) && (
                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                      No hay diapositivas. Añade una para comenzar.
                    </div>
                  )}

                  {(sectionData.slides || []).map((slide: any, idx: number) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl relative group">
                      <button
                        onClick={() => {
                          const newSlides = [...sectionData.slides];
                          newSlides.splice(idx, 1);
                          setSectionData({ ...sectionData, slides: newSlides });
                        }}
                        className="absolute top-4 right-4 size-8 flex items-center justify-center bg-white dark:bg-slate-800 text-red-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>

                      <div className="flex items-center gap-2 mb-4">
                        <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Slide</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Título Principal</label>
                          <input type="text" value={slide.title} onChange={e => {
                            const newSlides = [...sectionData.slides];
                            newSlides[idx].title = e.target.value;
                            setSectionData({ ...sectionData, slides: newSlides });
                          }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Subtítulo</label>
                          <input type="text" value={slide.subtitle} onChange={e => {
                            const newSlides = [...sectionData.slides];
                            newSlides[idx].subtitle = e.target.value;
                            setSectionData({ ...sectionData, slides: newSlides });
                          }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 mb-1">URL Media (Imagen / Video MP4) <span className="text-primary">*</span></label>
                          <div className="flex items-center gap-2">
                            <input type="text" placeholder="https://... o /uploads/..." value={slide.mediaUrl} onChange={e => {
                              const newSlides = [...sectionData.slides];
                              newSlides[idx].mediaUrl = e.target.value;
                              setSectionData({ ...sectionData, slides: newSlides });
                            }} className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white text-sm" />
                            <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-600 whitespace-nowrap">
                              <span className="material-symbols-outlined text-[18px]">upload</span> Subir
                              <input type="file" className="hidden" accept="image/*,video/mp4,video/webm" onChange={(e) => handleSlideUpload(e, idx)} />
                            </label>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Pega una URL o sube un archivo directamente. Se guardará automáticamente en la carpeta "Banners" de tu Biblioteca.</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Enlace del Botón</label>
                          <input type="text" placeholder="/catalog" value={slide.link} onChange={e => {
                            const newSlides = [...sectionData.slides];
                            newSlides[idx].link = e.target.value;
                            setSectionData({ ...sectionData, slides: newSlides });
                          }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingSection === 'home_categories' && (
                <div className="space-y-5">
                  <p className="text-slate-500 text-sm">Próximamente: Selector visual de categorías para destacar en inicio.</p>
                </div>
              )}

              {editingSection === 'home_latest' && (
                <div className="space-y-5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={sectionData.useAuto} onChange={e => setSectionData({ ...sectionData, useAuto: e.target.checked })} className="size-5 rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">Mostrar siempre los últimos productos agregados automáticamente</span>
                  </label>
                </div>
              )}

              {editingSection === 'site_header' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">URL Logo Principal (Fondo Claro)</label>
                    <input type="text" value={sectionData.logoUrl || ''} onChange={e => setSectionData({ ...sectionData, logoUrl: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Enlace de Facebook</label>
                    <input type="text" value={sectionData.facebookUrl || ''} onChange={e => setSectionData({ ...sectionData, facebookUrl: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Enlace de Instagram</label>
                    <input type="text" value={sectionData.instagramUrl || ''} onChange={e => setSectionData({ ...sectionData, instagramUrl: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Número de WhatsApp (ej. 549112345678)</label>
                    <input type="text" value={sectionData.whatsapp || ''} onChange={e => setSectionData({ ...sectionData, whatsapp: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                </div>
              )}

              {editingSection === 'site_footer' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Texto Copyright</label>
                    <input type="text" value={sectionData.copyRight || ''} onChange={e => setSectionData({ ...sectionData, copyRight: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 flex justify-end gap-3">
              <button onClick={() => setEditingSection(null)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button disabled={loading} onClick={handleSaveSection} className="px-8 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/30 transition-all flex items-center gap-2">
                {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="size-14 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4 shadow-inner">
                <span className="material-symbols-outlined text-3xl">info</span>
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">Notificación del Sistema</h3>
              <p className="text-slate-600 dark:text-slate-300 font-medium">{alertMessage}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-center border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setAlertMessage(null)} className="w-full py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmParams && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full mx-4 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Eliminar archivo</h3>
            <p className="text-slate-600 mb-6">
              ¿Seguro que deseas eliminar este archivo permanentemente?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirmParams(null)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeDeleteMedia}
                className="flex-1 py-2 px-4 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
