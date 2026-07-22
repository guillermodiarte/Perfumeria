'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductosView from '@/components/admin/ProductosView';
import ConfiguracionView from '@/components/admin/ConfiguracionView';
import ComprasView from '@/components/admin/ComprasView';
import VentasView from '@/components/admin/VentasView';
import VentasRealizadasView from '@/components/admin/VentasRealizadasView';
import FinanzasView from '@/components/admin/FinanzasView';

export default function AdminDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  type ViewId = 'products'|'sections'|'compras'|'ventas'|'ventas_realizadas'|'users'|'finanzas'|'media'|'configuracion';
  const VALID_VIEWS: ViewId[] = ['products','sections','compras','ventas','ventas_realizadas','users','finanzas','media','configuracion'];
  const getSavedView = (): ViewId => {
    if (typeof window === 'undefined') return 'products';
    const v = localStorage.getItem('lyg_active_view') as ViewId | null;
    return v && VALID_VIEWS.includes(v) ? v : 'products';
  };
  const [activeView, setActiveViewState] = useState<ViewId>('products');
  const setActiveView = (v: ViewId) => {
    localStorage.setItem('lyg_active_view', v);
    setActiveViewState(v);
  };
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionData, setSectionData] = useState<any>({});
  
  // Media State
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [mediaCategories, setMediaCategories] = useState<string[]>([]);
  const [selectedMediaCategory, setSelectedMediaCategory] = useState<string>('');
  const [mediaSearch, setMediaSearch] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://perfumeria-app-npomsb-0df670-76-13-71-212.traefik.me';

  useEffect(() => {
    setActiveViewState(getSavedView());
    const saved = localStorage.getItem('lyg_api_key');
    if (saved) {
      verifyToken(saved);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categories`);
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch(e) {}
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
        setIsAuthenticated(true);
        localStorage.setItem('lyg_api_key', token);
        fetchProducts();
        fetchCategories();
      } else {
        showAlert("Credenciales incorrectas");
      }
    } catch(e) {
      showAlert("Error de red");
    }
  };

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, { headers: { 'X-API-KEY': token }});
      if (res.ok) {
        setIsAuthenticated(true);
        setApiKey(token);
        fetchProducts();
        fetchCategories();
      } else {
        handleLogout();
        setLoading(false);
      }
    } catch(e) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey && isAuthenticated) {
      fetchUsers();
      if (activeView === 'media') {
        fetchMedia(selectedMediaCategory);
      }
    }
  }, [apiKey, isAuthenticated, activeView]);

  const handleLogout = () => {
    setApiKey('');
    setIsAuthenticated(false);
    localStorage.removeItem('lyg_api_key');
  }

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

    const payload: any = {
      email: userEmail,
      role: newUserRole,
    };
    if (userName) payload.name = userName;
    if (userPhone) payload.phone = userPhone;
    if (userPassword) payload.password = userPassword;

    try {
      const url = editingUser ? `${API_URL}/api/admin/users/${editingUser.id}` : `${API_URL}/api/admin/users`;
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showAlert(editingUser ? "Usuario actualizado" : "Usuario creado con éxito");
        fetchUsers();
        setShowUserModal(false);
      } else {
        const data = await res.json();
        showAlert(data.detail || "Error guardando usuario");
      }
    } catch(e) {
      showAlert("Falla de red.");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Borrar este usuario admin?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) fetchUsers();
      else {
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
    } catch(err) {
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
        setSectionData({...sectionData, slides: newSlides});
        showAlert('Archivo subido exitosamente y asignado al slide.');
      } else {
        showAlert('Error al subir el archivo.');
      }
    } catch(err) {
      showAlert('Error de red al subir archivo.');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleMoveMedia = async (category: string, filename: string, targetCategory: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/media/${category}/${filename}/move`, {
        method: 'PUT',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_category: targetCategory })
      });
      if (res.ok) {
        fetchMedia(selectedMediaCategory);
      } else {
        showAlert('Error al mover archivo.');
      }
    } catch(err) {
      showAlert('Error de red al mover archivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = async (category: string, filename: string) => {
    if (!confirm('¿Seguro que deseas eliminar este archivo permanentemente?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/media/${category}/${filename}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey }
      });
      if (res.ok) {
        fetchMedia(selectedMediaCategory);
      } else {
        showAlert('Error al eliminar archivo.');
      }
    } catch(err) {
      showAlert('Error de red al eliminar archivo.');
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
    } catch(e) {
      console.error(e);
      setSectionData(defaultData[key]);
    } finally {
      setEditingSection(key);
      setLoading(false);
    }
  };

  const handleSaveSection = async () => {
    if(!editingSection) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/settings/${editingSection}`, {
        method: 'PUT',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: sectionData })
      });
      if(res.ok) {
        showAlert("Configuración de la sección guardada correctamente.");
        setEditingSection(null);
      } else {
        showAlert("Error al guardar la sección.");
      }
    } catch(e) {
      console.error(e);
      showAlert("Error de red.");
    } finally {
      setLoading(false);
    }
  };

  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
  });

  if (!isAuthenticated && !loading) {
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
          <div className="size-10 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[20px]">trending_up</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">StockFlow</h2>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-4 mt-2">Menú Principal</div>
          
          <button onClick={() => setActiveView('products')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'products' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">grid_view</span>
            <span>Productos</span>
          </button>
          
          <button onClick={() => setActiveView('sections')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'sections' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">web</span>
            <span>Secciones</span>
          </button>

          <button onClick={() => setActiveView('compras')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'compras' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">local_shipping</span>
            <span>Compras</span>
          </button>

          <button onClick={() => setActiveView('ventas')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'ventas' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">point_of_sale</span>
            <span>Vender</span>
          </button>

          <button onClick={() => setActiveView('ventas_realizadas')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'ventas_realizadas' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Ventas Realizadas</span>
          </button>

          <button onClick={() => setActiveView('users')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'users' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">group</span>
            <span>Usuarios</span>
          </button>

          <button onClick={() => setActiveView('finanzas')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'finanzas' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">payments</span>
            <span>Finanzas</span>
          </button>

          <button onClick={() => setActiveView('media')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'media' ? 'bg-[#00f8ff] text-slate-900 shadow-lg shadow-[#00f8ff]/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">folder_special</span>
            <span>Biblioteca</span>
          </button>

          <button onClick={() => setActiveView('configuracion')} className={`flex w-full text-left items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeView === 'configuracion' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'}`}>
            <span className="material-symbols-outlined">settings</span>
            <span>Configuración</span>
          </button>
          
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-4 mt-8">Sistema</div>
          <Link href="/" target="_blank" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium">
            <span className="material-symbols-outlined">storefront</span>
            <span>Ver Tienda</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC84xwbk1HI88kKQKlW7zfniPhMz_iozRaV6DPNw3j3TtBuokIl2LgOHj9ZOQQGkkRQNqS4Y7h5Ymcwr7X2zokmQV_g7KsYmAIIIf_YpCHl8dS2gQ2EVhFY9ZEksgEimHap9tmtBpAT0CUcN7Rr53YYzyv1K5z1luHRSKBZiYmMfH0p1el80HywotU_P26iGkq7LDmRpRzvDMFa9ID_T_VGFaadORU1wYy5xgXxVKu6JZAVOdKEI8c-qHrPObE7IVdr9y4TxldyVsY"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate dark:text-white">Admin</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Gerente de Tienda</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-background-dark border-b border-slate-200 dark:border-slate-800">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
              <input className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm outline-none" placeholder="Buscar productos, detalles, o categorías..." type="text"/>
            </div>
          </div>
        </header>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 bg-background-light dark:bg-background-dark/30">
          
          <>
              {activeView === 'products' ? (
                 <div className="max-w-7xl mx-auto w-full"><ProductosView showAlert={showAlert} /></div>
              ) : activeView === 'sections' ? (
              <div className="space-y-6">
                <div className="mb-8">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Panel de Secciones</h1>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">Selecciona una sección para editar el contenido dinámico de la tienda web.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Banner Principal */}
                  <div onClick={() => handleEditSection('home_banner')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
                    <div className="size-12 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">view_carousel</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Banner Principal</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Sube imágenes o videos para el carrusel de inicio, cambia el texto destacado y el botón de llamada a la acción.</p>
                    </div>
                    <div className="mt-auto pt-4 flex gap-2">
                       <span className="w-8 h-1.5 rounded-full bg-blue-500"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    </div>
                    <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </div>

                  {/* Comprar por Categoría */}
                  <div onClick={() => handleEditSection('home_categories')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
                    <div className="size-12 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">category</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Categorías Destacadas</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Elige qué colecciones y categorías mostrar en la cuadrícula de acceso rápido de la página principal.</p>
                    </div>
                    <div className="mt-auto pt-4 flex gap-2">
                       <span className="w-8 h-1.5 rounded-full bg-purple-500"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    </div>
                    <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </div>

                  {/* Últimos Ingresos */}
                  <div onClick={() => handleEditSection('home_latest')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
                    <div className="size-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">new_releases</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Últimos Ingresos</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Configura qué productos se muestran en la sección de novedades (automáticos o seleccionados a mano).</p>
                    </div>
                    <div className="mt-auto pt-4 flex gap-2">
                       <span className="w-8 h-1.5 rounded-full bg-emerald-500"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    </div>
                    <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </div>

                  {/* Cabecera MENU */}
                  <div onClick={() => handleEditSection('site_header')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
                    <div className="size-12 bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">dock_to_bottom</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Cabecera y Menú</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Modifica el logotipo, las etiquetas del menú de navegación, y los elaces a tus perfiles de redes sociales.</p>
                    </div>
                    <div className="mt-auto pt-4 flex gap-2">
                       <span className="w-8 h-1.5 rounded-full bg-pink-500"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    </div>
                    <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </div>

                  {/* Pie de Página */}
                  <div onClick={() => handleEditSection('site_footer')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4 opacity-75">
                    <div className="size-12 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined">space_dashboard</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Pie de Página (Footer)</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Personaliza el logotipo invertido, la información de contacto y enlaces legales del pie de página.</p>
                    </div>
                    <div className="mt-auto pt-4 flex gap-2">
                       <span className="w-8 h-1.5 rounded-full bg-slate-500"></span>
                       <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                    </div>
                    <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </div>

                </div>
              </div>
              ) : activeView === 'media' ? (
              <div className="space-y-6">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Biblioteca de Medios</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona todas las imágenes y archivos subidos al servidor.</p>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="cursor-pointer bg-primary text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition flex items-center gap-2">
                      <span className="material-symbols-outlined">upload_file</span>
                      Agregar Archivos
                      <input type="file" className="hidden" onChange={handleMediaUpload} />
                    </label>
                    <div className="relative flex-1 md:w-64">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                      <input type="text" value={mediaSearch} onChange={e => setMediaSearch(e.target.value)} placeholder="Buscar archivos..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white" />
                    </div>
                  </div>
                  
                  {/* Category Pills */}
                  <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                    <button 
                      onClick={() => {setSelectedMediaCategory(''); fetchMedia('');}}
                      className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedMediaCategory === '' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                      Todo
                    </button>
                    {mediaCategories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => {setSelectedMediaCategory(cat); fetchMedia(cat);}}
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
                               <button onClick={() => {navigator.clipboard.writeText(file.url); showAlert("URL Copiada");}} className="size-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors tooltip" title="Copiar URL">
                                 <span className="material-symbols-outlined text-lg">content_copy</span>
                               </button>
                               <button onClick={() => handleDeleteMedia(file.category, file.filename)} className="size-10 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors tooltip" title="Eliminar">
                                 <span className="material-symbols-outlined text-lg">delete</span>
                               </button>
                             </div>
                             <select
                               className="w-full text-center h-8 rounded-lg bg-white/20 hover:bg-white/40 text-white outline-none cursor-pointer text-xs font-bold appearance-none px-2"
                               value=""
                               onChange={(e) => { if(e.target.value) handleMoveMedia(file.category, file.filename, e.target.value); }}
                             >
                               <option value="" disabled className="text-black bg-white">Mover a...</option>
                               {mediaCategories.filter(c => c !== file.category).map(c => 
                                 <option key={c} value={c} className="text-black bg-white">{c}</option>
                               )}
                             </select>
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
                 <div className="max-w-6xl mx-auto"><VentasView showAlert={showAlert} /></div>
              ) : activeView === 'ventas_realizadas' ? (
                 <div className="max-w-[1600px] w-full px-2 mx-auto"><VentasRealizadasView /></div>
              ) : activeView === 'finanzas' ? (
                 <div className="max-w-6xl mx-auto"><FinanzasView /></div>
              ) : activeView === 'configuracion' ? (
                 <div className="max-w-4xl mx-auto"><ConfiguracionView /></div>
              ) : activeView === 'users' ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold dark:text-white">Cuentas Administradoras</h3>
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
                    <span className="material-symbols-outlined text-[16px]">person_add</span> Nuevo Usuario
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-700/30">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email (Usuario)</th>
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
                           <td className="px-6 py-4 text-sm"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wide">{u.role}</span></td>
                           <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                            <button onClick={() => {
                              setEditingUser(u);
                              setUserEmail(u.email);
                              setUserName(u.name || '');
                              setUserPhone(u.phone || '');
                              setNewUserRole(u.role || 'admin');
                              setUserPassword('');
                              setShowUserModal(true);
                            }} className="size-8 inline-flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/30 transition-all cursor-pointer">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="size-8 inline-flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                           </td>
                        </tr>
                      ))}
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
                    <input type="text" value={userName} onChange={e=>setUserName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white" placeholder="Ej: Juan Pérez" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Teléfono <span className="text-xs font-normal text-slate-400">(Opcional)</span></label>
                    <input type="tel" value={userPhone} onChange={e=>setUserPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white" placeholder="Ej: +54 9 11 ..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Correo Electrónico <span className="text-primary">*</span></label>
                    <input type="email" required value={userEmail} onChange={e=>setUserEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Contraseña {editingUser && <span className="text-xs font-normal text-slate-400">(Dejar vacío para no cambiar)</span>}</label>
                    <div className="relative">
                      <input type={showAddPassword ? "text" : "password"} required={!editingUser} value={userPassword} onChange={e=>setUserPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white pr-12" placeholder={editingUser ? "••••••••" : ""} />
                      <button type="button" onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors flex items-center justify-center p-1">
                        <span className="material-symbols-outlined text-[20px]">{showAddPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Rol de Usuario <span className="text-primary">*</span></label>
                    <select required value={newUserRole} onChange={e=>setNewUserRole(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white appearance-none">
                      <option value="admin">Administrador</option>
                      <option value="editor">Editor</option>
                      <option value="cliente">Cliente</option>
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
                          setSectionData({...sectionData, slides: newSlides});
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
                            setSectionData({...sectionData, slides: newSlides});
                          }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Subtítulo</label>
                          <input type="text" value={slide.subtitle} onChange={e => {
                            const newSlides = [...sectionData.slides];
                            newSlides[idx].subtitle = e.target.value;
                            setSectionData({...sectionData, slides: newSlides});
                          }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 mb-1">URL Media (Imagen / Video MP4) <span className="text-primary">*</span></label>
                          <div className="flex items-center gap-2">
                            <input type="text" placeholder="https://... o /uploads/..." value={slide.mediaUrl} onChange={e => {
                              const newSlides = [...sectionData.slides];
                              newSlides[idx].mediaUrl = e.target.value;
                              setSectionData({...sectionData, slides: newSlides});
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
                            setSectionData({...sectionData, slides: newSlides});
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
                    <input type="checkbox" checked={sectionData.useAuto} onChange={e => setSectionData({...sectionData, useAuto: e.target.checked})} className="size-5 rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">Mostrar siempre los últimos productos agregados automáticamente</span>
                  </label>
                </div>
              )}

              {editingSection === 'site_header' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">URL Logo Principal (Fondo Claro)</label>
                    <input type="text" value={sectionData.logoUrl || ''} onChange={e => setSectionData({...sectionData, logoUrl: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Enlace de Facebook</label>
                    <input type="text" value={sectionData.facebookUrl || ''} onChange={e => setSectionData({...sectionData, facebookUrl: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Enlace de Instagram</label>
                    <input type="text" value={sectionData.instagramUrl || ''} onChange={e => setSectionData({...sectionData, instagramUrl: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Número de WhatsApp (ej. 549112345678)</label>
                    <input type="text" value={sectionData.whatsapp || ''} onChange={e => setSectionData({...sectionData, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
                  </div>
                </div>
              )}

              {editingSection === 'site_footer' && (
                <div className="space-y-5">
                   <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Texto Copyright</label>
                    <input type="text" value={sectionData.copyRight || ''} onChange={e => setSectionData({...sectionData, copyRight: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-medium" />
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

    </div>
  );
}
