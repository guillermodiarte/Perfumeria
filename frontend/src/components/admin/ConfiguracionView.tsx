'use client';

import { useStockFlowStore } from '@/store/useStockStore';
import { useRef, useState, useEffect } from 'react';
import { API_URL } from '@/utils/api';
import CatalogConfig from './CatalogConfig';
import { COMPANY_DEFAULTS, CompanyInfo } from '@/config/company';

type TabType = 'precios' | 'catalogo' | 'envios' | 'empresa' | 'respaldos';

interface ConfiguracionViewProps {
  isSuperAdmin?: boolean;
}

export default function ConfiguracionView({ isSuperAdmin = false }: ConfiguracionViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('precios');

  useEffect(() => {
    if (!isSuperAdmin && (activeTab === 'respaldos' || activeTab === 'empresa')) {
      setActiveTab('precios');
    }
  }, [isSuperAdmin, activeTab]);

  // Zustand Store
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const setGlobalMarkup = useStockFlowStore(s => s.setGlobalMarkup);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const setWholesaleConfig = useStockFlowStore(s => s.setWholesaleConfig);
  const importData = useStockFlowStore(s => s.importData);
  const getZustandState = () => useStockFlowStore.getState();

  // Loading & refs for backups
  const [loading, setLoading] = useState(false);
  const fileInputRefDB = useRef<HTMLInputElement>(null);
  const fileInputRefImages = useRef<HTMLInputElement>(null);
  const fileInputRefJSON = useRef<HTMLInputElement>(null);

  // Shipping Config State
  const [shippingConfig, setShippingConfig] = useState({ delivery_enabled: true, delivery_cost: 0 });
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingSaveMsg, setShippingSaveMsg] = useState<string | null>(null);

  const fetchShippingConfig = async () => {
    setLoadingShipping(true);
    try {
      const res = await fetch('/api/admin/settings/shipping');
      if (res.ok) {
        const data = await res.json();
        setShippingConfig({
          delivery_enabled: data.delivery_enabled ?? true,
          delivery_cost: Number(data.delivery_cost || 0),
        });
      }
    } catch (err) {
      console.error('Error loading shipping config:', err);
    } finally {
      setLoadingShipping(false);
    }
  };

  // Company Info State
  const [companyConfig, setCompanyConfig] = useState<CompanyInfo>(COMPANY_DEFAULTS);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaveMsg, setCompanySaveMsg] = useState<string | null>(null);

  const fetchCompanyConfig = async () => {
    setLoadingCompany(true);
    try {
      const res = await fetch('/api/admin/settings/company_info');
      if (res.ok) {
        const data = await res.json();
        if (data && data.value) {
          setCompanyConfig({ ...COMPANY_DEFAULTS, ...data.value });
        }
      }
    } catch (err) {
      console.error('Error loading company config:', err);
    } finally {
      setLoadingCompany(false);
    }
  };

  useEffect(() => {
    fetchShippingConfig();
    fetchCompanyConfig();
  }, []);

  const handleSaveShippingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShipping(true);
    try {
      const res = await fetch('/api/admin/settings/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shippingConfig),
      });
      if (res.ok) {
        setShippingSaveMsg('Configuración de envíos guardada exitosamente.');
        setTimeout(() => setShippingSaveMsg(null), 3000);
      } else {
        alert('Error al guardar configuración de envíos');
      }
    } catch {
      alert('Error de conexión con el servidor');
    } finally {
      setSavingShipping(false);
    }
  };

  const handleSaveCompanyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const res = await fetch('/api/admin/settings/company_info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: companyConfig }),
      });
      if (res.ok) {
        setCompanySaveMsg('Datos de la empresa guardados correctamente.');
        setTimeout(() => setCompanySaveMsg(null), 3500);
      } else {
        alert('Error al guardar datos de la empresa');
      }
    } catch {
      alert('Error de conexión con el servidor');
    } finally {
      setSavingCompany(false);
    }
  };

  // Wholesale 30-Day Auto Promotion State
  const [wholesaleAutoEnabled, setWholesaleAutoEnabled] = useState(false);
  const [wholesaleAutoMinQty, setWholesaleAutoMinQty] = useState(6);
  const [loadingWholesaleAuto, setLoadingWholesaleAuto] = useState(false);
  const [savingWholesaleAuto, setSavingWholesaleAuto] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Fetch Wholesale Auto Setting from backend
  const fetchWholesaleAutoSetting = async () => {
    setLoadingWholesaleAuto(true);
    try {
      const adminToken = localStorage.getItem('lyg_api_key') || '';
      const res = await fetch(`${API_URL}/api/admin/settings/wholesale-auto`, {
        headers: { 'X-API-KEY': adminToken }
      });
      if (res.ok) {
        const data = await res.json();
        setWholesaleAutoEnabled(Boolean(data.enabled));
        if (data.min_quantity !== undefined) {
          setWholesaleAutoMinQty(Number(data.min_quantity) || 6);
        }
      }
    } catch (err) {
      console.warn('Could not fetch wholesale auto setting:', err);
    } finally {
      setLoadingWholesaleAuto(false);
    }
  };

  useEffect(() => {
    fetchWholesaleAutoSetting();
  }, []);

  const handleUpdateWholesaleAuto = async (enabled: boolean, minQty: number) => {
    setSavingWholesaleAuto(true);
    try {
      const adminToken = localStorage.getItem('lyg_api_key') || '';
      const res = await fetch(`${API_URL}/api/admin/settings/wholesale-auto`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': adminToken
        },
        body: JSON.stringify({ enabled, min_quantity: minQty })
      });

      if (res.ok) {
        setWholesaleAutoEnabled(enabled);
        setWholesaleAutoMinQty(minQty);
        setSaveSuccessMessage('Configuración de mayoristas guardada exitosamente.');
        setTimeout(() => setSaveSuccessMessage(null), 3500);
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al guardar la configuración');
      }
    } catch (e) {
      alert('Error de conexión al servidor');
    } finally {
      setSavingWholesaleAuto(false);
    }
  };

  // --- JSON EXPORT / IMPORT ---
  const handleExportJSON = () => {
    const state = getZustandState();
    const dataToExport = {
      globalMarkupPrc: state.globalMarkupPrc,
      wholesaleConfig: state.wholesaleConfig,
      products: state.products,
      purchases: state.purchases,
      sales: state.sales
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perfumeria_catalogo_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        importData(json);
        alert('Catálogo restaurado exitosamente');
      } catch (err) {
        alert('Error al leer el archivo JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- DB EXPORT / IMPORT ---
  const handleExportDB = async () => {
    try {
      const adminToken = localStorage.getItem('lyg_api_key') || '';
      const res = await fetch(`${API_URL}/api/admin/backup/db`, { headers: { 'X-API-KEY': adminToken } });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `perfumeria_db_${new Date().toISOString().split('T')[0]}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Error descargando base de datos'); }
  };

  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    const adminToken = localStorage.getItem('lyg_api_key') || '';
    try {
      const res = await fetch(`${API_URL}/api/admin/backup/db`, {
        method: 'POST',
        headers: { 'X-API-KEY': adminToken },
        body: formData
      });
      if (res.ok) alert('Base de datos restaurada');
      else alert('Error al restaurar BD');
    } catch (err) { alert('Error de red'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  // --- IMAGES EXPORT / IMPORT ---
  const handleExportImages = async () => {
    try {
      setLoading(true);
      const adminToken = localStorage.getItem('lyg_api_key') || '';
      const res = await fetch(`${API_URL}/api/admin/backup/images`, { headers: { 'X-API-KEY': adminToken } });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `perfumeria_imagenes_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Error descargando imágenes'); }
    finally { setLoading(false); }
  };

  const handleImportImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    const adminToken = localStorage.getItem('lyg_api_key') || '';
    try {
      const res = await fetch(`${API_URL}/api/admin/backup/images`, {
        method: 'POST',
        headers: { 'X-API-KEY': adminToken },
        body: formData
      });
      if (res.ok) alert('Imágenes restauradas');
      else alert('Error al restaurar Imágenes');
    } catch (err) { alert('Error de red'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/80 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">settings</span>
            Configuración del Sistema
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Gestiona precios, promociones mayoristas, catálogo y copias de seguridad de forma organizada.
          </p>
        </div>

        {saveSuccessMessage && (
          <div className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <span className="material-symbols-outlined text-base">check_circle</span>
            {saveSuccessMessage}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit mb-8">
        <button
          onClick={() => setActiveTab('precios')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'precios'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-lg">payments</span>
          Precios y Mayoristas
        </button>

        <button
          onClick={() => setActiveTab('catalogo')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'catalogo'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-lg">category</span>
          Categorías y Catálogo
        </button>

        <button
          onClick={() => setActiveTab('envios')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'envios'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-lg">local_shipping</span>
          Envíos y Entregas
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('empresa')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'empresa'
                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">storefront</span>
            Empresa
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('respaldos')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'respaldos'
                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-lg">cloud_sync</span>
            Copias de Seguridad (Backups)
          </button>
        )}
      </div>

      {/* TAB 1: PRECIOS Y MAYORISTAS */}
      {activeTab === 'precios' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Markup Global */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-xl">percent</span>
                  <label className="block text-sm font-bold text-slate-800 dark:text-white">
                    Porcentaje de Ganancia Global (Markup %)
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Este porcentaje se usará para autocalcular los Precios de Venta sugeridos al momento de registrar ingresos de mercadería en 'Compras'.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={globalMarkupPrc}
                    onChange={(e) => setGlobalMarkup(Number(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl pl-4 pr-10 py-3 text-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                </div>
                <div className="bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 h-[52px] border border-emerald-200 dark:border-emerald-800/40">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Guardado Auto
                </div>
              </div>
            </div>

            {/* Descuento Mayorista Base */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-xl">sell</span>
                  <label className="block text-sm font-bold text-slate-800 dark:text-white">
                    Regla de Descuento Mayorista por Ítem
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Establece la cantidad mínima requerida del mismo producto para aplicar el descuento mayorista automáticamente en compras individuales.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Mínimo por producto</label>
                  <input
                    type="number"
                    value={wholesaleConfig?.minQuantity || 6}
                    onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, minQuantity: Number(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Descuento (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={wholesaleConfig?.discountPercentage || 10}
                      onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, discountPercentage: Number(e.target.value) || 0 })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl pl-4 pr-10 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MEMBRESÍA MAYORISTA POR 30 DÍAS (NUEVA FUNCIÓN REQUERIDA) */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-indigo-100 dark:border-indigo-950">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl material-symbols-outlined text-2xl">
                    card_membership
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Membresía Mayorista Automática por 30 Días
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Convierte automáticamente a clientes en mayoristas por 30 días cuando compren un volumen mínimo de productos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {wholesaleAutoEnabled ? 'Promoción Activada' : 'Promoción Desactivada'}
                </span>
                <button
                  type="button"
                  disabled={loadingWholesaleAuto || savingWholesaleAuto}
                  onClick={() => {
                    const nextVal = !wholesaleAutoEnabled;
                    setWholesaleAutoEnabled(nextVal);
                    handleUpdateWholesaleAuto(nextVal, wholesaleAutoMinQty);
                  }}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    wholesaleAutoEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      wholesaleAutoEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Config & Explanation Body */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Cantidad mínima de productos en el pedido:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={1}
                      value={wholesaleAutoMinQty}
                      onChange={(e) => setWholesaleAutoMinQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                      Unidades
                    </span>
                  </div>
                  <button
                    disabled={savingWholesaleAuto}
                    onClick={() => handleUpdateWholesaleAuto(wholesaleAutoEnabled, wholesaleAutoMinQty)}
                    className="px-4 py-3 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-1 shrink-0"
                  >
                    {savingWholesaleAuto ? (
                      <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">save</span>
                    )}
                    Guardar
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Suma total de artículos en el carrito para que se aplique la condición al aprobar el pedido.
                </p>
              </div>

              {/* Status Explanation Box */}
              <div className="lg:col-span-2">
                {wholesaleAutoEnabled ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl shrink-0 mt-0.5">
                        verified
                      </span>
                      <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                        <p className="font-black text-emerald-800 dark:text-emerald-300 text-sm">
                          Promoción Activa
                        </p>
                        <p className="leading-relaxed">
                          Todo cliente que adquiera <strong>{wholesaleAutoMinQty} o más productos</strong> en un pedido web o mostrador recibirá automáticamente la condición de <strong>Cliente Mayorista durante 30 días</strong> al momento de aprobarse su venta.
                        </p>
                        <p className="text-emerald-700/80 dark:text-emerald-400 text-[11px]">
                          Durante esos 30 días podrá comprar cualquier producto al precio mayorista sin exigencia de cantidad mínima. Si vuelve a superar el umbral antes del vencimiento, sus 30 días se renovarán automáticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">
                        shield_with_heart
                      </span>
                      <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        <p className="font-black text-amber-800 dark:text-amber-300 text-sm">
                          Promoción Desactivada — Protección de Plazo Vigente
                        </p>
                        <p className="leading-relaxed">
                          Las nuevas ventas no activarán ni extenderán membresías de 30 días.
                        </p>
                        <p className="leading-relaxed font-semibold text-amber-800 dark:text-amber-300">
                          ✓ Los clientes que actualmente ya son mayoristas por 30 días <strong>conservarán su beneficio hasta que finalice su plazo</strong> de 30 días, pero ya no podrán renovar la fecha aunque vuelvan a comprar en cantidad.
                        </p>
                        <p className="text-amber-700/90 dark:text-amber-400 text-[11px]">
                          Los clientes sin membresía activa solo accederán al precio mayorista comprando la cantidad mínima por producto en esa compra específica.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORÍAS Y CATÁLOGO */}
      {activeTab === 'catalogo' && (
        <div className="animate-in fade-in duration-200">
          <CatalogConfig />
        </div>
      )}

      {/* TAB: ENVÍOS Y ENTREGAS */}
      {activeTab === 'envios' && (
        <div className="animate-in fade-in duration-200 max-w-3xl space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">local_shipping</span>
              Configuración de Envíos y Entregas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Define los métodos de entrega disponibles para los clientes al comprar en la tienda online y sus costos.
            </p>
          </div>

          {shippingSaveMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center gap-3 font-semibold text-sm">
              <span className="material-symbols-outlined text-emerald-500">check_circle</span>
              {shippingSaveMsg}
            </div>
          )}

          <form onSubmit={handleSaveShippingConfig} className="space-y-6">
            {/* Delivery a Domicilio Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined">home_pin</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-base">Envío a Domicilio</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Envío directo a la dirección indicada por el comprador.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shippingConfig.delivery_enabled}
                    onChange={(e) => setShippingConfig({ ...shippingConfig, delivery_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                </label>
              </div>

              {shippingConfig.delivery_enabled && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <label className="block text-sm font-bold text-slate-800 dark:text-white">
                    Costo de Envío a Domicilio ($ ARS)
                  </label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={shippingConfig.delivery_cost}
                      onChange={(e) => setShippingConfig({ ...shippingConfig, delivery_cost: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl pl-8 pr-4 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">info</span>
                    {shippingConfig.delivery_cost === 0
                      ? 'Actualmente configurado como Envío Gratis para todos los pedidos.'
                      : `Al cliente se le sumarán $${shippingConfig.delivery_cost.toLocaleString('es-AR')} al total del pedido.`}
                  </p>
                </div>
              )}
            </div>

            {/* Retiro en Local Card (Siempre disponible) */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined">storefront</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800 dark:text-white text-base">Retiro en Local</h4>
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      Siempre Gratis
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    El cliente coordina para retirar su compra directamente por el local comercial sin costo adicional.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingShipping}
                className="px-6 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">
                  {savingShipping ? 'sync' : 'save'}
                </span>
                {savingShipping ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: DATOS DE LA EMPRESA */}
      {activeTab === 'empresa' && isSuperAdmin && (
        <div className="animate-in fade-in duration-200 w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">storefront</span>
                Datos de la Empresa y Contacto
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configura los datos del negocio, información de contacto, ubicación en Google Maps, mensajes de WhatsApp y créditos del sitio.
              </p>
            </div>
            <button
              onClick={handleSaveCompanyConfig}
              disabled={savingCompany}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-md shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-50 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-lg">
                {savingCompany ? 'sync' : 'save'}
              </span>
              {savingCompany ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

          {companySaveMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center gap-3 font-semibold text-sm">
              <span className="material-symbols-outlined text-emerald-500">check_circle</span>
              {companySaveMsg}
            </div>
          )}

          <form onSubmit={handleSaveCompanyConfig} className="space-y-6 w-full">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              {/* COLUMNA IZQUIERDA */}
              <div className="space-y-6">
                {/* 1. Identidad de la Marca */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">badge</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Identidad de la Marca</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nombre público, eslogan y presentación</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Nombre del Negocio
                      </label>
                      <input
                        type="text"
                        value={companyConfig.name}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: Ciara Bonita"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Eslogan o Subtítulo
                      </label>
                      <input
                        type="text"
                        value={companyConfig.tagline}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, tagline: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: Fragancias que cuentan historias"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Descripción o Historia (Sobre Nosotros)
                    </label>
                    <textarea
                      rows={4}
                      value={companyConfig.description}
                      onChange={(e) => setCompanyConfig({ ...companyConfig, description: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Descripción de la empresa visible en 'Dónde estamos' y otras secciones"
                    />
                  </div>
                </div>

                {/* 2. Ubicación & Google Maps */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">pin_drop</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Ubicación y Google Maps</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Dirección física y mapa interactivo</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Dirección (Calle y Número)
                      </label>
                      <input
                        type="text"
                        value={companyConfig.address}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, address: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: Av. Antártida Argentina 1035"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Código Postal
                      </label>
                      <input
                        type="text"
                        value={companyConfig.postalCode}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, postalCode: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: 3600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Ciudad / Localidad
                      </label>
                      <input
                        type="text"
                        value={companyConfig.city}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, city: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: Formosa"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Provincia
                      </label>
                      <input
                        type="text"
                        value={companyConfig.province}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, province: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: Formosa"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Enlace de Google Maps (Botón "Cómo llegar")
                      </label>
                      <input
                        type="text"
                        value={companyConfig.googleMapsLink}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, googleMapsLink: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono"
                        placeholder="https://maps.app.goo.gl/..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        URL de Iframe de Google Maps (Embed para visualizar el mapa)
                      </label>
                      <input
                        type="text"
                        value={companyConfig.googleMapsEmbed}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, googleMapsEmbed: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs font-mono"
                        placeholder="https://www.google.com/maps/embed?pb=..."
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pegá solo la URL del atributo <code>src="..."</code> del código para insertar mapa de Google Maps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA */}
              <div className="space-y-6">
                {/* 3. Contacto & Horarios */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">contacts</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Contacto y Horarios</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Canales de atención al cliente</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        WhatsApp para Pedidos
                      </label>
                      <input
                        type="text"
                        value={companyConfig.whatsapp}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, whatsapp: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-sm"
                        placeholder="5493704747426"
                        required
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Solo números con código de país (sin + ni espacios)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Teléfono Visible Público
                      </label>
                      <input
                        type="text"
                        value={companyConfig.phone}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="+54 9 3704 74-7426"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Email de Contacto
                    </label>
                    <input
                      type="email"
                      value={companyConfig.email}
                      onChange={(e) => setCompanyConfig({ ...companyConfig, email: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="contacto@ciarabonita.com"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Horario Lunes a Viernes
                      </label>
                      <input
                        type="text"
                        value={companyConfig.scheduleWeekdays}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, scheduleWeekdays: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="09:00 - 18:00 hs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Horario Sábados
                      </label>
                      <input
                        type="text"
                        value={companyConfig.scheduleSaturday}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, scheduleSaturday: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="09:00 - 13:00 hs"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Textos de WhatsApp para Pedidos */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">chat</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Textos de Pedidos por WhatsApp</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mensajes predeterminados que se envían al confirmar una compra en el checkout</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Saludo Inicial del Pedido
                    </label>
                    <input
                      type="text"
                      value={companyConfig.whatsappMsgGreeting}
                      onChange={(e) => setCompanyConfig({ ...companyConfig, whatsappMsgGreeting: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="¡Hola! Quiero confirmar un pedido 🛒"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Pie o Mensaje Final del Pedido (Opcional)
                    </label>
                    <input
                      type="text"
                      value={companyConfig.whatsappMsgFooter}
                      onChange={(e) => setCompanyConfig({ ...companyConfig, whatsappMsgFooter: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Ej: Aguardo confirmación para realizar el pago."
                    />
                  </div>
                </div>

                {/* 5. Creador de la Página y Redes Sociales */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">code</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Datos del Creador y Redes</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Créditos en pie de página y enlaces sociales</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Texto / Nombre del Creador
                      </label>
                      <input
                        type="text"
                        value={companyConfig.creatorName}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, creatorName: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Ej: Desarrollado por TuEmpresa"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Enlace / Web del Creador
                      </label>
                      <input
                        type="text"
                        value={companyConfig.creatorUrl}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, creatorUrl: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Instagram URL
                      </label>
                      <input
                        type="text"
                        value={companyConfig.instagramUrl}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, instagramUrl: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://instagram.com/..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Facebook URL
                      </label>
                      <input
                        type="text"
                        value={companyConfig.facebookUrl}
                        onChange={(e) => setCompanyConfig({ ...companyConfig, facebookUrl: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://facebook.com/..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Bar: Save Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-base text-primary">info</span>
                Los cambios guardados se aplicarán de inmediato en toda la tienda online, el checkout y la página "¿Dónde estamos?".
              </div>
              <button
                type="submit"
                disabled={savingCompany}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-50 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-lg">
                  {savingCompany ? 'sync' : 'save'}
                </span>
                {savingCompany ? 'Guardando...' : 'Guardar Datos de la Empresa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: RESPALDOS Y SISTEMA */}
      {activeTab === 'respaldos' && isSuperAdmin && (
        <div className="animate-in fade-in duration-200 space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">cloud_sync</span>
              Copias de Seguridad (Backups) del Sistema
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Descarga o restaura copias completas de la base de datos, catálogo de productos y banco de imágenes.
            </p>
          </div>

          {loading && (
            <div className="p-4 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center gap-3 animate-pulse">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <p className="text-sm font-bold">Procesando solicitud de backup, por favor espera...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Catalog */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">data_object</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white mb-1">1. Catálogo y Finanzas</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Respaldar productos, compras, ventas y configuraciones de negocio en un archivo portable JSON.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleExportJSON}
                  className="w-full py-2.5 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-colors flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">download</span> Descargar JSON
                </button>
                <input type="file" accept=".json" className="hidden" ref={fileInputRefJSON} onChange={handleImportJSON} />
                <button
                  onClick={() => fileInputRefJSON.current?.click()}
                  className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">upload</span> Subir JSON
                </button>
              </div>
            </div>

            {/* Card 2: Database */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">database</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white mb-1">2. Base de Datos Backend</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Respaldar usuarios, pedidos web, clientes, cuotas y sesiones en el archivo SQLite original.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleExportDB}
                  className="w-full py-2.5 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-colors flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">download</span> Descargar .db
                </button>
                <input type="file" accept=".db" className="hidden" ref={fileInputRefDB} onChange={handleImportDB} />
                <button
                  onClick={() => fileInputRefDB.current?.click()}
                  className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">upload</span> Subir .db
                </button>
              </div>
            </div>

            {/* Card 3: Images */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">perm_media</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white mb-1">3. Banco de Imágenes</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Comprimir la biblioteca de fotos de productos y banners en un archivo .zip para respaldo externo.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleExportImages}
                  className="w-full py-2.5 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-colors flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">download</span> Descargar .zip
                </button>
                <input type="file" accept=".zip" className="hidden" ref={fileInputRefImages} onChange={handleImportImages} />
                <button
                  onClick={() => fileInputRefImages.current?.click()}
                  className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">upload</span> Subir .zip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
