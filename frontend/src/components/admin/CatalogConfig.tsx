import { useStockFlowStore, CategoryConfig, VariantGroupConfig } from '@/store/useStockStore';
import { useState } from 'react';

export default function CatalogConfig() {
  const { categoriesConfig, variantGroupsConfig, setCategoriesConfig, setVariantGroupsConfig } = useStockFlowStore();

  const [cats, setCats] = useState<CategoryConfig[]>(categoriesConfig || []);
  const [vGroups, setVGroups] = useState<VariantGroupConfig[]>(variantGroupsConfig || []);

  const saveCats = (c: CategoryConfig[]) => { setCats(c); setCategoriesConfig(c); };
  const saveVGroups = (v: VariantGroupConfig[]) => { setVGroups(v); setVariantGroupsConfig(v); };

  return (
    <div className="space-y-8">
      {/* CATEGORIES */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-white">Categorías de Productos</h3>
          <button onClick={() => saveCats([...cats, { grupo: 'Nuevo Grupo', variantGroupId: 'none', opciones: [] }])} className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20 font-semibold">+ Grupo</button>
        </div>
        <div className="space-y-4">
          {cats.map((cat, idx) => (
            <div key={idx} className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 rounded-lg">
              <div className="flex flex-col md:flex-row gap-4 md:items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                <input 
                  type="text" value={cat.grupo}
                  onChange={(e) => {
                    const n = [...cats]; n[idx].grupo = e.target.value; saveCats(n);
                  }}
                  className="font-black text-lg bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-slate-400 focus:outline-none flex-1 dark:text-white"
                  placeholder="Nombre de categoría"
                />
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Usa Variantes:</span>
                  <select
                    className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                    value={cat.variantGroupId}
                    onChange={(e) => {
                      const n = [...cats]; n[idx].variantGroupId = e.target.value; saveCats(n);
                    }}
                  >
                    <option value="none">Ninguno (Sólo Cantidad/Precio)</option>
                    {vGroups.map(vg => (
                      <option key={vg.id} value={vg.id}>{vg.name}</option>
                    ))}
                  </select>
                  <button onClick={() => { const n = [...cats]; n.splice(idx,1); saveCats(n); }} className="text-red-500 hover:bg-red-50 p-1 rounded material-symbols-outlined text-sm ml-2">delete</button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {cat.opciones.map((opt, oIdx) => (
                  <div key={oIdx} className="bg-slate-100 dark:bg-slate-700 text-sm px-2 py-1 rounded flex items-center gap-1 dark:text-slate-200">
                    <input 
                       value={opt} 
                       onChange={(e) => {
                         const n = [...cats]; n[idx].opciones[oIdx] = e.target.value; saveCats(n);
                       }}
                       className="bg-transparent w-auto outline-none border-b border-transparent focus:border-slate-400"
                       style={{ width: `${Math.max(opt.length, 5)}ch` }}
                    />
                    <button onClick={() => { const n = [...cats]; n[idx].opciones.splice(oIdx,1); saveCats(n); }} className="text-slate-400 hover:text-red-500 material-symbols-outlined text-[14px]">close</button>
                  </div>
                ))}
                <button onClick={() => { const n = [...cats]; n[idx].opciones.push('Nueva'); saveCats(n); }} className="text-xs text-slate-500 hover:text-primary border border-dashed border-slate-300 rounded px-2">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VARIANT GROUPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {vGroups.map((vg, vgIdx) => (
          <div key={vg.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
              <input 
                className="font-bold text-slate-800 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-400 outline-none w-full mr-2"
                value={vg.name}
                onChange={(e) => { const n = [...vGroups]; n[vgIdx].name = e.target.value; saveVGroups(n); }}
                placeholder="Nombre del grupo (ej: Talles de Ropa)"
              />
              <button onClick={() => { const n = [...vGroups]; n.splice(vgIdx,1); saveVGroups(n); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded material-symbols-outlined text-sm">delete</button>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2 text-xs font-bold text-slate-500 px-1 mb-1">
                <span className="w-20 text-center">Valor principal</span>
                <span className="flex-1">Descripción corta</span>
              </div>
              {vg.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <input value={opt.value} onChange={(e) => { const n = [...vGroups]; n[vgIdx].options[optIdx].value = e.target.value; saveVGroups(n); }} className="w-20 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm dark:text-white outline-none font-bold text-center" placeholder="Ej: XL" />
                  <input value={opt.description} onChange={(e) => { const n = [...vGroups]; n[vgIdx].options[optIdx].description = e.target.value; saveVGroups(n); }} className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm dark:text-white outline-none" placeholder="Ej: Extra Grande" />
                  <button onClick={() => { const n = [...vGroups]; n[vgIdx].options.splice(optIdx,1); saveVGroups(n); }} className="text-red-500 material-symbols-outlined text-sm p-1 hover:bg-red-50 rounded">delete</button>
                </div>
              ))}
            </div>
            <button onClick={() => { const n = [...vGroups]; n[vgIdx].options.push({ value: 'Nuevo', description: '' }); saveVGroups(n); }} className="mt-4 w-full text-sm border border-dashed border-primary/30 text-primary py-2 rounded-lg hover:bg-primary/5 font-bold">+ Agregar opción</button>
          </div>
        ))}

        <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[200px]">
           <p className="text-slate-500 dark:text-slate-400 font-medium">¿Necesitas otros tipos de variantes?</p>
           <button onClick={() => saveVGroups([...vGroups, { id: `custom-${Date.now()}`, name: 'Nuevo Grupo de Variantes', options: [] }])} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm text-slate-800 dark:text-white font-bold py-2 px-4 rounded-xl hover:border-primary transition-colors flex items-center gap-2">
             <span className="material-symbols-outlined">add</span>
             Crear Grupo de Variantes
           </button>
        </div>
      </div>
    </div>
  )
}
