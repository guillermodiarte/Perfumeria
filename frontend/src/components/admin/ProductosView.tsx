'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useStockFlowStore, Product, DEFAULT_PERFUME_TYPES, getVariantGroupForCategory } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';
import { syncBatchItemsToStore } from '@/utils/syncBatch';

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

  const parseUrl = (url: string) => {
    if (!url) return '/logo.webp';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${API_URL}${cleanPath}`;
  };

  const parsedUrls = (urls && urls.length > 0) ? urls.map(parseUrl) : ['/logo.webp'];

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox images={parsedUrls} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
      <div
        className="w-full h-48 bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 overflow-hidden flex-shrink-0 relative cursor-zoom-in"
        onClick={() => setLightboxIndex(0)}
      >
        <img
          src={parsedUrls[0]}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/logo.webp';
          }}
        />
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

// ── Tipos para el modal de fusión ──────────────────────────────────────────
type MergeVariantDecision = {
  size: string;
  // 'source' = precio del producto que estamos editando, 'target' = precio del existente
  priceChoice: 'source' | 'target';
  sourceSalePrice: number;
  targetSalePrice: number;
  sourcePurchasePrice: number;
  targetPurchasePrice: number;
  sourceStock: number;
  targetStock: number;
  mergedStock: number; // siempre suma de ambos
};

type MergeState = {
  targetProduct: any;          // producto existente con ese nombre
  sourceVariants: any[];       // variantes del producto que estamos editando (formateadas)
  conflicts: MergeVariantDecision[];  // variantes con mismo tamaño en ambos
  onlyInSource: any[];         // variantes solo en el producto editado
  onlyInTarget: any[];         // variantes solo en el producto existente
};

export default function ProductosView({ showAlert, apiKey, apiUrl }: { showAlert: (msg: string) => void; apiKey?: string; apiUrl?: string }) {
  const products = useStockFlowStore(s => s.products);
  const deleteProduct = useStockFlowStore(s => s.deleteProduct);
  const updateProduct = useStockFlowStore(s => s.updateProduct);
  const registerPurchaseBatch = useStockFlowStore(s => s.registerPurchaseBatch);
  const categoriesConfig = useStockFlowStore(s => s.categoriesConfig);

  const [loadingSync, setLoadingSync] = useState(false);
  const effectiveApiUrl = apiUrl || API_URL;

  // Merge modal state
  const [mergeState, setMergeState] = useState<MergeState | null>(null);

  const handleSyncFromBatch = async () => {
    setLoadingSync(true);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['X-API-KEY'] = apiKey;
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetch(`${effectiveApiUrl}/api/admin/purchase-batches?limit=10`, { headers });
      if (!res.ok) throw new Error('Error al consultar lotes del servidor');
      const data = await res.json();
      const firstBatch = data.batches?.[0];
      if (!firstBatch) {
        showAlert('No se encontraron lotes de compra en el sistema.');
        return;
      }
      const detRes = await fetch(`${effectiveApiUrl}/api/admin/purchase-batches/${firstBatch.id}`, { headers });
      if (!detRes.ok) throw new Error('Error al consultar detalle del lote');
      const batchData = await detRes.json();
      const count = syncBatchItemsToStore(batchData, registerPurchaseBatch, Number(globalMarkupPrc) || 50);
      showAlert(`✅ ¡Listo! Se cargaron ${count} productos al inventario desde el lote ${batchData.batch_number}.`);
    } catch (e: any) {
      showAlert(`Error: ${e.message}`);
    } finally {
      setLoadingSync(false);
    }
  };

  // Repara todos los nombres en purchase_batch_items usando los nombres actuales del store
  const [loadingRepair, setLoadingRepair] = useState(false);
  const handleRepairNames = async () => {
    setLoadingRepair(true);
    try {
      let updated = 0;
      for (const prod of products) {
        const res = await fetch(`/api/admin/products/${encodeURIComponent(prod.id)}/rename`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: prod.name }),
        });
        if (res.ok) {
          const data = await res.json();
          updated += data.batchItemsUpdated || 0;
        }
      }
      showAlert(`✅ Nombres reparados en historial de compras. ${updated} registros actualizados.`);
    } catch (e: any) {
      showAlert(`Error al reparar nombres: ${e.message}`);
    } finally {
      setLoadingRepair(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('Todo');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Todo');
  
  // Modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  // Media library picker state
  const [showMediaLib, setShowMediaLib] = useState(false);
  const [mediaLibImages, setMediaLibImages] = useState<string[]>([]);
  const [mediaLibLoading, setMediaLibLoading] = useState(false);
  const [mediaLibSearch, setMediaLibSearch] = useState('');

  const openMediaLib = async (force = false) => {
    setShowMediaLib(true);
    if (!force && mediaLibImages.length > 0) return; // already loaded
    setMediaLibLoading(true);
    try {
      const token = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
      // Always use relative URL for Next.js API route (works in both dev & prod)
      const res = await fetch(`/api/admin/media`, {
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // API returns { files: [{url, filename, category, size}] }
        const files = data.files || [];
        const urls: string[] = files
          .map((f: any) => (typeof f === 'string' ? f : f.url || ''))
          .filter((u: string) => Boolean(u) && /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp)$/i.test(u));
        setMediaLibImages(urls);
      }
    } catch (e) {
      // ignore
    } finally {
      setMediaLibLoading(false);
    }
  };

  
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const variantGroupsConfig = useStockFlowStore(s => s.variantGroupsConfig);
  const perfumeTypesConfig = useStockFlowStore(s => s.perfumeTypesConfig);

  const isPerfumeCategory = (catId?: string) => {
    if (!catId) return true;
    const vg = getVariantGroupForCategory(catId, categoriesConfig, variantGroupsConfig);
    if (vg && vg.id === 'perfumes') return true;
    const group = categoriesConfig.find(g => g.opciones && g.opciones.includes(catId));
    if (group) {
      if (group.variantGroupId === 'perfumes') return true;
      if (group.grupo.toLowerCase().includes('perfum')) return true;
    }
    const lower = catId.toLowerCase();
    return lower.includes('perfum') || lower.includes('splash') || lower.includes('mist') || lower.includes('decant') || lower === 'unisex';
  };

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
      p.categoryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.targetGender && p.targetGender.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (!matchesSearch) return false;

    const grupo = getGrupoByCategory(p.categoryId);
    const matchesMain = selectedMainCategory === 'Todo' || grupo === selectedMainCategory;
    
    // Filtrado de subcategoría respetando género
    let matchesSub = false;
    if (selectedSubCategory === 'Todo') {
      matchesSub = true;
    } else if (selectedSubCategory === 'Perfumes de Mujer') {
      const isWomanOrUnisex = p.targetGender === 'Mujer' || p.targetGender === 'Unisex' || (!p.targetGender && p.categoryId === 'Perfumes de Mujer');
      matchesSub = isWomanOrUnisex && p.targetGender !== 'Hombre';
    } else if (selectedSubCategory === 'Perfumes de Hombre') {
      const isManOrUnisex = p.targetGender === 'Hombre' || p.targetGender === 'Unisex' || (!p.targetGender && p.categoryId === 'Perfumes de Hombre');
      matchesSub = isManOrUnisex && p.targetGender !== 'Mujer';
    } else if (selectedSubCategory === 'Unisex') {
      matchesSub = p.targetGender === 'Unisex' || p.categoryId === 'Unisex';
    } else {
      matchesSub = p.categoryId === selectedSubCategory;
    }

    return matchesMain && matchesSub;
  });

  const mainCategories = ['Todo', ...categoriesConfig.map(c => c.grupo)];
  const subCategories = selectedMainCategory === 'Todo' 
      ? ['Todo'] 
      : ['Todo', ...(categoriesConfig.find(c => c.grupo === selectedMainCategory)?.opciones || [])];

  const handleEditClick = (p: Product) => {
      setEditingProduct(p);
      const formCopy = JSON.parse(JSON.stringify(p));

      const vg = getVariantGroupForCategory(p.categoryId, categoriesConfig, variantGroupsConfig);

      if (formCopy.variants && Array.isArray(formCopy.variants)) {
        formCopy.variants = formCopy.variants.map((v: any) => {
          let sIdx = v.sizeIndex;
          if ((sIdx === undefined || sIdx === -1 || (vg && !vg.options[sIdx])) && vg) {
            const foundIdx = vg.options.findIndex(o => 
              v.size && (v.size === o.value || v.size.startsWith(o.value) || (o.description && v.size.includes(o.description)))
            );
            sIdx = foundIdx >= 0 ? foundIdx : 0;
          }
          return {
            ...v,
            sizeIndex: sIdx !== undefined && sIdx >= 0 ? sIdx : 0,
            size: v.size || (vg?.options[sIdx || 0]?.value ?? '100ml'),
            description: v.description !== undefined ? v.description : (v.color || ''),
            color: v.color !== undefined ? v.color : (v.description || ''),
            stock: v.stock !== undefined ? v.stock : 0,
            unitPurchasePrice: v.unitPurchasePrice !== undefined ? v.unitPurchasePrice : (p.purchasePrice || 0),
            manualSalePrice: v.manualSalePrice !== undefined ? v.manualSalePrice : (p.salePrice || 0),
            autoCalculated: false,
          };
        });
      } else {
        formCopy.variants = [{
          id: 'v-' + Math.random().toString(36).substr(2, 9),
          size: vg && vg.options[0] ? vg.options[0].value : '100ml',
          sizeIndex: 0,
          description: '',
          color: '',
          stock: 1,
          unitPurchasePrice: p.purchasePrice || 0,
          manualSalePrice: p.salePrice || 0,
          autoCalculated: false
        }];
      }

      formCopy._showDetails = Boolean(p.description || p.showTag || p.showFeatures);
      formCopy.tag = p.tag || 'Alta Demanda';
      formCopy.showTag = Boolean(p.showTag);
      formCopy.showFeatures = Boolean(p.showFeatures);

      setEditForm(formCopy);
  };

  const handleVariantChange = (vIdx: number, field: string, value: any) => {
      setEditForm((prev: any) => {
          const newForm = { ...prev };
          const variant = { ...newForm.variants[vIdx] };
          variant[field] = value;
          
          if (field === 'sizeIndex') {
              const vg = getVariantGroupForCategory(newForm.categoryId, categoriesConfig, variantGroupsConfig);
              if (vg && vg.options[value]) {
                  const opt = vg.options[value];
                  variant.size = opt.description ? `${opt.value} - ${opt.description}` : opt.value;
              }
          }
          if (field === 'description') {
              variant.color = value;
          }
          if (field === 'color') {
              variant.description = value;
          }
          if (field === 'unitPurchasePrice' && (variant.autoCalculated !== false)) {
              variant.manualSalePrice = Number((Number(value) * (1 + (globalMarkupPrc / 100))).toFixed(2));
          }
          if (field === 'manualSalePrice') {
              variant.autoCalculated = false;
          }
          newForm.variants[vIdx] = variant;
          return newForm;
      });
  };

  const removeVariant = (vIdx: number) => {
      setEditForm((prev: any) => {
          const newForm = { ...prev };
          if (newForm.variants.length > 1) {
              newForm.variants = newForm.variants.filter((_: any, idx: number) => idx !== vIdx);
          }
          return newForm;
      });
  };

  const addVariant = () => {
      setEditForm((prev: any) => {
          const newForm = { ...prev };
          const vg = getVariantGroupForCategory(newForm.categoryId, categoriesConfig, variantGroupsConfig);
          const defaultOpt = vg && vg.options[0];
          const defaultSize = defaultOpt ? (defaultOpt.description ? `${defaultOpt.value} - ${defaultOpt.description}` : defaultOpt.value) : '100ml';

          newForm.variants = [
              ...prev.variants,
              {
                  id: 'v-' + Math.random().toString(36).substr(2, 9),
                  size: defaultSize,
                  sizeIndex: 0,
                  description: '',
                  color: '',
                  stock: 1, 
                  unitPurchasePrice: Number(newForm.purchasePrice) || 0,
                  manualSalePrice: Number(newForm.salePrice) || 0, 
                  autoCalculated: true
              }
          ];
          return newForm;
      });
  };
  
  /** Formatea las variantes del formulario de edición a formato guardable */
  const buildFormattedVariants = (form: any) => {
    const variantGroup = getVariantGroupForCategory(form.categoryId, categoriesConfig, variantGroupsConfig);
    return form.variants.map((item: any) => {
      let finalSize = item.size;
      if (variantGroup && item.sizeIndex !== undefined && variantGroup.options[item.sizeIndex]) {
        const row = variantGroup.options[item.sizeIndex];
        finalSize = row.description ? `${row.value} - ${row.description}` : row.value;
      }
      const desc = item.description || item.color || '';
      const unitCost = (item.unitPurchasePrice !== undefined && item.unitPurchasePrice !== '') ? Number(item.unitPurchasePrice) : (Number(form.purchasePrice) || 0);
      const salePr = (item.manualSalePrice !== undefined && item.manualSalePrice !== '') ? Number(item.manualSalePrice) : (Number(form.salePrice) || 0);
      return {
        id: item.id || ('v-' + Math.random().toString(36).substr(2, 9)),
        size: finalSize || 'Único',
        color: desc,
        description: desc,
        unitPurchasePrice: unitCost,
        manualSalePrice: salePr,
        stock: Math.max(0, Number(item.stock) || 0)
      };
    });
  };

  /** Ejecuta el guardado final (sin fusión) */
  const persistProductUpdate = (id: string, form: any, formattedVariants: any[]) => {
    const oldProduct = products.find(p => p.id === id);
    const oldName = oldProduct?.name || '';
    const newName = (form.name || '').trim();
    const nameChanged = newName && newName.toLowerCase() !== oldName.toLowerCase();

    const validSalePrices = formattedVariants.map((v: any) => v.manualSalePrice).filter((pr: number) => pr > 0);
    const computedSalePrice = validSalePrices.length > 0 ? Math.min(...validSalePrices) : (Number(form.salePrice) || 0);
    const validPurchasePrices = formattedVariants.map((v: any) => v.unitPurchasePrice).filter((pr: number) => pr > 0);
    const computedPurchasePrice = validPurchasePrices.length > 0 ? Math.min(...validPurchasePrices) : (Number(form.purchasePrice) || 0);

    updateProduct(id, {
      name: form.name,
      sku: form.sku,
      perfumeType: form.perfumeType || '',
      categoryId: form.categoryId,
      targetGender: form.targetGender,
      purchasePrice: computedPurchasePrice,
      salePrice: computedSalePrice,
      imageUrls: form.imageUrls || [],
      description: form.description || '',
      tag: form.tag || 'Alta Demanda',
      showTag: Boolean(form.showTag),
      olfactoryNotes: form.olfactoryNotes || '',
      duration: form.duration || '',
      intensity: form.intensity || '',
      family: form.family || '',
      showFeatures: Boolean(form.showFeatures),
    }, formattedVariants);

    // Si el nombre cambió, actualizar en la BD (purchase_batch_items, order_items, catalog)
    if (nameChanged) {
      fetch(`/api/admin/products/${encodeURIComponent(id)}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      }).catch(e => console.error('[ProductosView] Error actualizando nombre en BD:', e));
    }

    try {
      const currentState = useStockFlowStore.getState();
      fetch('/api/store/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: currentState.products,
          categoriesConfig: currentState.categoriesConfig,
          variantGroupsConfig: currentState.variantGroupsConfig,
          perfumeTypesConfig: currentState.perfumeTypesConfig,
          purchases: currentState.purchases,
          sales: currentState.sales,
          globalMarkupPrc: currentState.globalMarkupPrc,
          wholesaleConfig: currentState.wholesaleConfig,
        }),
      }).catch(e => console.error('Error sincronizando DB al editar producto:', e));
    } catch {}
  };

  const handleSaveEdit = () => {
    if (!editingProduct || !editForm) return;

    const newName = (editForm.name || '').trim();
    const formattedVariants = buildFormattedVariants(editForm);

    // Detectar si el nuevo nombre coincide con OTRO producto existente (no el mismo)
    const conflictProduct = products.find(
      p => p.id !== editingProduct.id &&
           p.name.trim().toLowerCase() === newName.toLowerCase()
    );

    if (conflictProduct) {
      // Clasificar variantes por tamaño para encontrar conflictos
      const normSize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

      const conflicts: MergeVariantDecision[] = [];
      const onlyInSource: any[] = [];
      const onlyInTarget: any[] = [];

      // Variantes del producto existente (target)
      const targetVariants = conflictProduct.variants || [];

      formattedVariants.forEach(sv => {
        const match = targetVariants.find(
          (tv: any) => normSize(tv.size) === normSize(sv.size)
        );
        if (match) {
          conflicts.push({
            size: sv.size,
            priceChoice: 'target', // por defecto mantener el precio existente
            sourceSalePrice: sv.manualSalePrice,
            targetSalePrice: match.manualSalePrice || conflictProduct.salePrice || 0,
            sourcePurchasePrice: sv.unitPurchasePrice,
            targetPurchasePrice: match.unitPurchasePrice || conflictProduct.purchasePrice || 0,
            sourceStock: sv.stock,
            targetStock: match.stock || 0,
            mergedStock: sv.stock + (match.stock || 0),
          });
        } else {
          onlyInSource.push(sv);
        }
      });

      targetVariants.forEach((tv: any) => {
        const match = formattedVariants.find(
          sv => normSize(sv.size) === normSize(tv.size)
        );
        if (!match) {
          onlyInTarget.push(tv);
        }
      });

      setMergeState({
        targetProduct: conflictProduct,
        sourceVariants: formattedVariants,
        conflicts,
        onlyInSource,
        onlyInTarget,
      });
      return; // Pausar guardado — esperar decisión del usuario
    }

    // Sin conflicto: guardar normalmente
    persistProductUpdate(editingProduct.id, editForm, formattedVariants);
    showAlert('Producto y finanzas actualizados con éxito.');
    setEditingProduct(null);
    setEditForm(null);
  };

  /** Ejecuta la fusión final con las decisiones del usuario */
  const executeMerge = () => {
    if (!mergeState || !editingProduct || !editForm) return;
    const { targetProduct, conflicts, onlyInSource, onlyInTarget } = mergeState;

    // Construir variantes fusionadas para el producto TARGET (que sobrevive)
    const mergedVariants: any[] = [
      // Variantes en conflicto: usar precio elegido + stock sumado
      ...conflicts.map(c => {
        const useSource = c.priceChoice === 'source';
        // Encontrar la variante original del target para preservar su id
        const origTarget = (targetProduct.variants || []).find(
          (tv: any) => tv.size.toLowerCase().trim() === c.size.toLowerCase().trim()
        );
        return {
          id: origTarget?.id || ('v-' + Math.random().toString(36).substr(2, 9)),
          size: c.size,
          color: origTarget?.color || '',
          description: origTarget?.description || '',
          unitPurchasePrice: useSource ? c.sourcePurchasePrice : c.targetPurchasePrice,
          manualSalePrice: useSource ? c.sourceSalePrice : c.targetSalePrice,
          stock: c.mergedStock,
        };
      }),
      // Variantes solo en el producto que editamos → se agregan al target
      ...onlyInSource.map(sv => ({ ...sv, id: 'v-' + Math.random().toString(36).substr(2, 9) })),
      // Variantes solo en el target → se mantienen
      ...onlyInTarget,
    ];

    // Actualizar el producto TARGET con las variantes fusionadas y el nuevo nombre (ya lo tiene)
    persistProductUpdate(targetProduct.id, {
      ...targetProduct,
      // Tomar imágenes de ambos (sin duplicados)
      imageUrls: [...new Set([
        ...(targetProduct.imageUrls || []),
        ...(editForm.imageUrls || []),
      ])],
      description: editForm.description || targetProduct.description || '',
    }, mergedVariants);

    // Eliminar el producto que estábamos editando (quedó fusionado en el target)
    deleteProduct(editingProduct.id);

    // Actualizar nombre en la BD para los items del producto eliminado (apuntarlos al target)
    // Los items del producto eliminado quedan con el id del target tras la fusión
    fetch(`/api/admin/products/${encodeURIComponent(editingProduct.id)}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: targetProduct.name }),
    }).catch(e => console.error('[Merge] Error actualizando nombre en BD:', e));

    // Sincronizar tras el delete
    setTimeout(() => {
      try {
        const currentState = useStockFlowStore.getState();
        fetch('/api/store/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: currentState.products,
            categoriesConfig: currentState.categoriesConfig,
            variantGroupsConfig: currentState.variantGroupsConfig,
            perfumeTypesConfig: currentState.perfumeTypesConfig,
            purchases: currentState.purchases,
            sales: currentState.sales,
            globalMarkupPrc: currentState.globalMarkupPrc,
            wholesaleConfig: currentState.wholesaleConfig,
          }),
        }).catch(e => console.error('Error sincronizando DB tras fusión:', e));
      } catch {}
    }, 300);

    showAlert(`✅ Productos fusionados correctamente en "${targetProduct.name}".`);
    setMergeState(null);
    setEditingProduct(null);
    setEditForm(null);
  };

  const executeDelete = () => {
      if(confirmDeleteId) {
          deleteProduct(confirmDeleteId);
          try {
            const currentState = useStockFlowStore.getState();
            fetch('/api/store/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: currentState.products,
                categoriesConfig: currentState.categoriesConfig,
                variantGroupsConfig: currentState.variantGroupsConfig,
                perfumeTypesConfig: currentState.perfumeTypesConfig,
                purchases: currentState.purchases,
                sales: currentState.sales,
                globalMarkupPrc: currentState.globalMarkupPrc,
                wholesaleConfig: currentState.wholesaleConfig,
              }),
            }).catch(e => console.error('Error sincronizando DB al eliminar producto:', e));
          } catch {}
          showAlert('✅ Producto dado de baja del inventario. El costo de compra permanece registrado como pérdida contable.');
          setConfirmDeleteId(null);
          setDeleteStep(1);
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
                  placeholder="Buscar Nombre o Subcategoría"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
                />
            </div>
            <button
              onClick={handleRepairNames}
              disabled={loadingRepair}
              title="Actualiza los nombres de todos los productos en el historial de compras"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${loadingRepair ? 'animate-spin' : ''}`}>
                {loadingRepair ? 'progress_activity' : 'sync'}
              </span>
              {loadingRepair ? 'Reparando...' : 'Reparar nombres'}
            </button>
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
          <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-xl mx-auto my-8">
              <span className="material-symbols-outlined text-6xl text-slate-300">
                {products.length === 0 ? 'inventory_2' : 'search_off'}
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-bold text-base mt-3">
                {products.length === 0 ? 'Tu inventario está vacío' : 'No se encontraron productos con estos filtros.'}
              </p>
              {products.length === 0 && (
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Detectamos el lote de compra de <strong>Serena.G CDE (24 productos)</strong> registrado en el sistema. Podés cargarlos a tu catálogo directamente con este botón:
                  </p>
                  <button
                    onClick={handleSyncFromBatch}
                    disabled={loadingSync}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-sm shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">{loadingSync ? 'sync' : 'cloud_download'}</span>
                    {loadingSync ? 'Cargando productos...' : 'Cargar 24 Productos desde Lote de Compra'}
                  </button>
                </div>
              )}
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
                                 <div className="flex items-center gap-1.5 mb-1 mr-auto flex-wrap">
                                     <span className="text-[10px] font-black text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                                         {p.categoryId}
                                     </span>
                                     {p.targetGender && (
                                         <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                             p.targetGender === 'Unisex'
                                                 ? 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800'
                                                 : p.targetGender === 'Hombre'
                                                 ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
                                                 : 'text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/60 border-pink-200 dark:border-pink-800'
                                         }`}>
                                             {p.targetGender}
                                         </span>
                                     )}
                                     {p.perfumeType && (
                                         <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                                             {p.perfumeType}
                                         </span>
                                     )}
                                 </div>
                                 <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight pr-14 mt-1 mb-3">{p.name}</h4>
                                 
                                 {(() => {
                                     const variantSalePrices = p.variants?.map(v => v.manualSalePrice).filter((pr): pr is number => pr !== undefined && pr > 0) || [];
                                     const minSale = variantSalePrices.length > 0 ? Math.min(...variantSalePrices) : p.salePrice;
                                     const maxSale = variantSalePrices.length > 0 ? Math.max(...variantSalePrices) : p.salePrice;
                                     const salePriceDisplay = variantSalePrices.length > 1 && minSale !== maxSale 
                                         ? `$${minSale.toLocaleString("es-AR")} - $${maxSale.toLocaleString("es-AR")}`
                                         : `$${(p.salePrice || minSale || 0).toLocaleString("es-AR")}`;

                                     const variantPurchasePrices = p.variants?.map(v => v.unitPurchasePrice).filter((pr): pr is number => pr !== undefined && pr > 0) || [];
                                     const minPurch = variantPurchasePrices.length > 0 ? Math.min(...variantPurchasePrices) : p.purchasePrice;
                                     const maxPurch = variantPurchasePrices.length > 0 ? Math.max(...variantPurchasePrices) : p.purchasePrice;
                                     const purchasePriceDisplay = variantPurchasePrices.length > 1 && minPurch !== maxPurch
                                         ? `$${minPurch.toLocaleString("es-AR")} - $${maxPurch.toLocaleString("es-AR")}`
                                         : `$${(p.purchasePrice || minPurch || 0).toLocaleString("es-AR")}`;

                                     return (
                                         <div className="flex gap-4">
                                              <div>
                                                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">P. Compra</p>
                                                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{purchasePriceDisplay}</p>
                                              </div>
                                              <div>
                                                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">P. Venta</p>
                                                  <p className="text-sm font-black text-slate-900 dark:text-white">{salePriceDisplay}</p>
                                              </div>
                                         </div>
                                     );
                                 })()}
                                 
                                 <div className="mt-auto pt-4 flex flex-col">
                                     <div className="flex items-center justify-between mb-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                                         <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stock / Variantes</p>
                                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${totalStock > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>{totalStock > 0 ? `${totalStock} Disp.` : "Agotado"}</span>
                                     </div>
                                     <div className="flex flex-wrap gap-2">
                                         {p.variants.map(v => (
                                             <div key={v.id} className="flex flex-col flex-1 min-w-[70px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center">
                                                 <div className="flex flex-col justify-center items-center mb-1">
                                                     {(v as any).description && (
                                                         <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]" title={(v as any).description}>{(v as any).description}</span>
                                                     )}
                                                     <span 
                                                         className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-help"
                                                         title={(v.size.includes("MER:") || v.size.includes("ARG:") || v.size.includes("INT:")) ? v.size : undefined}
                                                     >
                                                         {v.size.includes("MER:") ? v.size.split(" ")[0].replace("MER:", "T:") : 
                                                          v.size.includes("ARG:") ? v.size.split(" ")[0].replace("ARG:", "T:") : 
                                                          v.size.includes("INT:") ? v.size.split(" ")[0].replace("INT:", "T:") : v.size}
                                                     </span>
                                                 </div>
                                                 <div className="flex items-center justify-between text-[11px] font-bold mt-0.5">
                                                     <span className="text-[10px] text-slate-400 font-medium">Stock:</span>
                                                     <span className={v.stock > 0 ? "text-primary" : "text-red-500"}>{v.stock}</span>
                                                 </div>
                                                 <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                                                     <span className="text-[9px] text-slate-400 font-bold uppercase">PV:</span>
                                                     <span className="font-extrabold text-green-600 dark:text-green-400">
                                                         ${((v.manualSalePrice !== undefined && v.manualSalePrice > 0) ? v.manualSalePrice : (p.salePrice || 0)).toLocaleString("es-AR")}
                                                     </span>
                                                 </div>
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

      {/* ── Modal de Fusión de Productos ─────────────────────────────────────── */}
      {mergeState && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-w-2xl w-full my-8 animate-in zoom-in-95 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="size-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center border border-violet-500/20 flex-shrink-0">
                <span className="material-symbols-outlined text-2xl">merge</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Fusionar Productos</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ya existe un producto con el nombre <strong className="text-violet-600 dark:text-violet-400">"{mergeState.targetProduct.name}"</strong>. Definí cómo fusionarlos.
                </p>
              </div>
            </div>

            {/* Info de ambos productos */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">edit</span> Producto Editado (nuevo)
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{editForm?.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{(mergeState.sourceVariants || []).length} variante(s) · {(mergeState.sourceVariants || []).reduce((a: number, v: any) => a + (v.stock || 0), 0)} uds</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">inventory_2</span> Producto Existente
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{mergeState.targetProduct.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{(mergeState.targetProduct.variants || []).length} variante(s) · {(mergeState.targetProduct.variants || []).reduce((a: number, v: any) => a + (v.stock || 0), 0)} uds</p>
              </div>
            </div>

            {/* Variantes sin conflicto */}
            {(mergeState.onlyInSource.length > 0 || mergeState.onlyInTarget.length > 0) && (
              <div className="mb-5 space-y-2">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Variantes sin conflicto (se agregan automáticamente)</p>
                <div className="flex flex-wrap gap-2">
                  {mergeState.onlyInSource.map((v, i) => (
                    <span key={'s' + i} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px]">add</span> {v.size} · {v.stock} uds · ${v.manualSalePrice?.toLocaleString('es-AR')}
                    </span>
                  ))}
                  {mergeState.onlyInTarget.map((v, i) => (
                    <span key={'t' + i} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px]">keep</span> {v.size} · {v.stock} uds · ${(v.manualSalePrice || 0)?.toLocaleString('es-AR')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Variantes en conflicto (mismo tamaño) */}
            {mergeState.conflicts.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Variantes con el mismo tamaño — elegí qué precio conservar</p>
                <div className="space-y-3">
                  {mergeState.conflicts.map((conflict, cIdx) => (
                    <div key={cIdx} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-amber-500 text-[16px]">warning</span>
                          Tamaño: <span className="text-amber-700 dark:text-amber-400">{conflict.size}</span>
                        </p>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          Stock: {conflict.sourceStock} + {conflict.targetStock} = <strong className="text-primary">{conflict.mergedStock} uds</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">¿Cuál precio de venta querés mantener?</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMergeState(prev => {
                            if (!prev) return prev;
                            const newConflicts = [...prev.conflicts];
                            newConflicts[cIdx] = { ...newConflicts[cIdx], priceChoice: 'source' };
                            return { ...prev, conflicts: newConflicts };
                          })}
                          className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                            conflict.priceChoice === 'source'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60'
                              : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mb-1">Precio Nuevo</span>
                          <span className="text-base font-black text-slate-900 dark:text-white">${conflict.sourceSalePrice.toLocaleString('es-AR')}</span>
                          <span className="text-[10px] text-slate-500">Costo: ${conflict.sourcePurchasePrice.toLocaleString('es-AR')}</span>
                          {conflict.priceChoice === 'source' && (
                            <span className="material-symbols-outlined text-blue-500 text-sm mt-1">check_circle</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMergeState(prev => {
                            if (!prev) return prev;
                            const newConflicts = [...prev.conflicts];
                            newConflicts[cIdx] = { ...newConflicts[cIdx], priceChoice: 'target' };
                            return { ...prev, conflicts: newConflicts };
                          })}
                          className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                            conflict.priceChoice === 'target'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60'
                              : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Precio Existente</span>
                          <span className="text-base font-black text-slate-900 dark:text-white">${conflict.targetSalePrice.toLocaleString('es-AR')}</span>
                          <span className="text-[10px] text-slate-500">Costo: ${conflict.targetPurchasePrice.toLocaleString('es-AR')}</span>
                          {conflict.priceChoice === 'target' && (
                            <span className="material-symbols-outlined text-emerald-500 text-sm mt-1">check_circle</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resultado resumen */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-5">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Resultado de la fusión</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                El producto <strong className="text-slate-900 dark:text-white">"{mergeState.targetProduct.name}"</strong> quedará con
                {' '}<strong className="text-primary">
                  {mergeState.conflicts.length + mergeState.onlyInSource.length + mergeState.onlyInTarget.length} variante(s)
                </strong>
                {' '}y un stock total de
                {' '}<strong className="text-primary">
                  {[
                    ...mergeState.conflicts.map(c => c.mergedStock),
                    ...mergeState.onlyInSource.map((v: any) => v.stock || 0),
                    ...mergeState.onlyInTarget.map((v: any) => v.stock || 0),
                  ].reduce((a, b) => a + b, 0)} unidades
                </strong>. El producto editado será eliminado.
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setMergeState(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeMerge}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">merge</span>
                Confirmar Fusión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (2 Pasos: Aviso de Pérdida + Confirmación Definitiva) */}
      {confirmDeleteId && (() => {
        const prod = products.find(p => p.id === confirmDeleteId);
        const totalUnits = prod?.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                  {deleteStep === 1 ? (
                    <>
                      <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                          <span className="material-symbols-outlined text-3xl">trending_down</span>
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full mx-auto block w-fit mb-2">
                          Paso 1 de 2: Aviso de Pérdida Contable
                      </span>
                      <h3 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">
                          Se registrará como PÉRDIDA
                      </h3>
                      
                      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 mb-4 text-xs space-y-1.5">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            📦 {prod?.name || 'Producto seleccionado'}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            Stock en inventario: <strong className="text-slate-700 dark:text-slate-300">{totalUnits} unidades</strong>
                          </p>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6 bg-amber-500/5 border border-amber-500/15 p-3.5 rounded-xl text-center">
                          Este producto proviene de una compra registrada. Al eliminarlo, se retirará del inventario y <strong>el costo de compra no se borrará: se computará como una PÉRDIDA en Finanzas</strong> por mercadería dada de baja o descartada.
                      </p>

                      <div className="flex gap-3">
                          <button 
                              onClick={() => { setConfirmDeleteId(null); setDeleteStep(1); }} 
                              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={() => setDeleteStep(2)} 
                              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                          >
                              <span>Comprendo, continuar</span>
                              <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="size-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                          <span className="material-symbols-outlined text-3xl">delete_forever</span>
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-1 rounded-full mx-auto block w-fit mb-2">
                          Paso 2 de 2: Confirmación Definitiva
                      </span>
                      <h3 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">
                          ¿Confirmar eliminación definitiva?
                      </h3>
                      
                      <p className="text-center text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                          ¿Estás totalmente seguro de dar de baja y eliminar <strong className="text-slate-900 dark:text-white block mt-1.5 font-bold">"{prod?.name}"</strong>? Esta acción no se puede deshacer.
                      </p>

                      <div className="flex gap-3">
                          <button 
                              onClick={() => setDeleteStep(1)} 
                              className="py-3 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                          >
                              <span className="material-symbols-outlined text-sm">arrow_back</span>
                              <span>Atrás</span>
                          </button>
                          <button 
                              onClick={executeDelete} 
                              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                          >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              <span>Sí, Eliminar Producto</span>
                          </button>
                      </div>
                    </>
                  )}
              </div>
          </div>
        );
      })()}

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
                    {/* 1. Producto Padre */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">1. Producto Padre</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" 
                                value={editForm.categoryId} 
                                onChange={e => {
                                    const cat = e.target.value;
                                    setEditForm((prev: any) => ({ ...prev, categoryId: cat }));
                                }}
                            >
                                {categoriesConfig.map(g => (
                                    <optgroup key={g.grupo} label={g.grupo}>
                                        {g.opciones.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </optgroup>
                                ))}
                                {!categoriesConfig.some(g => g.opciones && g.opciones.includes(editForm.categoryId)) && (
                                    <option value={editForm.categoryId}>{editForm.categoryId}</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Público / Género</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" 
                                value={editForm.targetGender || 'Unisex'} 
                                onChange={e => {
                                    const val = e.target.value;
                                    setEditForm((prev: any) => ({ ...prev, targetGender: val }));
                                }}
                            >
                                <option value="Unisex">Unisex</option>
                                <option value="Mujer">Mujer</option>
                                <option value="Hombre">Hombre</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={isPerfumeCategory(editForm.categoryId) ? '' : 'col-span-1 md:col-span-2'}>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Producto</label>
                            <input type="text" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" value={editForm.name} onChange={e => setEditForm((prev:any) => ({...prev, name: e.target.value}))} />
                        </div>
                        {isPerfumeCategory(editForm.categoryId) && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Perfume (Opcional)</label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all" 
                                    value={editForm.perfumeType || ''} 
                                    onChange={e => setEditForm((prev: any) => ({ ...prev, perfumeType: e.target.value }))}
                                >
                                    <option value="">Sin tipo (Ninguno / Opcional)</option>
                                    {(perfumeTypesConfig && perfumeTypesConfig.length > 0 ? perfumeTypesConfig : DEFAULT_PERFUME_TYPES).map(pt => (
                                        <option key={pt.value} value={pt.value}>
                                            {pt.value}{pt.description ? ` (${pt.description})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {/* SKU oculto según solicitud */}
                        <input type="hidden" value={editForm.sku || ''} />
                    </div>

                    {/* Images */}
                    <div className="flex flex-col gap-2">
                        <label className="block text-xs font-bold text-slate-500">Imágenes del Producto</label>
                        <div className="flex items-center gap-3 w-full border border-slate-200 dark:border-slate-700/60 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                            {/* Upload new */}
                            <label className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-colors text-xs font-bold whitespace-nowrap ${isUploading
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-600 cursor-wait'
                                : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer'
                                }`}>
                                <span className="material-symbols-outlined text-[16px]">{isUploading ? 'sync' : 'add_photo_alternate'}</span>
                                {isUploading ? 'Subiendo...' : 'Subir'}
                                <input
                                    type="file" accept="image/*" multiple disabled={isUploading} className="hidden"
                                    onChange={async e => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length === 0) return;
                                        const token = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
                                        if (!token) { showAlert('Falta sesión de administrador. Por favor recargá la página.'); return; }

                                        setIsUploading(true);
                                        const uploadedUrls: string[] = [];
                                        const uploadEndpoint = apiUrl
                                            ? `${apiUrl}/api/admin/product-image?subcategory=${encodeURIComponent(editForm.categoryId || 'General')}`
                                            : `/api/admin/product-image?subcategory=${encodeURIComponent(editForm.categoryId || 'General')}`;

                                        try {
                                            for (const file of files) {
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                try {
                                                    const res = await fetch(uploadEndpoint, {
                                                        method: 'POST',
                                                        headers: {
                                                            'X-API-KEY': token,
                                                            'Authorization': `Bearer ${token}`
                                                        },
                                                        body: formData
                                                    });
                                                    if (res.ok) {
                                                        const data = await res.json();
                                                        uploadedUrls.push(data.url);
                                                        setMediaLibImages(prev => [data.url, ...prev]); // refresh lib cache
                                                    } else {
                                                        const errData = await res.json().catch(() => ({}));
                                                        showAlert(`Error al subir ${file.name}: ${errData.detail || res.statusText}`);
                                                    }
                                                } catch (err: any) {
                                                    showAlert(`Error al subir ${file.name}: ${err.message || 'Error de red'}`);
                                                }
                                            }

                                            if (uploadedUrls.length > 0) {
                                                setEditForm((prev: any) => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ...uploadedUrls] }));
                                            }
                                        } finally {
                                            setIsUploading(false);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>

                            {/* Pick from library */}
                            <button
                                type="button"
                                onClick={() => openMediaLib()}
                                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold whitespace-nowrap transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">photo_library</span>
                                Biblioteca
                            </button>

                            <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 py-0.5">
                                {(editForm.imageUrls || []).map((imgUrl: string, imgIdx: number) => {
                                    const fullImgSrc = imgUrl.startsWith('http') ? imgUrl : (apiUrl ? `${apiUrl}${imgUrl}` : imgUrl);
                                    return (
                                        <div
                                            key={imgIdx}
                                            title="Clic sobre la imagen para abrir biblioteca"
                                            className="size-9 rounded-lg flex-shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden relative group/img cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:scale-105 transition-all shadow-sm"
                                            onClick={() => openMediaLib()}
                                        >
                                            <img src={fullImgSrc} alt="" className="w-full h-full object-cover" />
                                            
                                            <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <span className="material-symbols-outlined text-white text-[14px]">photo_library</span>
                                            </div>

                                            <button
                                                type="button"
                                                title="Eliminar imagen"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const arr = [...(editForm.imageUrls || [])];
                                                    arr.splice(imgIdx, 1);
                                                    setEditForm((prev: any) => ({ ...prev, imageUrls: arr }));
                                                }}
                                                className="absolute top-0 right-0 size-4 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-bl z-10"
                                            >
                                                <span className="material-symbols-outlined text-[11px] font-bold">close</span>
                                            </button>
                                        </div>
                                    );
                                })}
                                {!(editForm.imageUrls || []).length && (
                                    <button
                                        type="button"
                                        onClick={() => openMediaLib()}
                                        className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 italic self-center cursor-pointer transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20"
                                        title="Hacer clic para buscar y elegir de la biblioteca"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">photo_library</span>
                                        Sin fotos aún (clic para buscar en biblioteca)
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Media Library Picker ── */}
                        {showMediaLib && (
                            <div className="border border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-900/40 border-b border-indigo-100 dark:border-indigo-800">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-indigo-500 text-[18px]">photo_library</span>
                                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Biblioteca de Imágenes</span>
                                        {mediaLibImages.length > 0 && (
                                            <span className="text-xs text-indigo-400 font-medium">({mediaLibImages.length} imágenes)</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openMediaLib(true)}
                                            title="Recargar"
                                            className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowMediaLib(false)}
                                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                                        <input
                                            type="text"
                                            value={mediaLibSearch}
                                            onChange={e => setMediaLibSearch(e.target.value)}
                                            placeholder="Buscar por nombre..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    </div>
                                </div>

                                {/* Grid */}
                                <div className="p-3 max-h-64 overflow-y-auto">
                                    {mediaLibLoading ? (
                                        <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                            <span className="text-sm">Cargando imágenes...</span>
                                        </div>
                                    ) : mediaLibImages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                                            <span className="material-symbols-outlined text-4xl">image_not_supported</span>
                                            <span className="text-sm">No hay imágenes en la biblioteca</span>
                                        </div>
                                    ) : (() => {
                                        const filtered = mediaLibSearch.trim()
                                            ? mediaLibImages.filter(u => u.toLowerCase().includes(mediaLibSearch.toLowerCase()))
                                            : mediaLibImages;
                                        return filtered.length === 0 ? (
                                            <div className="text-center py-6 text-xs text-slate-400">Sin resultados para "{mediaLibSearch}"</div>
                                        ) : (
                                            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                                                {filtered.map((url, i) => {
                                                    const fullUrl = url.startsWith('http') ? url : (apiUrl ? `${apiUrl}${url}` : url);
                                                    const alreadyAdded = (editForm.imageUrls || []).includes(url);
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            title={url.split('/').pop()}
                                                            onClick={() => {
                                                                if (!alreadyAdded) {
                                                                    setEditForm((prev: any) => ({ ...prev, imageUrls: [...(prev.imageUrls || []), url] }));
                                                                }
                                                            }}
                                                            className={`relative group/lib aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                                                alreadyAdded
                                                                    ? 'border-indigo-400 ring-2 ring-indigo-300 opacity-70 cursor-default'
                                                                    : 'border-transparent hover:border-indigo-400 cursor-pointer hover:scale-105'
                                                            }`}
                                                        >
                                                            <img src={fullUrl} alt="" className="w-full h-full object-cover" />
                                                            {alreadyAdded && (
                                                                <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                                                                    <span className="material-symbols-outlined text-white text-[18px] drop-shadow">check_circle</span>
                                                                </div>
                                                            )}
                                                            {!alreadyAdded && (
                                                                <div className="absolute inset-0 bg-black/0 group-hover/lib:bg-black/20 flex items-center justify-center opacity-0 group-hover/lib:opacity-100 transition-all">
                                                                    <span className="material-symbols-outlined text-white text-[18px] drop-shadow">add_circle</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Footer hint */}
                                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                                    Hacé click en una imagen para agregarla al producto • Las marcadas con ✓ ya están agregadas
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                    {/* 2. Variantes (Ítem Físico) */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">2. Variantes (Ítem Físico)</label>
                        <div className="space-y-2">
                            {editForm.variants.map((variant: any, vIdx: number) => {
                                const vg = getVariantGroupForCategory(editForm.categoryId, categoriesConfig, variantGroupsConfig);
                                return (
                                    <div key={vIdx} className="flex flex-wrap md:flex-nowrap items-end gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                        {vg && (
                                            <div className="flex-1 min-w-[180px]">
                                                <select 
                                                    className="w-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-900 dark:text-purple-300 font-bold h-10 outline-none focus:ring-2 focus:ring-purple-400" 
                                                    value={(() => {
                                                        if (variant.sizeIndex !== undefined && variant.sizeIndex >= 0 && variant.sizeIndex < vg.options.length) {
                                                            return variant.sizeIndex;
                                                        }
                                                        const foundIdx = vg.options.findIndex(o => 
                                                            variant.size && (variant.size === o.value || variant.size.startsWith(o.value) || (o.description && variant.size.includes(o.description)))
                                                        );
                                                        return foundIdx >= 0 ? foundIdx : 0;
                                                    })()} 
                                                    onChange={e => handleVariantChange(vIdx, 'sizeIndex', Number(e.target.value))}
                                                >
                                                    {vg.options.map((row, rIdx) => (
                                                        <option key={rIdx} value={rIdx}>{row.value} {row.description ? `(${row.description})` : ''}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-[130px]">
                                            <input 
                                                type="text" 
                                                placeholder="Descripción (ej: Negro/Rosa)" 
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white h-10 focus:ring-2 focus:ring-primary outline-none" 
                                                value={variant.description || variant.color || ''} 
                                                onChange={e => handleVariantChange(vIdx, 'description', e.target.value)} 
                                            />
                                        </div>
                                        <div className="w-[72px]">
                                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Stock</label>
                                            <input 
                                                type="number" 
                                                step="1" 
                                                placeholder="1" 
                                                className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm text-slate-900 dark:text-white font-bold h-9 text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-primary outline-none" 
                                                value={variant.stock === '' ? '' : variant.stock} 
                                                onChange={e => handleVariantChange(vIdx, 'stock', e.target.value === '' ? '' : Number(e.target.value))} 
                                            />
                                        </div>
                                        <div className="w-[110px]">
                                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Costo Unit.</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="0" 
                                                className="w-full text-center bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/50 rounded-lg px-1 py-1 text-sm text-red-600 font-bold h-9 focus:ring-2 focus:ring-primary outline-none" 
                                                value={variant.unitPurchasePrice === '' ? '' : (variant.unitPurchasePrice !== undefined ? variant.unitPurchasePrice : editForm.purchasePrice)} 
                                                onChange={e => handleVariantChange(vIdx, 'unitPurchasePrice', e.target.value === '' ? '' : Number(e.target.value))} 
                                            />
                                        </div>
                                        <div className="w-[110px]">
                                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none truncate">PV Final</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="0" 
                                                className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm font-black h-9 text-green-600 dark:text-green-400 focus:ring-2 focus:ring-primary outline-none" 
                                                value={variant.manualSalePrice === '' ? '' : (variant.manualSalePrice !== undefined ? variant.manualSalePrice : editForm.salePrice)} 
                                                onChange={e => handleVariantChange(vIdx, 'manualSalePrice', e.target.value === '' ? '' : Number(e.target.value))} 
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeVariant(vIdx)} 
                                            className={`h-9 px-2 rounded-lg transition-colors flex items-center justify-center ${editForm.variants.length > 1 ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-300 opacity-50 cursor-not-allowed'}`} 
                                            disabled={editForm.variants.length <= 1}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <button 
                            type="button" 
                            onClick={addVariant} 
                            className="text-sm font-bold text-primary flex items-center gap-1 hover:bg-primary/10 px-3 py-2 rounded-lg w-max transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span> Añadir Variante
                        </button>
                    </div>

                    {/* 3. Descripción Premium & Atributos (Acordeón colapsable igual a ComprasView) */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <button 
                            type="button" 
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors" 
                            onClick={() => setEditForm((prev: any) => ({ ...prev, _showDetails: !prev._showDetails }))}
                        >
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
                                3. Descripción Premium & Atributos
                                {((editForm.tag && editForm.showTag) || editForm.description || editForm.showFeatures) && (
                                    <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Configurado</span>
                                )}
                            </span>
                            <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${editForm._showDetails ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>

                        {editForm._showDetails && (
                            <div className="p-4 space-y-5 bg-white dark:bg-slate-800/30">
                                {/* Insignia del Producto */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insignia del Producto</label>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => setEditForm((prev: any) => ({ ...prev, showTag: !prev.showTag }))} 
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${editForm.showTag ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${editForm.showTag ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Mostrar insignia en tienda</span>
                                        </div>
                                        {editForm.showTag && (
                                            <select 
                                                className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-medium" 
                                                value={editForm.tag || 'Alta Demanda'} 
                                                onChange={e => setEditForm((prev: any) => ({ ...prev, tag: e.target.value }))}
                                            >
                                                <option>Alta Demanda</option>
                                                <option>Recomendado</option>
                                                <option>Más Vendido</option>
                                                <option>Nuevo</option>
                                                <option>Edición Limitada</option>
                                                <option>Oferta Especial</option>
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Descripción Premium */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción Premium</label>
                                    <textarea 
                                        rows={3} 
                                        placeholder="Ej: Creada con las esencias más puras..." 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-primary outline-none transition-all" 
                                        value={editForm.description || ''} 
                                        onChange={e => setEditForm((prev: any) => ({ ...prev, description: e.target.value }))} 
                                    />
                                </div>

                                {/* Atributos Olfativos */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atributos Olfativos</label>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => setEditForm((prev: any) => ({ ...prev, showFeatures: !prev.showFeatures }))} 
                                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${editForm.showFeatures ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${editForm.showFeatures ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                            <span className="text-xs text-slate-500">{editForm.showFeatures ? 'Visible en tienda' : 'Oculto'}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[
                                            { key: 'olfactoryNotes', label: 'Notas Olfativas', placeholder: 'Ej: Cítricas, Florales', icon: 'air' },
                                            { key: 'duration', label: 'Duración', placeholder: 'Ej: Alta (+8 horas)', icon: 'schedule' },
                                            { key: 'intensity', label: 'Intensidad', placeholder: 'Ej: Moderada - Fuerte', icon: 'auto_awesome' },
                                            { key: 'family', label: 'Familia Olfativa', placeholder: 'Ej: Amaderada Especiada', icon: 'water_drop' },
                                        ].map(({ key, label, placeholder, icon }) => (
                                            <div key={key} className="flex flex-col gap-1">
                                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                                    <span className="material-symbols-outlined text-[13px]">{icon}</span>{label}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    placeholder={placeholder} 
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all" 
                                                    value={(editForm as any)[key] || ''} 
                                                    onChange={e => setEditForm((prev: any) => ({ ...prev, [key]: e.target.value }))} 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
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
