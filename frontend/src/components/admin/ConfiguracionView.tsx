import { useStockFlowStore } from '@/store/useStockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useRef, useState } from 'react';

export default function ConfiguracionView() {
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const setGlobalMarkup = useStockFlowStore(s => s.setGlobalMarkup);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const setWholesaleConfig = useStockFlowStore(s => s.setWholesaleConfig);
  
  const token = useAuthStore(s => s.token);
  const importData = useStockFlowStore(s => s.importData);
  const getZustandState = () => useStockFlowStore.getState();

  const [loading, setLoading] = useState(false);
  const fileInputRefDB = useRef<HTMLInputElement>(null);
  const fileInputRefImages = useRef<HTMLInputElement>(null);
  const fileInputRefJSON = useRef<HTMLInputElement>(null);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

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
      const res = await fetch(`${API_URL}/api/admin/backup/db`, { headers: { 'X-API-KEY': token || '' } });
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
    try {
      const res = await fetch(`${API_URL}/api/admin/backup/db`, {
        method: 'POST',
        headers: { 'X-API-KEY': token || '' },
        body: formData
      });
      if(res.ok) alert('Base de datos restaurada');
      else alert('Error al restaurar BD');
    } catch (err) { alert('Error de red'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  // --- IMAGES EXPORT / IMPORT ---
  const handleExportImages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/backup/images`, { headers: { 'X-API-KEY': token || '' } });
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
    try {
      const res = await fetch(`${API_URL}/api/admin/backup/images`, {
        method: 'POST',
        headers: { 'X-API-KEY': token || '' },
        body: formData
      });
      if(res.ok) alert('Imágenes restauradas');
      else alert('Error al restaurar Imágenes');
    } catch (err) { alert('Error de red'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">settings</span>
          Configuración Global
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Controla las variables generales del negocio que afectan automáticamente a los otros módulos.
        </p>
      </div>

      <div className="max-w-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          Porcentaje de Ganancia Global (Markup %)
        </label>
        <p className="text-xs text-slate-500 mb-4">
          Este porcentaje se usará para autocalcular los Precios de Venta sugeridos al momento de ingresar mercadería en 'Compras'.
        </p>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <input 
              type="number" 
              value={globalMarkupPrc} 
              onChange={(e) => setGlobalMarkup(Number(e.target.value) || 0)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl pl-4 pr-10 py-3 text-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
          </div>
          <div className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1 h-full">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Guardado Auto
          </div>
        </div>
      </div>

      <div className="max-w-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mt-6">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          Configuración Mayorista
        </label>
        <p className="text-xs text-slate-500 mb-4">
          Establece la cantidad mínima requerida del mismo producto para aplicar el descuento mayorista automáticamente en las ventas.
        </p>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Cantidad mínima (unidades)</label>
            <input 
              type="number" 
              value={wholesaleConfig?.minQuantity || 6} 
              onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, minQuantity: Number(e.target.value) || 0 })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Porcentaje de descuento (%)</label>
            <div className="relative">
              <input 
                type="number" 
                value={wholesaleConfig?.discountPercentage || 10} 
                onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, discountPercentage: Number(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl pl-4 pr-10 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* BACKUPS SECTION */}
      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary text-2xl">cloud_sync</span>
          Respaldos (Backups) del Sistema
        </h3>
        
        {loading && <p className="text-primary font-bold mb-4 animate-pulse">Procesando solicitud de backup...</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Catalog */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">1. Catálogo y Finanzas</h4>
            <p className="text-xs text-slate-500 mb-6">Respaldar productos, compras, ventas y configuraciones de negocio en un archivo JSON.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleExportJSON} className="w-full py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors flex justify-center items-center gap-2">
                <span className="material-symbols-outlined text-sm">download</span> Descargar JSON
              </button>
              <input type="file" accept=".json" className="hidden" ref={fileInputRefJSON} onChange={handleImportJSON} />
              <button onClick={() => fileInputRefJSON.current?.click()} className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2">
                <span className="material-symbols-outlined text-sm">upload</span> Subir JSON
              </button>
            </div>
          </div>

          {/* Card 2: Database */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">2. Base de Datos Backend</h4>
            <p className="text-xs text-slate-500 mb-6">Respaldar configuración, usuarios, pedidos y carritos en el archivo original SQLite.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleExportDB} className="w-full py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors flex justify-center items-center gap-2">
                <span className="material-symbols-outlined text-sm">download</span> Descargar .db
              </button>
              <input type="file" accept=".db" className="hidden" ref={fileInputRefDB} onChange={handleImportDB} />
              <button onClick={() => fileInputRefDB.current?.click()} className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2">
                <span className="material-symbols-outlined text-sm">upload</span> Subir .db
              </button>
            </div>
          </div>

          {/* Card 3: Images */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h4 className="font-bold text-slate-800 dark:text-white mb-2">3. Imágenes (ZIP)</h4>
            <p className="text-xs text-slate-500 mb-6">Comprimir toda la biblioteca de medios y subidas (uploads) en un archivo ZIP para importarlo.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleExportImages} className="w-full py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors flex justify-center items-center gap-2">
                <span className="material-symbols-outlined text-sm">download</span> Descargar .zip
              </button>
              <input type="file" accept=".zip" className="hidden" ref={fileInputRefImages} onChange={handleImportImages} />
              <button onClick={() => fileInputRefImages.current?.click()} className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2">
                <span className="material-symbols-outlined text-sm">upload</span> Subir .zip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
