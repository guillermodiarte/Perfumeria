'use client';

import { useStockFlowStore, DEFAULT_INVOICE_SETTINGS, InvoiceSettings, SaleRecord } from '@/store/useStockStore';
import { useRef, useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/utils/api';
import CatalogConfig from './CatalogConfig';
import { COMPANY_DEFAULTS, CompanyInfo } from '@/config/company';
import { createInvoiceDoc } from '@/utils/generateTicket';

interface AutoBackup {
  filename: string;
  size: number;
  formattedSize: string;
  createdAt: string;
  isSafetyBackup: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'hace unos segundos';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h ${m % 60}min`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

function localDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TabType = 'precios' | 'catalogo' | 'envios' | 'factura' | 'empresa' | 'respaldos';

interface ConfiguracionViewProps {
  isSuperAdmin?: boolean;
  apiKey?: string;
  showAlert?: (msg: string) => void;
}

export default function ConfiguracionView({ isSuperAdmin = false, apiKey, showAlert }: ConfiguracionViewProps) {
  const [activeTab, setActiveTabState] = useState<TabType>('precios');
  const setActiveTab = (tab: TabType, pushHistory = true) => {
    setActiveTabState(tab);
    if (pushHistory && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({ tab }, '', url.toString());
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') as TabType | null;
    const validTabs: TabType[] = ['precios', 'catalogo', 'envios', 'factura', 'empresa', 'respaldos'];
    if (initialTab && validTabs.includes(initialTab)) {
      setActiveTabState(initialTab);
    }

    const handlePopState = (e: PopStateEvent) => {
      const p = new URLSearchParams(window.location.search);
      const t = (e.state?.tab || p.get('tab')) as TabType | null;
      if (t && validTabs.includes(t)) {
        setActiveTabState(t);
      } else {
        setActiveTabState('precios');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Modal dialog state (replaces browser alerts with rich modals)
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  } | null>(null);

  const showModal = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setModalState({ isOpen: true, title, message, type });
  };

  const getAuthToken = () => {
    if (apiKey) return apiKey;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lyg_api_key') || '';
    }
    return '';
  };

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

  // Invoice Settings State
  const invoiceSettings = useStockFlowStore(s => s.invoiceSettings);
  const updateInvoiceSettings = useStockFlowStore(s => s.updateInvoiceSettings);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceSettings>(invoiceSettings || DEFAULT_INVOICE_SETTINGS);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceSaveMsg, setInvoiceSaveMsg] = useState<string | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (invoiceSettings) {
      setInvoiceForm(invoiceSettings);
    }
  }, [invoiceSettings]);

  const handleSaveInvoiceSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingInvoice(true);
    updateInvoiceSettings(invoiceForm);
    setTimeout(() => {
      setSavingInvoice(false);
      setInvoiceSaveMsg('Configuración de factura guardada exitosamente.');
      setTimeout(() => setInvoiceSaveMsg(null), 3500);
      showModal('¡Guardado Exitoso!', 'La configuración de la factura, el logo y la numeración se guardaron correctamente.', 'success');
    }, 300);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showModal('Archivo muy pesado', 'El archivo del logo no debe superar los 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setInvoiceForm(prev => ({ ...prev, logoUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewInvoice = async () => {
    setPreviewingInvoice(true);
    try {
      updateInvoiceSettings(invoiceForm);
      const previewNumber = `${String(invoiceForm.pointOfSale || 1).padStart(4, '0')}-${String((invoiceForm.invoiceCounter || 0) + 1).padStart(8, '0')}`;
      const sampleSale: SaleRecord = {
        id: 'sample-preview-1',
        ticketId: 'DEMO-PREVIEW',
        date: new Date().toISOString(),
        productId: 'demo-prod-1',
        variantId: 'demo-var-1',
        productName: 'Perfume de Demostración 100ml',
        size: '100ml',
        color: 'Edición Exclusiva',
        clientName: 'Cliente Ejemplo',
        clientPhone: '+54 9 3704 00-0000',
        quantity: 1,
        unitSalePrice: 35000,
        revenue: 35000,
        status: 'Pagada',
        invoiceNumber: previewNumber,
      };

      const doc = await createInvoiceDoc('DEMO-PREVIEW', [sampleSale]);
      if (doc) {
        doc.autoPrint();
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        showModal('Error al previsualizar', 'No se pudo generar la factura de prueba.', 'error');
      }
    } catch (err) {
      console.error('Error generating preview:', err);
      showModal('Error al previsualizar', 'Ocurrió un error al generar la factura.', 'error');
    } finally {
      setPreviewingInvoice(false);
    }
  };

  const copyFromCompanyConfig = () => {
    const parts = [companyConfig.address, companyConfig.city, companyConfig.province, companyConfig.postalCode].filter(Boolean);
    const fullAddress = parts.length > 0 ? parts.join(', ') : companyConfig.address;
    const igUsername = companyConfig.instagramUrl ? companyConfig.instagramUrl.replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') : '';

    setInvoiceForm(prev => ({
      ...prev,
      companyName: companyConfig.name || prev.companyName,
      companyAddress: fullAddress || prev.companyAddress,
      companyPhone: companyConfig.phone || companyConfig.whatsapp || prev.companyPhone,
      companyInstagram: igUsername || prev.companyInstagram,
    }));
    showModal('Datos Copiados', 'Se copiaron el Nombre, Dirección, Teléfono e Instagram desde la configuración de Empresa. Recordá hacer clic en "Guardar Cambios".', 'info');
  };

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
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['X-API-KEY'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL || ''}/api/admin/settings/shipping`, { headers });
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
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['X-API-KEY'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL || ''}/api/admin/settings/company_info`, { headers });
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
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['X-API-KEY'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL || ''}/api/admin/settings/shipping`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(shippingConfig),
      });
      if (res.ok) {
        setShippingSaveMsg('Configuración de envíos guardada exitosamente.');
        setTimeout(() => setShippingSaveMsg(null), 3500);
        showModal('Configuración Guardada', 'La configuración de envíos se guardó exitosamente.', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showModal('Error al guardar', errData.detail || 'Error al guardar la configuración de envíos.', 'error');
      }
    } catch {
      showModal('Error de Conexión', 'No se pudo conectar con el servidor para guardar la configuración de envíos.', 'error');
    } finally {
      setSavingShipping(false);
    }
  };

  const handleSaveCompanyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['X-API-KEY'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL || ''}/api/admin/settings/company_info`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ value: companyConfig }),
      });
      if (res.ok) {
        setCompanySaveMsg('Datos de la empresa guardados correctamente.');
        setTimeout(() => setCompanySaveMsg(null), 3500);
        showModal('¡Guardado Exitoso!', 'Los datos de la empresa y contacto se guardaron correctamente.', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showModal('Error al guardar', errData.detail || 'Ocurrió un error al guardar los datos de la empresa. Verifica tus permisos.', 'error');
      }
    } catch {
      showModal('Error de Conexión', 'No se pudo establecer conexión con el servidor para guardar los datos.', 'error');
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
      const adminToken = getAuthToken();
      const res = await fetch(`${API_URL}/api/admin/settings/wholesale-auto`, {
        headers: { 'X-API-KEY': adminToken, 'Authorization': `Bearer ${adminToken}` }
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
      const adminToken = getAuthToken();
      const res = await fetch(`${API_URL}/api/admin/settings/wholesale-auto`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': adminToken,
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ enabled, min_quantity: minQty })
      });

      if (res.ok) {
        setWholesaleAutoEnabled(enabled);
        setWholesaleAutoMinQty(minQty);
        setSaveSuccessMessage('Configuración de mayoristas guardada exitosamente.');
        setTimeout(() => setSaveSuccessMessage(null), 3500);
      } else {
        const err = await res.json().catch(() => ({}));
        showModal('Error al guardar', err.detail || 'Error al guardar la configuración de mayoristas.', 'error');
      }
    } catch (e) {
      showModal('Error de Conexión', 'Error de conexión al servidor al actualizar la configuración.', 'error');
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
      categoriesConfig: state.categoriesConfig,
      variantGroupsConfig: state.variantGroupsConfig,
      perfumeTypesConfig: state.perfumeTypesConfig,
      products: state.products,
      purchases: state.purchases,
      sales: state.sales,
      exportedAt: new Date().toISOString(),
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
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        importData(json);
        // Persistir también inmediatamente a la base de datos backend
        await fetch('/api/store/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        }).catch(err => console.error('Error sincronizando JSON a DB:', err));

        showModal('Catálogo Restaurado', 'Catálogo, categorías y finanzas restaurados exitosamente.', 'success');
      } catch (err) {
        showModal('Error en Archivo', 'El archivo seleccionado no contiene un formato JSON válido.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- DB EXPORT / IMPORT ---
  const handleExportDB = async () => {
    try {
      setLoading(true);
      // 1. Guardar primero el catálogo actual en la base de datos para que el .db contenga absolutamente todo
      const state = getZustandState();
      await fetch('/api/store/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: state.products,
          categoriesConfig: state.categoriesConfig,
          variantGroupsConfig: state.variantGroupsConfig,
          perfumeTypesConfig: state.perfumeTypesConfig,
          purchases: state.purchases,
          sales: state.sales,
          globalMarkupPrc: state.globalMarkupPrc,
          wholesaleConfig: state.wholesaleConfig,
        }),
      }).catch(err => console.error('Error sincronizando antes de exportar DB:', err));

      // 2. Descargar el archivo .db con todo el catálogo adentro
      const adminToken = getAuthToken();
      const res = await fetch(`${API_URL}/api/admin/backup/db`, {
        headers: { 'X-API-KEY': adminToken, 'Authorization': `Bearer ${adminToken}` }
      });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `perfumeria_db_${new Date().toISOString().split('T')[0]}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showModal('Error de Descarga', 'Error al descargar la copia de seguridad de la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    const adminToken = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/api/admin/backup/db`, {
        method: 'POST',
        headers: { 'X-API-KEY': adminToken, 'Authorization': `Bearer ${adminToken}` },
        body: formData
      });
      if (res.ok) {
        // Cargar inmediatamente el catálogo recién restaurado desde la base de datos SQLite
        try {
          const syncRes = await fetch('/api/store/sync', { cache: 'no-store' });
          if (syncRes.ok) {
            const syncJson = await syncRes.json();
            if (syncJson.data) {
              importData(syncJson.data);
            }
          }
        } catch (syncErr) {
          console.warn('Error leyendo catálogo de la DB restaurada:', syncErr);
        }

        showModal('Base de Datos Restaurada', 'La base de datos SQLite y todo el catálogo fueron restaurados exitosamente.', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showModal('Error al Restaurar', err.detail || 'Error al restaurar la base de datos.', 'error');
      }
    } catch (err) {
      showModal('Error de Red', 'Error de conexión de red al restaurar la base de datos.', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // --- IMAGES EXPORT / IMPORT ---
  const handleExportImages = async () => {
    try {
      setLoading(true);
      const adminToken = getAuthToken();
      const res = await fetch(`${API_URL}/api/admin/backup/images`, {
        headers: { 'X-API-KEY': adminToken, 'Authorization': `Bearer ${adminToken}` }
      });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `perfumeria_imagenes_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showModal('Error de Descarga', 'Error al generar o descargar el paquete de imágenes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    const adminToken = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/api/admin/backup/images`, {
        method: 'POST',
        headers: { 'X-API-KEY': adminToken, 'Authorization': `Bearer ${adminToken}` },
        body: formData
      });
      if (res.ok) {
        showModal('Imágenes Restauradas', 'El paquete de imágenes se restauró exitosamente.', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showModal('Error al Restaurar', err.detail || 'Error al restaurar el paquete de imágenes.', 'error');
      }
    } catch (err) {
      showModal('Error de Red', 'Error de red al subir el paquete de imágenes.', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // --- AUTO BACKUPS (SQLite 7-day retention) ---
  const [autoBackups, setAutoBackups] = useState<AutoBackup[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [creatingAuto, setCreatingAuto] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<AutoBackup | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<AutoBackup | null>(null);
  const [restoringAuto, setRestoringAuto] = useState(false);

  const fetchAutoBackups = useCallback(async () => {
    setLoadingAuto(true);
    try {
      const adminToken = getAuthToken();
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['X-API-KEY'] = adminToken;
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/backup/auto', { headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAutoBackups(data.backups || []);
      } else if (data.error) {
        console.warn('Error al consultar copias automáticas:', data.error);
      }
    } catch (err) {
      console.error('Error al cargar copias automáticas:', err);
    } finally {
      setLoadingAuto(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (activeTab === 'respaldos' && isSuperAdmin) {
      fetchAutoBackups();
    }
  }, [activeTab, isSuperAdmin, fetchAutoBackups]);

  const handleCreateAutoBackup = async () => {
    setCreatingAuto(true);
    try {
      const adminToken = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['X-API-KEY'] = adminToken;
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/backup/auto', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error (${res.status}) al crear la copia`);
      showModal('Copia Creada', 'Copia de seguridad SQLite creada correctamente con retención automática de 7 días.', 'success');
      await fetchAutoBackups();
    } catch (err: any) {
      showModal('Error al Crear Copia', err.message || 'Error al crear la copia de seguridad.', 'error');
    } finally {
      setCreatingAuto(false);
    }
  };

  const handleConfirmRestoreAuto = async () => {
    if (!backupToRestore) return;
    setRestoringAuto(true);
    try {
      const adminToken = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['X-API-KEY'] = adminToken;
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/backup/auto', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'restore', filename: backupToRestore.filename }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error (${res.status}) al restaurar`);
      setBackupToRestore(null);
      showModal('Base de Datos Restaurada', 'La base de datos SQLite se restauró exitosamente. La página se recargará.', 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      showModal('Error al Restaurar', err.message || 'Error al restaurar la copia de seguridad.', 'error');
      setRestoringAuto(false);
    }
  };

  const handleConfirmDeleteAuto = async () => {
    if (!backupToDelete) return;
    try {
      const adminToken = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['X-API-KEY'] = adminToken;
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch('/api/backup/auto', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'delete', filename: backupToDelete.filename }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error (${res.status}) al eliminar`);
      setBackupToDelete(null);
      showModal('Copia Eliminada', 'La copia de seguridad ha sido eliminada del disco.', 'info');
      await fetchAutoBackups();
    } catch (err: any) {
      showModal('Error al Eliminar', err.message || 'Error al eliminar la copia de seguridad.', 'error');
    }
  };

  const handleDownloadAuto = async (filename: string) => {
    try {
      const adminToken = getAuthToken();
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['X-API-KEY'] = adminToken;
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      const res = await fetch(`/api/backup/auto?action=download&filename=${encodeURIComponent(filename)}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showModal('Error al Descargar', err.error || `Error (${res.status}) al descargar la copia.`, 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showModal('Error de Red', 'Error de conexión al descargar la copia de seguridad.', 'error');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-5 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-700/80 pb-4 sm:pb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5 sm:gap-3">
            <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl">settings</span>
            Configuración del Sistema
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
            Gestiona precios, promociones mayoristas, catálogo y copias de seguridad de forma organizada.
          </p>
        </div>

        {saveSuccessMessage && (
          <div className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in self-start md:self-auto">
            <span className="material-symbols-outlined text-base">check_circle</span>
            {saveSuccessMessage}
          </div>
        )}
      </div>

      {/* Tabs Navigation: Grid simétrico 2x2 en mobile + 5ta opción a lo ancho, flex en desktop */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-100/90 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-full md:w-fit mb-6 sm:mb-8">
        <button
          onClick={() => setActiveTab('precios')}
          className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left ${activeTab === 'precios'
            ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200/60 dark:border-slate-700'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
        >
          <div className={`size-7 sm:size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'precios'
            ? 'bg-primary/10 text-primary'
            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
            <span className="material-symbols-outlined text-base sm:text-lg">payments</span>
          </div>
          <span className="leading-tight truncate">Precios y Mayoristas</span>
        </button>

        <button
          onClick={() => setActiveTab('catalogo')}
          className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left ${activeTab === 'catalogo'
            ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200/60 dark:border-slate-700'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
        >
          <div className={`size-7 sm:size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'catalogo'
            ? 'bg-primary/10 text-primary'
            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
            <span className="material-symbols-outlined text-base sm:text-lg">category</span>
          </div>
          <span className="leading-tight truncate">Categorías y Catálogo</span>
        </button>

        <button
          onClick={() => setActiveTab('envios')}
          className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left ${!isSuperAdmin ? 'col-span-2 md:col-span-1' : ''
            } ${activeTab === 'envios'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
        >
          <div className={`size-7 sm:size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'envios'
            ? 'bg-primary/10 text-primary'
            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
            <span className="material-symbols-outlined text-base sm:text-lg">local_shipping</span>
          </div>
          <span className="leading-tight truncate">Envíos y Entregas</span>
        </button>

        <button
          onClick={() => setActiveTab('factura')}
          className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left ${activeTab === 'factura'
            ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200/60 dark:border-slate-700'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
        >
          <div className={`size-7 sm:size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'factura'
            ? 'bg-primary/10 text-primary'
            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
            <span className="material-symbols-outlined text-base sm:text-lg">receipt_long</span>
          </div>
          <span className="leading-tight truncate">Facturación</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('empresa')}
            className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left ${activeTab === 'empresa'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
          >
            <div className={`size-7 sm:size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'empresa'
              ? 'bg-primary/10 text-primary'
              : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
              <span className="material-symbols-outlined text-base sm:text-lg">storefront</span>
            </div>
            <span className="leading-tight truncate">Empresa</span>
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('respaldos')}
            className={`col-span-2 md:col-span-1 flex items-center justify-center md:justify-start gap-2 sm:gap-2.5 p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left ${activeTab === 'respaldos'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
          >
            <div className={`size-7 sm:size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeTab === 'respaldos'
              ? 'bg-primary/10 text-primary'
              : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
              <span className="material-symbols-outlined text-base sm:text-lg">cloud_sync</span>
            </div>
            <span className="leading-tight truncate">Copias de Seguridad (Backups)</span>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">sell</span>
                    <label className="block text-sm font-bold text-slate-800 dark:text-white">
                      Regla de Descuento Mayorista por Ítem
                    </label>
                  </div>
                  {/* Switch para activar / desactivar porcentaje mayorista */}
                  <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {wholesaleConfig?.enabled !== false ? 'Porcentaje Activo' : 'Manual en Productos'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextEnabled = wholesaleConfig?.enabled === false;
                        setWholesaleConfig({
                          ...wholesaleConfig,
                          enabled: nextEnabled,
                        });
                      }}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${wholesaleConfig?.enabled !== false ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      title={wholesaleConfig?.enabled !== false ? 'Desactivar porcentaje automático' : 'Activar porcentaje automático'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${wholesaleConfig?.enabled !== false ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  {wholesaleConfig?.enabled !== false
                    ? 'Aplica este porcentaje de descuento sobre los precios de venta a menos que configures un precio mayorista manual específico en cada producto.'
                    : 'Porcentaje automático desactivado. El precio al por mayor se ingresa de forma manual en cada producto.'}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">Descuento (%)</label>
                    {wholesaleConfig?.enabled === false && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">Desactivado</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      disabled={wholesaleConfig?.enabled === false}
                      value={wholesaleConfig?.discountPercentage || 10}
                      onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, discountPercentage: Number(e.target.value) || 0 })}
                      className={`w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl pl-4 pr-10 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm ${wholesaleConfig?.enabled === false ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40' : ''
                        }`}
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
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${wholesaleAutoEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${wholesaleAutoEnabled ? 'translate-x-7' : 'translate-x-0'
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
                    Costo de Envío a Domicilio Local ($ ARS)
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

      {/* TAB: FACTURACIÓN Y TICKET */}
      {activeTab === 'factura' && (
        <div className="animate-in fade-in duration-200 w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
                Configuración de Factura y Ticket
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Personalizá el logo, la numeración correlativa bajo el modelo argentino (Punto de Venta - N° Comprobante) y los datos de contacto impresos en las facturas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePreviewInvoice}
                disabled={previewingInvoice}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
                title="Genera un ticket de prueba en PDF"
              >
                <span className="material-symbols-outlined text-base sm:text-lg text-primary">
                  {previewingInvoice ? 'sync' : 'picture_as_pdf'}
                </span>
                {previewingInvoice ? 'Generando...' : 'Previsualizar PDF'}
              </button>
              <button
                type="button"
                onClick={handleSaveInvoiceSettings}
                disabled={savingInvoice}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">
                  {savingInvoice ? 'sync' : 'save'}
                </span>
                {savingInvoice ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>

          {invoiceSaveMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center gap-3 font-semibold text-sm">
              <span className="material-symbols-outlined text-emerald-500">check_circle</span>
              {invoiceSaveMsg}
            </div>
          )}

          <form onSubmit={handleSaveInvoiceSettings} className="space-y-6 w-full">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              {/* COLUMNA IZQUIERDA: LOGO DE FACTURA */}
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">image</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Logo de la Factura</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Imagen que se imprime en el margen superior de cada comprobante</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl">
                    <div className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-pink-300 dark:border-pink-800 flex items-center justify-center overflow-hidden bg-pink-50/30 dark:bg-pink-950/20 shrink-0">
                      {invoiceForm.logoUrl ? (
                        <img
                          src={invoiceForm.logoUrl}
                          alt="Logo de Factura"
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logo-ciara-bonita.png';
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400 text-center px-2">Sin logo</span>
                      )}
                    </div>

                    <div className="space-y-3 w-full">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 mb-2">
                          <span className="size-1.5 rounded-full bg-pink-500"></span>
                          Logo Actual
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Podés subir tu archivo de imagen (PNG, JPG, WebP) o seleccionar uno de los logos predeterminados.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          type="file"
                          ref={logoFileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="px-3.5 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined text-base">upload</span>
                          Subir imagen desde tu equipo
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Logos Disponibles
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoiceForm({ ...invoiceForm, logoUrl: '/logo-ciara-bonita.png' })}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${invoiceForm.logoUrl === '/logo-ciara-bonita.png' || invoiceForm.logoUrl === '/uploads/Logo/LogoCuadrado.png'
                          ? 'bg-pink-50/70 dark:bg-pink-950/30 border-pink-500 text-pink-700 dark:text-pink-300 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium'
                          }`}
                      >
                        <img src="/logo-ciara-bonita.png" alt="Logo Cuadrado" className="size-8 rounded-lg object-contain bg-white shrink-0 border border-slate-200" />
                        <div className="min-w-0">
                          <p className="text-xs leading-tight font-bold truncate">Logo Flor Rosa</p>
                          <p className="text-[10px] text-slate-400 truncate">LogoCuadrado.png (Recomendado)</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInvoiceForm({ ...invoiceForm, logoUrl: '/uploads/Logo/logo.webp' })}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${invoiceForm.logoUrl === '/uploads/Logo/logo.webp'
                          ? 'bg-pink-50/70 dark:bg-pink-950/30 border-pink-500 text-pink-700 dark:text-pink-300 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium'
                          }`}
                      >
                        <img src="/uploads/Logo/logo.webp" alt="Logo Web" className="size-8 rounded-lg object-contain bg-white shrink-0 border border-slate-200" />
                        <div className="min-w-0">
                          <p className="text-xs leading-tight font-bold truncate">Logo Web</p>
                          <p className="text-[10px] text-slate-400 truncate">logo.webp</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Ruta o URL Directa del Logo
                    </label>
                    <input
                      type="text"
                      value={invoiceForm.logoUrl.startsWith('data:image') ? 'Imagen personalizada cargada en base64' : invoiceForm.logoUrl}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, logoUrl: e.target.value })}
                      disabled={invoiceForm.logoUrl.startsWith('data:image')}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                      placeholder="Ej: /logo-ciara-bonita.png o https://..."
                    />
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: NUMERACIÓN OFICIAL ARGENTINA */}
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">tag</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-base">Numeración de Factura (Modelo Argentina)</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Punto de venta y número correlativo autoincrementable</p>
                    </div>
                  </div>

                  {/* Vista Previa En Vivo del Formato */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Vista Previa de la Próxima Factura
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">
                        Formato Oficial
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-3 font-mono">
                      <p className="text-xs font-bold text-slate-400">ENCABEZADO:</p>
                      <p className="text-base font-black text-slate-800 dark:text-white">FACTURA</p>
                      <p className="text-sm font-bold text-primary">
                        Factura Nº {String(invoiceForm.pointOfSale || 1).padStart(4, '0')}-{String((invoiceForm.invoiceCounter || 0) + 1).padStart(8, '0')}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Fecha: {new Date().toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Punto de Venta (4 dígitos)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={invoiceForm.pointOfSale || 1}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, pointOfSale: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        required
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Se muestra como: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{String(invoiceForm.pointOfSale || 1).padStart(4, '0')}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Último Número Emitido (Contador)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={invoiceForm.invoiceCounter || 0}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceCounter: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        required
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Próxima factura: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{String((invoiceForm.invoiceCounter || 0) + 1).padStart(8, '0')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">info</span>
                    <span>
                      Al generar o imprimir la factura de una venta, el número se incrementará automáticamente en 1 y quedará asociado a esa venta de forma permanente.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FILA COMPLETA: DATOS DE LA EMPRESA (PIE DE FACTURA) */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">storefront</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-base">Datos de la Empresa en la Factura</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Información de contacto que se muestra en el pie de página de la factura</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyFromCompanyConfig}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-primary border border-primary/30 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copiar desde pestaña Empresa
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Nombre / Razón Social
                  </label>
                  <input
                    type="text"
                    value={invoiceForm.companyName}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, companyName: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: Ciara Bonita"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={invoiceForm.companyPhone}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, companyPhone: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: +54 9 3704 74-7426"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Usuario de Instagram
                  </label>
                  <input
                    type="text"
                    value={invoiceForm.companyInstagram}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, companyInstagram: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: ciarabonita_26"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Dirección Completa
                  </label>
                  <input
                    type="text"
                    value={invoiceForm.companyAddress}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, companyAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: Circuito 5, Formosa Argentina 3600."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Sitio Web
                  </label>
                  <input
                    type="text"
                    value={invoiceForm.companyWebsite}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, companyWebsite: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: www.ciarabonita.com"
                  />
                </div>
              </div>
            </div>

            {/* BOTÓN INFERIOR DE GUARDADO */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingInvoice}
                className="px-8 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md shadow-primary/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">
                  {savingInvoice ? 'sync' : 'save'}
                </span>
                {savingInvoice ? 'Guardando...' : 'Guardar Configuración de Factura'}
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

                  {/* Acceso a Identidad Web, Favicon y WhatsApp */}
                  <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 border border-pink-200/80 dark:border-pink-800/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-pink-500/20">
                        <span className="material-symbols-outlined text-lg">share</span>
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white text-xs">Favicon, Barra de Título y WhatsApp</h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Configura la imagen para compartir en WhatsApp, el favicon y el texto de la pestaña con simuladores en vivo.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const btn = document.getElementById('btn-nav-sections');
                        if (btn) btn.click();
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-pink-600 dark:text-pink-300 font-bold text-xs rounded-lg border border-pink-200 dark:border-pink-800/60 shadow-sm shrink-0 flex items-center gap-1 self-start sm:self-auto"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      <span>Configurar en Secciones</span>
                    </button>
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

          {/* ── Copias de Seguridad Automáticas (Retención 7 días) ──────────── */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">shield</span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-base">
                    Copias de Seguridad Automáticas
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <span className="material-symbols-outlined text-xs">schedule</span> Retención 7 días
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Copias directas de la base de datos SQLite. Puedes crear una manualmente, restaurar el sistema a cualquier punto o descargar el archivo <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px] font-mono">.db</code>.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={fetchAutoBackups}
                  disabled={loadingAuto}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  title="Actualizar lista"
                >
                  <span className={`material-symbols-outlined text-sm ${loadingAuto ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  Actualizar
                </button>
                <button
                  onClick={handleCreateAutoBackup}
                  disabled={creatingAuto}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${creatingAuto ? 'animate-spin' : ''}`}>
                    {creatingAuto ? 'sync' : 'add'}
                  </span>
                  {creatingAuto ? 'Creando...' : 'Crear Ahora'}
                </button>
              </div>
            </div>

            {/* Backups List */}
            {loadingAuto ? (
              <div className="flex items-center justify-center py-10 text-slate-500 dark:text-slate-400 text-xs">
                <span className="material-symbols-outlined text-lg animate-spin mr-2">refresh</span>
                Cargando copias de seguridad...
              </div>
            ) : autoBackups.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/40 dark:bg-slate-900/30">
                <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-600 mx-auto mb-2 block">
                  history
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold">
                  No hay copias de seguridad automáticas todavía.
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">
                  Haz clic en &ldquo;Crear Ahora&rdquo; para generar la primera copia de seguridad.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/50">
                {autoBackups.map((backup) => (
                  <div
                    key={backup.filename}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 transition-colors ${backup.isSafetyBackup
                      ? 'bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-mono font-medium text-slate-800 dark:text-white truncate max-w-[340px]" title={backup.filename}>
                          {backup.filename}
                        </span>
                        {backup.isSafetyBackup && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                            Prev. Restauración
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{localDateTime(backup.createdAt)}</span>
                        <span className="text-slate-400 dark:text-slate-600 text-xs">·</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{relativeTime(backup.createdAt)}</span>
                        <span className="text-slate-400 dark:text-slate-600 text-xs">·</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{backup.formattedSize}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleDownloadAuto(backup.filename)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Descargar"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                      </button>
                      <button
                        onClick={() => setBackupToRestore(backup)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        title="Restaurar esta copia"
                      >
                        <span className="material-symbols-outlined text-lg">restore</span>
                      </button>
                      <button
                        onClick={() => setBackupToDelete(backup)}
                        className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Las copias más antiguas de 7 días se eliminan automáticamente del disco para optimizar el almacenamiento. Los snapshots de seguridad previos a una restauración se conservan indefinidamente. Para programar el backup diario en producción, configura el cron con <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">scripts/backup.sh</code>.
            </p>
          </div>
        </div>
      )}

      {/* Modal Restaurar Auto Backup Confirm */}
      {backupToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-amber-500/30 text-left">
            <div className="flex items-center gap-2.5 text-amber-500 mb-3">
              <span className="material-symbols-outlined text-2xl">restore</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">¿Restaurar esta copia SQLite?</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              Se creará un snapshot de seguridad del estado actual antes de restaurar. <strong className="text-slate-900 dark:text-white">La base de datos activa será reemplazada</strong> por:
              <br />
              <span className="inline-block mt-2 font-mono text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded">
                {backupToRestore.filename}
              </span>
              <br />
              <span className="block mt-2 text-xs text-slate-500 dark:text-slate-400">
                La página se recargará automáticamente al completarse.
              </span>
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setBackupToRestore(null)}
                disabled={restoringAuto}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreAuto}
                disabled={restoringAuto}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors flex items-center gap-1.5"
              >
                {restoringAuto && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
                {restoringAuto ? 'Restaurando...' : 'Sí, Restaurar Base de Datos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Auto Backup Confirm */}
      {backupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-rose-500/30 text-left">
            <div className="flex items-center gap-2.5 text-rose-500 mb-3">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">¿Eliminar copia de seguridad?</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              Se eliminará permanentemente del disco el archivo:
              <br />
              <span className="inline-block mt-2 font-mono text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 px-2 py-1 rounded break-all">
                {backupToDelete.filename}
              </span>
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setBackupToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAuto}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Window */}
      {modalState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-700 text-center transform transition-all scale-100 animate-scale-up">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${modalState.type === 'error'
                ? 'bg-rose-500/10 text-rose-500'
                : modalState.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-primary/10 text-primary'
                }`}
            >
              <span className="material-symbols-outlined text-3xl">
                {modalState.type === 'error'
                  ? 'error'
                  : modalState.type === 'success'
                    ? 'check_circle'
                    : 'info'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              {modalState.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 font-medium text-sm leading-relaxed mb-6">
              {modalState.message}
            </p>
            <button
              type="button"
              onClick={() => setModalState(null)}
              className={`w-full py-3 text-white font-bold rounded-xl shadow-lg transition-all ${modalState.type === 'error'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                : modalState.type === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  : 'bg-primary hover:bg-primary/90 shadow-primary/30'
                }`}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
