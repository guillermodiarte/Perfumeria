'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useStockFlowStore, Product } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';

/** Full-screen lightbox with arrow navigation */
function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors" onClick={onClose}>
        <span className="material-symbols-outlined">close</span>
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm font-bold px-3 py-1 rounded-full">
          {current + 1} / {images.length}
        </div>
      )}

      {/* Prev */}
      {images.length > 1 && (
        <button className="absolute left-4 size-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors" onClick={e => { e.stopPropagation(); prev(); }}>
          <span className="material-symbols-outlined text-3xl">chevron_left</span>
        </button>
      )}

      {/* Image */}
      <img
        src={images[current]}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button className="absolute right-4 size-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors" onClick={e => { e.stopPropagation(); next(); }}>
          <span className="material-symbols-outlined text-3xl">chevron_right</span>
        </button>
      )}

      {/* Strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[80vw] px-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrent(i); }}
              className={`size-12 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                i === current ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-90'
              }`}
            >
              <img src={img} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Product card gallery: shows cover thumbnail + count badge, opens lightbox on click */
function ProductGallery({ urls, name }: { urls: string[]; name: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const parseUrl = (url: string) => url.startsWith('http') ? url : `${API_URL}${url}`;
  const parsedUrls = urls.map(parseUrl);

  if (!urls || urls.length === 0) return null;

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox images={parsedUrls} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
      <div
        className="w-full h-48 bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 overflow-hidden flex-shrink-0 relative cursor-zoom-in"
        onClick={() => setLightboxIndex(0)}
      >
        <img src={parsedUrls[0]} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        {parsedUrls.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm border border-white/10 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">collections</span>
            +{parsedUrls.length - 1}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
          <span className="material-symbols-outlined text-white text-4xl drop-shadow-lg">zoom_in</span>
        </div>
      </div>
    </>
  );
}

export default function ProductosView({ showAlert, apiKey, apiUrl }: { showAlert: (msg: string) => void; apiKey?: string; apiUrl?: string }) {
  const products = useStockFlowStore(s => s.products);
  const deleteProduct = useStockFlowStore(s => s.deleteProduct);
  const updateProduct = useStockFlowStore(s => s.updateProduct);
  const categoriesConfig = useStockFlowStore(s => s.categoriesConfig);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('Todo');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Todo');
  
  // Modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const variantGroupsConfig = useStockFlowStore(s => s.variantGroupsConfig);

  useEffect(() => {
    // Reset subcategory when main category changes
    setSelectedSubCategory('Todo');
  }, [selectedMainCategory]);

  const getGrupoByCategory = (cat: string) => {
      for(let g of categoriesConfig) {
          if(g.opciones.includes(cat)) return g.grupo;
      }
      return 'Otros (Sin Asignar)';
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoryId.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchesSearch) return false;

    const grupo = getGrupoByCategory(p.categoryId);
    const matchesMain = selectedMainCategory === 'Todo' || grupo === selectedMainCategory;
    const matchesSub = selectedSubCategory === 'Todo' || p.categoryId === selectedSubCategory;

    return matchesMain && matchesSub;
  });

  const mainCategories = ['Todo', ...categoriesConfig.map(c => c.grupo)];
  const subCategories = selectedMainCategory === 'Todo' 
      ? ['Todo'] 
      : ['Todo', ...(categoriesConfig.find(c => c.grupo === selectedMainCategory)?.opciones || [])];

  const handleEditClick = (p: Product) => {
      setEditingProduct(p);
      setEditForm(JSON.parse(JSON.stringify(p))); // Deep copy to avoid mutating store directly before save
  };

  const handleVariantChange = (vIdx: number, field: string, value: any) => {
      setEditForm((prev: any) => {
          const newForm = { ...prev };
          const variant = newForm.variants[vIdx];
          variant[field] = value;
          
          if (field === 'unitPurchasePrice' && (variant.autoCalculated !== false)) {
              variant.manualSalePrice = Number((value * (1 + (globalMarkupPrc / 100))).toFixed(2));
          }
          if (field === 'manualSalePrice') {
              variant.autoCalculated = false;
          }
          return newForm;
      });
  };

  const removeVariant = (vIdx: number) => {
      setEditForm((prev: any) => {
          const newForm = { ...prev };
          if (newForm.variants.length > 1) {
              newForm.variants.splice(vIdx, 1);
          }
          return newForm;
      });
  };

  const addVariant = () => {
      setEditForm((prev: any) => {
          const newForm = { ...prev };
          newForm.variants = [...prev.variants];
          newForm.variants.push({
              id: 'v-' + Math.random().toString(36).substr(2, 9),
              size: 'M', color: '', stock: 1, 
              unitPurchasePrice: 0, manualSalePrice: 0, 
              autoCalculated: true, sizeIndex: 0
          });
          return newForm;
      });
  };
  
  const handleSaveEdit = () => {
      if(editingProduct && editForm) {
          // Flatten variant sizes if they use indices
          const formattedVariants = editForm.variants.map((item: any) => {
              const group = categoriesConfig.find(g => g.opciones.includes(editForm.categoryId));
              let finalSize = item.size;
              
              if (group && group.variantGroupId !== 'none') {
                  const variantGroup = variantGroupsConfig.find(vg => vg.id === group.variantGroupId);
                  if (variantGroup && item.sizeIndex !== undefined) {
                      const row = variantGroup.options[item.sizeIndex || 0];
                      if (row) {
                          finalSize = row.description ? `${row.value} - ${row.description}` : row.value;
                      }
                  }
              }
              return { ...item, size: finalSize };
          });
          
          updateProduct(editingProduct.id, {
              name: editForm.name,
              sku: editForm.sku,
              categoryId: editForm.categoryId,
              targetGender: editForm.targetGender,
              imageUrls: editForm.imageUrls
          }, formattedVariants);

          showAlert('Producto y finanzas actualizados con éxito.');
          setEditingProduct(null);
          setEditForm(null);
      }
  };

  const executeDelete = () => {
      if(confirmDeleteId) {
          deleteProduct(confirmDeleteId);
          showAlert('Producto eliminado y datos financieros depurados.');
          setConfirmDeleteId(null);
      }
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Filters Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-3xl">inventory_2</span>
                Inventario de Tienda
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Busca y filtra productos dinámicamente.</p>
            </div>
            <div className="relative w-full md:w-96 flex-shrink-0">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input 
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar Nombre, SKU o Subcategoría"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
                />
            </div>
        </div>

        {/* Dynamic Selectors */}
        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
            <div className="w-full md:w-1/2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Categoría Principal</label>
                <div className="relative">
                    <select 
                        value={selectedMainCategory} 
                        onChange={e => setSelectedMainCategory(e.target.value)}
                        className="w-full appearance-none !bg-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-4 pr-10 py-3 font-bold outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                    >
                        {mainCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                </div>
            </div>
            <div className="w-full md:w-1/2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Subcategoría</label>
                <div className="relative">
                    <select 
                        value={selectedSubCategory} 
                        onChange={e => setSelectedSubCategory(e.target.value)}
                        disabled={selectedMainCategory === 'Todo'}
                        className={`w-full appearance-none !bg-none border rounded-xl px-4 pr-10 py-3 font-bold outline-none transition-all ${
                            selectedMainCategory === 'Todo' 
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed' 
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary cursor-pointer'
                        }`}
                    >
                        {subCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                </div>
            </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="material-symbols-outlined text-6xl text-slate-300">search_off</span>
              <p className="text-slate-500 font-bold mt-4">No se encontraron productos con estos filtros.</p>
          </div>
      ) : (
          <div className="animate-in fade-in duration-500">
             <div className="flex items-center justify-between mb-4 px-2">
                 <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                     Resultados para <span className="text-primary">{selectedSubCategory !== 'Todo' ? selectedSubCategory : selectedMainCategory}</span>
                 </h3>
                 <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{filteredProducts.length} Productos</span>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map(p => {
                     const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
                     return (
                         <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group relative animate-in fade-in zoom-in-95 duration-500">
                            {/* Action Buttons */}
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full p-1 border border-slate-100 dark:border-slate-700">
                                <button onClick={() => handleEditClick(p)} className="size-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button onClick={() => setConfirmDeleteId(p.id)} className="size-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                            
                            <ProductGallery urls={p.imageUrls || []} name={p.name} />
                            
                            <div className="p-5 flex-1 flex flex-col">
                                 <div className="text-[10px] font-black text-primary mb-1 uppercase tracking-wider bg-primary/10 inline-block px-2 py-0.5 rounded mr-auto">{p.categoryId}</div>
                                 <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight pr-14 mt-1">{p.name}</h4>
                                 <div className="text-xs text-slate-400 font-mono mt-1 mb-4">{p.sku}</div>
                                 
                                 <div className="flex gap-4">
                                      <div>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">P. Compra</p>
                                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">${p.purchasePrice}</p>
                                      </div>
                                      <div>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">P. Venta</p>
                                          <p className="text-sm font-black text-slate-900 dark:text-white">${p.salePrice}</p>
                                      </div>
                                 </div>
                                 
                                 <div className="mt-auto pt-4 flex flex-col">
                                     <div className="flex items-center justify-between mb-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                                         <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stock / Variantes</p>
                                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${totalStock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{totalStock > 0 ? `${totalStock} Disp.` : 'Agotado'}</span>
                                     </div>
                                     <div className="flex flex-wrap gap-2">
                                         {p.variants.map(v => (
                                             <div key={v.id} className="flex flex-col flex-1 min-w-[60px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center">
                                                 <div className="flex flex-col justify-center items-center mb-1">
                                                     {(v as any).description && (
                                                         <span className="text-[10px] font-bold text-slate-500 truncate max-w-[70px]" title={(v as any).description}>{(v as any).description}</span>
                                                     )}
                                                     <span 
                                                         className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-help"
                                                         title={(v.size.includes('MER:') || v.size.includes('ARG:') || v.size.includes('INT:')) ? v.size : undefined}
                                                     >
                                                         {v.size.includes('MER:') ? v.size.split(' ')[0].replace('MER:', 'T:') : 
                                                          v.size.includes('ARG:') ? v.size.split(' ')[0].replace('ARG:', 'T:') : 
                                                          v.size.includes('INT:') ? v.size.split(' ')[0].replace('INT:', 'T:') : v.size}
                                                     </span>
                                                 </div>
                                                 <span className={`text-sm font-black ${v.stock > 0 ? 'text-primary' : 'text-red-500'}`}>{v.stock}</span>
                                             </div>
                                         ))}
                                         {p.variants.length === 0 && (
                                             <div className="w-full text-center text-xs text-slate-400 italic py-2">Sin variantes. Usa Ingreso Mercadería.</div>
                                         )}
                                     </div>
                                 </div>
                            </div>
                         </div>
                     );
                })}
             </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
                <div className="size-14 rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                </div>
                <h3 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">¿Eliminar Producto?</h3>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Esta acción purgará todo el historial contable de este producto, descontando las ganancias y gastos en Finanzas. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                    <button onClick={executeDelete} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">Sí, Eliminar</button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && editForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-w-4xl w-full my-8 animate-in zoom-in-95 fade-in duration-200">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                       <span className="material-symbols-outlined text-blue-500">edit_square</span> Editar Producto Completo
                   </h3>
                   <button onClick={() => setEditingProduct(null)} className="size-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                       <span className="material-symbols-outlined text-sm">close</span>
                   </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2 pb-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" 
                                value={editForm.categoryId} 
                                onChange={e => setEditForm((prev:any) => ({...prev, categoryId: e.target.value}))}
                            >
                                {categoriesConfig.map(g => (
                                    <optgroup key={g.grupo} label={g.grupo}>
                                        {g.opciones.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Público</label>
                            <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" value={editForm.targetGender || 'Unisex'} onChange={e => setEditForm((prev:any) => ({...prev, targetGender: e.target.value}))}>
                                <option value="Mujer">Mujer</option>
                                <option value="Hombre">Hombre</option>
                                <option value="Unisex">Unisex</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Producto</label>
                            <input type="text" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" value={editForm.name} onChange={e => setEditForm((prev:any) => ({...prev, name: e.target.value}))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">SKU</label>
                            <input type="text" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium font-mono focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" value={editForm.sku} onChange={e => setEditForm((prev:any) => ({...prev, sku: e.target.value}))} />
                        </div>
                    </div>

                    {/* Images */}
                    <div className="flex flex-col gap-2">
                        <label className="block text-xs font-bold text-slate-500">Imágenes del Producto</label>
                        <div className="flex items-center gap-3 w-full border border-slate-200 dark:border-slate-700/60 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                            <label className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-colors text-xs font-bold whitespace-nowrap ${isUploading
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-600 cursor-wait'
                                : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer'
                                }`}>
                                <span className="material-symbols-outlined text-[16px]">{isUploading ? 'sync' : 'add_photo_alternate'}</span>
                                {isUploading ? 'Subiendo...' : 'Subir'}
                                <input
                                    type="file" accept="image/*" multiple disabled={isUploading || !apiKey || !apiUrl} className="hidden"
                                    onChange={async e => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length === 0) return;
                                        if (!apiKey || !apiUrl) { showAlert('Faltan credenciales API.'); return; }

                                        setIsUploading(true);
                                        const uploadedUrls: string[] = [];

                                        for (const file of files) {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            try {
                                                const res = await fetch(`${apiUrl}/api/admin/product-image?subcategory=${encodeURIComponent(editForm.categoryId)}`,
                                                    { method: 'POST', headers: { 'X-API-KEY': apiKey }, body: formData }
                                                );
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    uploadedUrls.push(data.url);
                                                }
                                            } catch (err) {}
                                        }

                                        setEditForm((prev: any) => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ...uploadedUrls] }));
                                        setIsUploading(false);
                                        e.target.value = '';
                                    }}
                                />
                            </label>

                            <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
                                {(editForm.imageUrls || []).map((imgUrl: string, imgIdx: number) => (
                                    <div key={imgIdx} className="size-10 rounded-md flex-shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden relative group/img cursor-pointer"
                                        onClick={() => {
                                            setEditForm((prev: any) => {
                                                const arr = [...(prev.imageUrls || [])];
                                                arr.splice(imgIdx, 1);
                                                return { ...prev, imageUrls: arr };
                                            });
                                        }}
                                    >
                                        <img src={imgUrl.startsWith('http') ? imgUrl : (apiUrl ? `${apiUrl}${imgUrl}` : imgUrl)} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-[14px]">close</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Variants */}
                    <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                        <label className="block text-xs font-bold text-slate-500">Variantes (Stock y Precios)</label>
                        <p className="text-xs text-slate-400 italic mb-2">Nota: Modificar el stock ajustará retroactivamente las facturas de registro en Finanzas.</p>

                        <div className="space-y-2">
                            {editForm.variants.map((variant: any, vIdx: number) => (
                                <div key={vIdx} className="flex flex-wrap md:flex-nowrap items-end gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {(() => {
                                        const group = categoriesConfig.find(g => g.opciones.includes(editForm.categoryId));
                                        if (group && group.variantGroupId !== 'none') {
                                            const variantGroup = variantGroupsConfig.find(vg => vg.id === group.variantGroupId);
                                            if (variantGroup) {
                                                return (
                                                    <div className="flex-1 min-w-[150px]">
                                                        <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold h-10" value={variant.sizeIndex !== undefined ? variant.sizeIndex : variantGroup.options.findIndex(o => variant.size.includes(o.value))} onChange={e => handleVariantChange(vIdx, 'sizeIndex', Number(e.target.value))}>
                                                            <option value="-1" disabled>Selecciona talle...</option>
                                                            {variantGroup.options.map((row, rIdx) => (
                                                                <option key={rIdx} value={rIdx}>{row.value} {row.description ? `(${row.description})` : ''}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                );
                                            }
                                        }
                                        return null;
                                    })()}

                                    <div className="flex-1 min-w-[120px]">
                                        <input type="text" placeholder="Color/Desc" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm h-10" value={variant.color || ''} onChange={e => handleVariantChange(vIdx, 'color', e.target.value)} />
                                    </div>

                                    <div className="w-[80px]">
                                        <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Stock</label>
                                        <input type="number" step="1" className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm font-bold h-9 text-blue-600 dark:text-blue-400" value={variant.stock === '' ? '' : variant.stock} onChange={e => handleVariantChange(vIdx, 'stock', e.target.value === '' ? '' : Number(e.target.value))} />
                                    </div>

                                    <div className="w-[100px]">
                                        <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Costo Unit.</label>
                                        <input type="number" className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm text-red-600 font-bold h-9" value={variant.unitPurchasePrice === '' ? '' : (variant.unitPurchasePrice !== undefined ? variant.unitPurchasePrice : editForm.purchasePrice)} onChange={e => handleVariantChange(vIdx, 'unitPurchasePrice', e.target.value === '' ? '' : Number(e.target.value))} />
                                    </div>

                                    <div className="w-[100px]">
                                        <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none truncate">PV Final</label>
                                        <input type="number" className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm font-black h-9 text-green-600 dark:text-green-400" value={variant.manualSalePrice === '' ? '' : (variant.manualSalePrice !== undefined ? variant.manualSalePrice : editForm.salePrice)} onChange={e => handleVariantChange(vIdx, 'manualSalePrice', e.target.value === '' ? '' : Number(e.target.value))} />
                                    </div>

                                    <button onClick={() => removeVariant(vIdx)} className={`h-9 px-2 rounded-lg transition-colors flex items-center justify-center border border-transparent ${editForm.variants.length > 1 ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-300 opacity-50 cursor-not-allowed'}`} disabled={editForm.variants.length <= 1}>
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button onClick={addVariant} className="text-sm font-bold text-primary flex items-center gap-1 hover:bg-primary/10 px-3 py-2 rounded-lg w-max transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span> Añadir Variante
                        </button>
                    </div>

                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={handleSaveEdit} className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 flex justify-center items-center gap-2 shadow-lg shadow-primary/20 transition-all">
                       <span className="material-symbols-outlined">save</span> Actualizar Producto
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
