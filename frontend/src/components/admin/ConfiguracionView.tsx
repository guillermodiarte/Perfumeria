'use client';
import { useStockFlowStore } from '@/store/useStockStore';

export default function ConfiguracionView() {
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const setGlobalMarkup = useStockFlowStore(s => s.setGlobalMarkup);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
  const setWholesaleConfig = useStockFlowStore(s => s.setWholesaleConfig);

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
    </div>
  );
}
