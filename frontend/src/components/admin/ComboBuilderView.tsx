'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useStockFlowStore, BundleComponent, Product, isComboCategoryName, findComboCategoryGroup } from '@/store/useStockStore';

interface ComboBuilderViewProps {
  showAlert: (msg: string) => void;
  apiKey?: string;
  apiUrl?: string;
  onComboCreated?: () => void;
  onCancel?: () => void;
}

const DRAFT_COMBOS_KEY = 'lyg_draft_combo';

export default function ComboBuilderView({
  showAlert,
  apiKey,
  apiUrl,
  onComboCreated,
  onCancel,
}: ComboBuilderViewProps) {
  const products = useStockFlowStore((s) => s.products);
  const categoriesConfig = useStockFlowStore((s) => s.categoriesConfig);
  const wholesaleConfig = useStockFlowStore((s) => s.wholesaleConfig);
  const createBundleProduct = useStockFlowStore((s) => s.createBundleProduct);

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [targetGender, setTargetGender] = useState<'Hombre' | 'Mujer' | 'Unisex'>('Unisex');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('Edición Especial');
  const [showTag, setShowTag] = useState(true);
  const [notForPublicSale, setNotForPublicSale] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Obtener el grupo de categoría de combos existente (cualquiera que comience con la palabra "Combo")
  const comboGroup = useMemo(() => {
    return findComboCategoryGroup(categoriesConfig);
  }, [categoriesConfig]);

  // Sincronizar categoryId con las opciones del grupo de combos existente
  useEffect(() => {
    if (comboGroup) {
      const opts = comboGroup.opciones || [];
      if (opts.length > 0) {
        if (!categoryId || !opts.includes(categoryId)) {
          setCategoryId(opts.includes('Set de Regalos') ? 'Set de Regalos' : opts[0]);
        }
      } else {
        if (!categoryId) setCategoryId(comboGroup.grupo);
      }
    } else {
      if (!categoryId) setCategoryId('Set de Regalos');
    }
  }, [comboGroup, categoryId]);

  // Asegurar que exista una categoría de combos SOLO si ninguna categoría comienza con la palabra "Combo"
  useEffect(() => {
    // Si ya existe alguna categoría cuyo grupo comience con "Combo" (ej. "Combos", "Combo", "Combos & Regalos", "Combo y Set", "Combos y Set de Regalos", etc.), NO crear nada nuevo.
    const hasComboCategory = categoriesConfig.some((g) => isComboCategoryName(g.grupo));
    if (!hasComboCategory) {
      const state = useStockFlowStore.getState();
      const current = JSON.parse(JSON.stringify(state.categoriesConfig));
      if (!current.some((g: any) => isComboCategoryName(g.grupo))) {
        current.push({
          grupo: 'Combos & Regalos',
          variantGroupId: 'none',
          opciones: ['Set de Regalos', 'Ramos de Maquillaje', 'Cajas Sorpresa', 'Sets de Perfumería', 'Combos Especiales'],
        });
        state.setCategoriesConfig(current);
        fetch('/api/store/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...state,
            categoriesConfig: current,
          }),
        }).catch((err) => console.warn('Error sync categories:', err));
      }
    }
  }, [categoriesConfig]);

  // Components state
  const [selectedComponents, setSelectedComponents] = useState<BundleComponent[]>([]);
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [componentQty, setComponentQty] = useState(1);

  // Financials & Stock to assemble
  const [suppliesCost, setSuppliesCost] = useState<number | ''>(0);
  const [retailPrice, setRetailPrice] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [quantityToProduce, setQuantityToProduce] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ═══ DRAFT / BORRADOR COMPARTIDO ═══
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftUpdatedBy, setDraftUpdatedBy] = useState<string | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isSyncingServerDraft, setIsSyncingServerDraft] = useState(false);
  const [showClearComboModal, setShowClearComboModal] = useState(false);

  // Verifica si hay algún dato cargado
  const hasDraftData = Boolean(
    name.trim().length > 0 ||
    selectedComponents.length > 0 ||
    imageUrls.length > 0 ||
    description.trim().length > 0 ||
    (typeof suppliesCost === 'number' && suppliesCost > 0) ||
    (typeof retailPrice === 'number' && retailPrice > 0)
  );

  // Helper para obtener token de autenticación
  const getAuthToken = useCallback(() => {
    return apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
  }, [apiKey]);

  // Consulta el borrador compartido desde el servidor
  const fetchServerDraft = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsSyncingServerDraft(true);
      const token = getAuthToken();
      const endpoint = apiUrl ? `${apiUrl}/api/admin/combos/draft` : '/api/admin/combos/draft';
      const res = await fetch(endpoint, {
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.draft) {
          const parsed = data.draft;
          if (parsed.name !== undefined) setName(parsed.name);
          if (parsed.categoryId) setCategoryId(parsed.categoryId);
          if (parsed.targetGender) setTargetGender(parsed.targetGender);
          if (parsed.description !== undefined) setDescription(parsed.description);
          if (parsed.tag !== undefined) setTag(parsed.tag);
          if (parsed.showTag !== undefined) setShowTag(parsed.showTag);
          if (parsed.notForPublicSale !== undefined) setNotForPublicSale(parsed.notForPublicSale);
          if (Array.isArray(parsed.imageUrls)) setImageUrls(parsed.imageUrls);
          if (Array.isArray(parsed.selectedComponents) && parsed.selectedComponents.length > 0) {
            setSelectedComponents(parsed.selectedComponents);
          }
          if (parsed.suppliesCost !== undefined) setSuppliesCost(parsed.suppliesCost);
          if (parsed.retailPrice !== undefined) setRetailPrice(parsed.retailPrice);
          if (parsed.wholesalePrice !== undefined) setWholesalePrice(parsed.wholesalePrice);
          if (parsed.quantityToProduce !== undefined) setQuantityToProduce(parsed.quantityToProduce);
          try {
            localStorage.setItem(DRAFT_COMBOS_KEY, JSON.stringify(parsed));
          } catch {}
          if (data.updated_at) setDraftUpdatedAt(data.updated_at);
          if (data.updated_by) setDraftUpdatedBy(data.updated_by);
          setCloudSyncStatus('saved');
          if (isManual) showAlert('✅ Borrador compartido sincronizado correctamente.');
          return true;
        } else {
          return false;
        }
      }
    } catch (e) {
      console.error('Error al consultar borrador del servidor:', e);
      if (isManual) showAlert('⚠️ No se pudo conectar al servidor para sincronizar.');
    } finally {
      if (isManual) setIsSyncingServerDraft(false);
    }
    return false;
  }, [apiUrl, getAuthToken, showAlert]);

  // Guarda el borrador en el servidor
  const saveServerDraft = useCallback(async (draftData: any) => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const endpoint = apiUrl ? `${apiUrl}/api/admin/combos/draft` : '/api/admin/combos/draft';
      setCloudSyncStatus('saving');
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ draft: draftData })
      });
      if (res.ok) {
        const data = await res.json();
        setCloudSyncStatus('saved');
        if (data.updated_at) setDraftUpdatedAt(data.updated_at);
        if (data.updated_by) setDraftUpdatedBy(data.updated_by);
      } else {
        setCloudSyncStatus('error');
      }
    } catch (e) {
      console.error('Error al guardar borrador en el servidor:', e);
      setCloudSyncStatus('error');
    }
  }, [apiUrl, getAuthToken]);

  // Elimina el borrador del servidor
  const clearServerDraft = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const endpoint = apiUrl ? `${apiUrl}/api/admin/combos/draft` : '/api/admin/combos/draft';
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Error al eliminar borrador del servidor:', e);
    }
  }, [apiUrl, getAuthToken]);

  // Cargar borrador al montar: primero local para respuesta rápida, luego servidor para datos compartidos
  useEffect(() => {
    let isMounted = true;
    const initDraft = async () => {
      let localDraft: any = null;
      try {
        const saved = localStorage.getItem(DRAFT_COMBOS_KEY);
        if (saved) {
          localDraft = JSON.parse(saved);
          if (localDraft.name !== undefined) setName(localDraft.name);
          if (localDraft.categoryId) setCategoryId(localDraft.categoryId);
          if (localDraft.targetGender) setTargetGender(localDraft.targetGender);
          if (localDraft.description !== undefined) setDescription(localDraft.description);
          if (localDraft.tag !== undefined) setTag(localDraft.tag);
          if (localDraft.showTag !== undefined) setShowTag(localDraft.showTag);
          if (localDraft.notForPublicSale !== undefined) setNotForPublicSale(localDraft.notForPublicSale);
          if (Array.isArray(localDraft.imageUrls)) setImageUrls(localDraft.imageUrls);
          if (Array.isArray(localDraft.selectedComponents) && localDraft.selectedComponents.length > 0) {
            setSelectedComponents(localDraft.selectedComponents);
          }
          if (localDraft.suppliesCost !== undefined) setSuppliesCost(localDraft.suppliesCost);
          if (localDraft.retailPrice !== undefined) setRetailPrice(localDraft.retailPrice);
          if (localDraft.wholesalePrice !== undefined) setWholesalePrice(localDraft.wholesalePrice);
          if (localDraft.quantityToProduce !== undefined) setQuantityToProduce(localDraft.quantityToProduce);
        }
      } catch (e) {
        console.error('Error al cargar borrador local de combo:', e);
      }

      // Sincronizar con el servidor (siempre tiene prioridad sobre el local)
      const foundOnServer = await fetchServerDraft(false);

      // Si no había en el servidor pero sí local, respaldarlo al servidor para que otros admins lo vean
      if (!foundOnServer && localDraft && isMounted) {
        saveServerDraft(localDraft);
      }

      if (isMounted) {
        setIsDraftLoaded(true);
      }
    };

    initDraft();
    return () => {
      isMounted = false;
    };
  }, [fetchServerDraft, saveServerDraft]);

  // Guardar borrador automáticamente al cambiar datos con debounce de 800ms
  useEffect(() => {
    if (!isDraftLoaded) return;
    const timer = setTimeout(() => {
      try {
        if (hasDraftData) {
          const draft = {
            name,
            categoryId,
            targetGender,
            description,
            tag,
            showTag,
            notForPublicSale,
            imageUrls,
            selectedComponents,
            suppliesCost,
            retailPrice,
            wholesalePrice,
            quantityToProduce,
          };
          localStorage.setItem(DRAFT_COMBOS_KEY, JSON.stringify(draft));
          saveServerDraft(draft);
        } else {
          localStorage.removeItem(DRAFT_COMBOS_KEY);
          clearServerDraft();
          setCloudSyncStatus('idle');
          setDraftUpdatedAt(null);
          setDraftUpdatedBy(null);
        }
      } catch (e) {
        console.error('Error al guardar borrador de combo:', e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    isDraftLoaded, hasDraftData,
    name, targetGender, description, tag, showTag, notForPublicSale,
    imageUrls, selectedComponents, suppliesCost, retailPrice, wholesalePrice, quantityToProduce,
    saveServerDraft, clearServerDraft,
  ]);

  // Al volver el foco a la ventana, sincronizar con el servidor
  useEffect(() => {
    const handleWindowFocus = () => {
      if (isDraftLoaded) {
        fetchServerDraft(false);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isDraftLoaded, fetchServerDraft]);

  // Limpiar / Descartar borrador - resetea todos los campos
  const handleClearDraft = () => {
    setName('');
    setTargetGender('Unisex');
    setDescription('');
    setTag('Edición Especial');
    setShowTag(true);
    setNotForPublicSale(false);
    setImageUrls([]);
    setSelectedComponents([]);
    setSuppliesCost(0);
    setRetailPrice('');
    setWholesalePrice('');
    setQuantityToProduce(1);
    setCloudSyncStatus('idle');
    setDraftUpdatedAt(null);
    setDraftUpdatedBy(null);
    try { localStorage.removeItem(DRAFT_COMBOS_KEY); } catch {}
    clearServerDraft();
    setShowClearComboModal(false);
  };

  // Filter available products for adding to combo (ALL products, including notForPublicSale, but exclude bundles)
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isBundle) return false;
      const q = componentSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.categoryId.toLowerCase().includes(q)
      );
    });
  }, [products, componentSearch]);

  const currentlySelectedProd = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const currentlySelectedVariant = useMemo(() => {
    if (!currentlySelectedProd) return null;
    return (
      currentlySelectedProd.variants.find((v) => v.id === selectedVariantId) ||
      currentlySelectedProd.variants[0] ||
      null
    );
  }, [currentlySelectedProd, selectedVariantId]);

  // Calculate live cost
  const componentsUnitCost = useMemo(() => {
    return selectedComponents.reduce((sum, c) => sum + (c.unitCost * c.quantityPerBundle), 0);
  }, [selectedComponents]);

  const numericSuppliesCost = Math.max(0, Number(suppliesCost) || 0);
  const totalUnitCost = componentsUnitCost + numericSuppliesCost;

  // Calculate max combos that can physically be produced based on component inventory
  const maxCanProduce = useMemo(() => {
    if (selectedComponents.length === 0) return 0;
    let min = Infinity;
    for (const comp of selectedComponents) {
      const prod = products.find((p) => p.id === comp.productId);
      const variant = prod?.variants.find((v) => v.id === comp.variantId);
      const stock = variant?.stock || 0;
      const possible = Math.floor(stock / (comp.quantityPerBundle || 1));
      if (possible < min) min = possible;
    }
    return min === Infinity ? 0 : Math.max(0, min);
  }, [selectedComponents, products]);

  // Handle adding a component
  const handleAddComponent = () => {
    if (!currentlySelectedProd || !currentlySelectedVariant) {
      showAlert('Selecciona un producto y su variante para agregar al combo.');
      return;
    }

    const qty = Math.max(1, Math.floor(Number(componentQty) || 1));
    const availableStock = currentlySelectedVariant.stock || 0;

    if (availableStock < qty) {
      showAlert(
        `Atención: Esta variante solo tiene ${availableStock} unidades en stock. No alcanzaría ni para armar 1 combo con ${qty} unidades.`
      );
    }

    // Check if already in list
    const existingIndex = selectedComponents.findIndex(
      (c) => c.productId === currentlySelectedProd.id && c.variantId === currentlySelectedVariant.id
    );

    const unitCost =
      currentlySelectedVariant.unitPurchasePrice !== undefined &&
      currentlySelectedVariant.unitPurchasePrice > 0
        ? currentlySelectedVariant.unitPurchasePrice
        : currentlySelectedProd.purchasePrice || 0;

    const variantLabel = `${currentlySelectedVariant.size || 'Único'}${
      currentlySelectedVariant.color ? ' - ' + currentlySelectedVariant.color : ''
    }`;

    if (existingIndex >= 0) {
      const copy = [...selectedComponents];
      copy[existingIndex].quantityPerBundle += qty;
      setSelectedComponents(copy);
    } else {
      setSelectedComponents((prev) => [
        ...prev,
        {
          productId: currentlySelectedProd.id,
          variantId: currentlySelectedVariant.id,
          productName: currentlySelectedProd.name,
          variantInfo: variantLabel,
          quantityPerBundle: qty,
          unitCost,
        },
      ]);
    }

    // Reset selection
    setSelectedProductId('');
    setSelectedVariantId('');
    setComponentQty(1);
  };

  const handleRemoveComponent = (index: number) => {
    setSelectedComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateComponentQty = (index: number, newQty: number) => {
    const validQty = Math.max(1, Math.floor(newQty || 1));
    setSelectedComponents((prev) => {
      const copy = [...prev];
      copy[index].quantityPerBundle = validQty;
      return copy;
    });
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const token =
      apiKey ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('lyg_api_key') || localStorage.getItem('adminToken') || ''
        : '');

    setIsUploading(true);
    const uploaded: string[] = [];
    const endpoint = apiUrl ? `${apiUrl}/api/admin/product-image` : '/api/admin/product-image';

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const headers: Record<string, string> = {};
        if (token) {
          headers['X-API-KEY'] = token;
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          uploaded.push(data.url);
        } else {
          showAlert(`Error al subir ${file.name}`);
        }
      }
      if (uploaded.length > 0) {
        setImageUrls((prev) => [...prev, ...uploaded]);
      }
    } catch (err: any) {
      showAlert(`Error al subir imágenes: ${err.message || 'Error de red'}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setImageUrls((prev) => [...prev, imageUrlInput.trim()]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert('Por favor indica un nombre para el combo.');
      return;
    }
    if (selectedComponents.length === 0) {
      showAlert('Debes agregar al menos un producto componente al combo.');
      return;
    }

    const qty = Math.max(1, Math.floor(Number(quantityToProduce) || 1));
    if (qty > maxCanProduce) {
      showAlert(
        `No tienes suficiente stock de los componentes para armar ${qty} combos. El máximo posible es ${maxCanProduce}.`
      );
      return;
    }

    const finalRetail = Number(retailPrice) || 0;
    if (finalRetail <= 0) {
      showAlert('Por favor indica un precio de venta minorista válido mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const chosenCategory = categoryId || comboGroup?.opciones?.[0] || comboGroup?.grupo || 'Set de Regalos';
      const res = createBundleProduct({
        name: name.trim(),
        categoryId: chosenCategory,
        targetGender,
        description: description.trim(),
        tag: showTag ? tag : undefined,
        showTag,
        imageUrls,
        components: selectedComponents,
        suppliesCost: numericSuppliesCost,
        quantityToProduce: qty,
        retailPrice: finalRetail,
        wholesalePrice: Number(wholesalePrice) || finalRetail,
        notForPublicSale,
      });

      if (!res.success) {
        showAlert(`Error: ${res.error || 'No se pudo crear el combo.'}`);
        return;
      }

      // Sync state to backend DB
      try {
        const state = useStockFlowStore.getState();
        await fetch('/api/store/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: state.products,
            purchases: state.purchases,
            sales: state.sales,
            categoriesConfig: state.categoriesConfig,
            variantGroupsConfig: state.variantGroupsConfig,
            perfumeTypesConfig: state.perfumeTypesConfig,
            globalMarkupPrc: state.globalMarkupPrc,
            wholesaleConfig: state.wholesaleConfig,
          }),
        });
      } catch (e) {
        console.warn('Error sincronizando DB al crear combo:', e);
      }

      // Limpiar borrador al crear combo exitosamente
      try { localStorage.removeItem(DRAFT_COMBOS_KEY); } catch {}
      clearServerDraft();
      setCloudSyncStatus('idle');
      setDraftUpdatedAt(null);
      setDraftUpdatedBy(null);

      showAlert(
        `🎉 ¡Combo "${name}" creado con éxito! Se armaron ${qty} unidades en stock y se descontaron los componentes del inventario.`
      );
      if (onComboCreated) {
        onComboCreated();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const retailMargin =
    Number(retailPrice) > 0 && totalUnitCost > 0
      ? Math.round(((Number(retailPrice) - totalUnitCost) / Number(retailPrice)) * 100)
      : null;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Banner Header - Full Width */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-purple-500/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 shrink-0">
            <span className="material-symbols-outlined text-3xl">featured_seasonal_and_gifts</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              Armar Nuevo Combo / Set de Regalo
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Combina productos de tu inventario (incluso los ocultos), suma insumos de empaque y genera stock físico listo para vender.
            </p>
          </div>
        </div>

        {/* Botones de control del borrador + Volver */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Indicador de estado cloud */}
          {cloudSyncStatus === 'saving' && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
              <span className="material-symbols-outlined text-sm animate-spin">sync</span> Guardando en la nube...
            </span>
          )}
          {hasDraftData && cloudSyncStatus === 'saved' && (
            <span
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
              title="Este borrador está sincronizado en la base de datos y visible para todos los administradores en cualquier dispositivo"
            >
              <span className="material-symbols-outlined text-sm">cloud_done</span>
              Borrador compartido {draftUpdatedBy ? `(${draftUpdatedBy})` : ''}
            </span>
          )}
          {cloudSyncStatus === 'error' && (
            <span className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-100/70 dark:bg-red-950/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">cloud_off</span> Error al guardar
            </span>
          )}

          {/* Botón Sincronizar */}
          <button
            type="button"
            onClick={() => fetchServerDraft(true)}
            disabled={isSyncingServerDraft}
            title="Consultar si otro administrador actualizó este borrador en otro dispositivo"
            className="text-xs font-semibold text-pink-700 dark:text-pink-300 bg-pink-100/80 hover:bg-pink-200/80 dark:bg-pink-900/50 dark:hover:bg-pink-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-sm ${isSyncingServerDraft ? 'animate-spin' : ''}`}>sync</span>
            {isSyncingServerDraft ? 'Sincronizando...' : 'Sincronizar'}
          </button>

          {/* Botón Descartar Borrador */}
          {hasDraftData && (
            <button
              type="button"
              onClick={() => setShowClearComboModal(true)}
              title="Limpiar todos los campos y descartar el borrador guardado"
              className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/80 hover:bg-rose-200/80 dark:bg-rose-900/50 dark:hover:bg-rose-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Limpiar Borrador
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Volver a Productos</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Grid Layout: Left Column (Components & Info), Right Column (Financials, Pricing & Production) */}
      <form onSubmit={handleSubmit} className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Section 1 (Info) & Section 2 (Component Selection & Table) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Section 1: Basic Information */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-500 text-lg">info</span>
                1. Información del Combo
              </h3>

              <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors border select-none ${
                notForPublicSale
                  ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
              }`}>
                <input
                  type="checkbox"
                  checked={Boolean(notForPublicSale)}
                  onChange={(e) => setNotForPublicSale(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 size-3.5 cursor-pointer"
                />
                <span className="material-symbols-outlined text-[15px]">
                  {notForPublicSale ? 'visibility_off' : 'visibility'}
                </span>
                <span>{notForPublicSale ? 'Fuera de venta' : 'No para venta al público'}</span>
              </label>
            </div>

            {notForPublicSale && (
              <div className="px-3 py-1.5 rounded-lg bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-purple-600 dark:text-purple-400">info</span>
                <span>Se cargará al inventario pero <strong>no estará en la tienda</strong> ni se mostrará al público.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Nombre del Combo / Set <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ramo de Maquillaje Glamour & Flores, Set Fragancia + Body Mist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>Categoría</span>
                  <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold uppercase tracking-wider bg-pink-50 dark:bg-pink-950/50 px-2 py-0.5 rounded-md border border-pink-200 dark:border-pink-800">
                    Fijada para Combos
                  </span>
                </label>
                {comboGroup && comboGroup.opciones && comboGroup.opciones.length > 1 ? (
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-pink-500">
                      <span className="material-symbols-outlined text-base">featured_seasonal_and_gifts</span>
                    </div>
                    <select
                      value={categoryId || comboGroup.opciones[0]}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full pl-10 pr-28 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-pink-500 outline-none appearance-none cursor-pointer"
                    >
                      {comboGroup.opciones.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <span className="text-xs text-slate-400 font-normal">{comboGroup.grupo}</span>
                      <span className="material-symbols-outlined text-slate-400 text-sm">expand_more</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-pink-500 text-base">featured_seasonal_and_gifts</span>
                      <span>{categoryId || comboGroup?.opciones?.[0] || 'Set de Regalos'}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-normal">{comboGroup?.grupo || 'Combos & Regalos'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Público Objetivo / Género
                </label>
                <select
                  value={targetGender}
                  onChange={(e) => setTargetGender(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none dark:text-white"
                >
                  <option value="Unisex">Unisex / Para Todos</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Hombre">Hombre</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Insignia / Etiqueta
                  </label>
                  <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors border select-none ${
                    !showTag
                      ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={showTag}
                      onChange={(e) => setShowTag(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 size-3.5 cursor-pointer"
                    />
                    <span className="material-symbols-outlined text-[15px]">
                      {showTag ? 'visibility' : 'visibility_off'}
                    </span>
                    <span>{showTag ? 'Visible' : 'Oculta'}</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Ej: Edición Especial, Más Vendido"
                  disabled={!showTag}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Descripción del Combo / Presentación
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe la experiencia de este set, para qué ocasión es ideal o qué sensaciones transmite..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Component Selection & Interactive Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-500 text-lg">widgets</span>
                2. Productos Componentes del Combo
              </h3>
              <span className="text-xs bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 font-bold px-3 py-1 rounded-full">
                {selectedComponents.length} agregados
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Podés elegir cualquier producto de tu stock (incluso aquellos marcados como <em>&quot;Ocultos para venta al público&quot;</em>).
            </p>

            {/* Add component controls */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                
                {/* Product selector with search */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Producto a incluir
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Filtrar por nombre..."
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-pink-500 dark:text-white"
                    />
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setSelectedVariantId('');
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-pink-500 dark:text-white"
                    >
                      <option value="">-- Elige un producto ({availableProducts.length}) --</option>
                      {availableProducts.map((p) => {
                        const totalStock = p.variants.reduce((a, v) => a + (v.stock || 0), 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.notForPublicSale ? '🔒 [Interno] ' : ''}
                            {p.name} (Stock: {totalStock})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Variant selector */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Variante / Talle / Color
                  </label>
                  <select
                    disabled={!currentlySelectedProd}
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-pink-500 dark:text-white disabled:opacity-50"
                  >
                    <option value="">
                      {currentlySelectedProd
                        ? '-- Variante (' + currentlySelectedProd.variants.length + ') --'
                        : '-- Primero elige un producto --'}
                    </option>
                    {currentlySelectedProd?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.size || 'Único'} {v.color ? `(${v.color})` : ''} - Stock: {v.stock} (Costo: $
                        {(v.unitPurchasePrice || currentlySelectedProd.purchasePrice || 0).toLocaleString('es-AR')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity needed per combo */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center block">
                    Cant. / Combo
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={componentQty}
                    onChange={(e) => setComponentQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center outline-none focus:ring-2 focus:ring-pink-500 dark:text-white"
                  />
                </div>

                {/* Add button */}
                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddComponent}
                    disabled={!currentlySelectedProd}
                    className="w-full h-10 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-md shadow-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Agregar al combo"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                  </button>
                </div>

              </div>
            </div>

            {/* Components table / list */}
            {selectedComponents.length === 0 ? (
              <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-5xl mb-2">
                  inventory_2
                </span>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Aún no has agregado productos al combo.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Utiliza los selectores de arriba para ir sumando labiales, perfumes, sombras o cremas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-3">Variante</th>
                      <th className="py-3 px-3 text-center">Cant. / Combo</th>
                      <th className="py-3 px-3 text-right">Costo Unit.</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedComponents.map((comp, idx) => {
                      const prod = products.find((p) => p.id === comp.productId);
                      const variant = prod?.variants.find((v) => v.id === comp.variantId);
                      const currentStock = variant?.stock || 0;
                      const subtotal = comp.unitCost * comp.quantityPerBundle;

                      return (
                        <tr key={`${comp.productId}-${comp.variantId}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">
                            {prod?.notForPublicSale && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-black mr-1">
                                INTERNO
                              </span>
                            )}
                            {comp.productName}
                          </td>
                          <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                            {comp.variantInfo}
                            <span className="block text-[10px] text-slate-400">
                              Stock disp: {currentStock}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              value={comp.quantityPerBundle}
                              onChange={(e) => handleUpdateComponentQty(idx, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                            ${comp.unitCost.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                            ${subtotal.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Quitar componente"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        Costo de Componentes por Combo:
                      </td>
                      <td className="py-3 px-4 text-right font-black text-pink-600 dark:text-pink-400 text-sm">
                        ${componentsUnitCost.toLocaleString('es-AR')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Section 3 (Financials & Packaging), Section 4 (Pricing & Stock), Section 5 (Photos), Action Box */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* Section 3 & 4: Live Financials, Packaging & Production Calculator */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-pink-500 text-lg">payments</span>
              3. Costos, Insumos y Producción
            </h3>

            {/* Live Financial Summary Card */}
            <div className="p-4 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl border border-pink-200/50 dark:border-pink-900/40 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>Costo Componentes:</span>
                <span className="font-bold text-slate-800 dark:text-white">${componentsUnitCost.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>+ Insumos / Packaging:</span>
                <span className="font-bold text-slate-800 dark:text-white">${numericSuppliesCost.toLocaleString('es-AR')}</span>
              </div>
              <div className="pt-2 border-t border-pink-200/60 dark:border-pink-800/40 flex justify-between items-center">
                <span className="text-xs font-black text-pink-600 dark:text-pink-400 uppercase tracking-wider">
                  Costo Total Unitario:
                </span>
                <span className="text-xl font-black text-pink-600 dark:text-pink-400">
                  ${totalUnitCost.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Packaging / Supplies cost input */}
            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Gasto de Insumos / Packaging por cada Combo ($ ARS)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Caja sorpresa, moño, papel celofán, flores secas, tarjetas, etc.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={suppliesCost}
                  onChange={(e) => setSuppliesCost(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            {/* Units to produce */}
            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-800 dark:text-white">
                  ¿Cuántos combos vas a armar hoy? <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                  Máx: {maxCanProduce} disp.
                </span>
              </div>
              <input
                type="number"
                min={1}
                max={maxCanProduce > 0 ? maxCanProduce : 1}
                value={quantityToProduce}
                onChange={(e) => setQuantityToProduce(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-center focus:ring-2 focus:ring-pink-500 outline-none dark:text-white"
              />
              <p className="text-[10px] text-slate-400">
                Se descontará esta cantidad de cada componente y se creará stock físico del combo.
              </p>
            </div>

            {/* Retail & Wholesale Prices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Retail */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-800 dark:text-white">
                    Precio Minorista <span className="text-rose-500">*</span>
                  </label>
                  {retailMargin !== null && (
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        retailMargin >= 30
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : retailMargin > 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}
                    >
                      {retailMargin}%
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    placeholder="0"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black focus:ring-2 focus:ring-pink-500 outline-none dark:text-white"
                  />
                </div>
              </div>

              {/* Wholesale */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
                <label className="text-xs font-black text-slate-800 dark:text-white block">
                  Precio Mayorista
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Opcional"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black focus:ring-2 focus:ring-pink-500 outline-none dark:text-white"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Section 5: Photos / Images */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-pink-500 text-lg">add_photo_alternate</span>
              4. Fotos del Combo
            </h3>

            <div className="space-y-3">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-100 file:text-pink-700 hover:file:bg-pink-200 dark:file:bg-pink-900/40 dark:file:text-pink-300 cursor-pointer"
              />
              {isUploading && (
                <p className="text-xs text-pink-500 font-bold animate-pulse">Subiendo foto(s)...</p>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="O pega URL de imagen..."
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-1 focus:ring-pink-500 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Thumbnails */}
              {imageUrls.length > 0 && (
                <div className="flex gap-2.5 flex-wrap pt-1">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                      <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-red-600/90 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Eliminar foto"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                          Portada
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Actions - Sticky Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <button
              type="submit"
                disabled={isSubmitting || selectedComponents.length === 0 || maxCanProduce <= 0}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-sm shadow-xl shadow-pink-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">featured_seasonal_and_gifts</span>
                <span>
                  {isSubmitting
                    ? 'Produciendo combo...'
                    : `Guardar y Producir ${quantityToProduce} Combo(s)`}
                </span>
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              )}
          </div>

        </div>

      </form>

      {/* Modal de confirmación: Limpiar borrador */}
      {showClearComboModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-2xl">delete_sweep</span>
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">¿Descartar el borrador?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Esta acción limpiará todos los campos y eliminará el borrador compartido del servidor.</p>
              </div>
            </div>
            {draftUpdatedBy && (
              <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>Este borrador fue guardado por <strong>{draftUpdatedBy}</strong>. Al descartarlo, se eliminará para todos los administradores.</span>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearComboModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">delete_sweep</span>
                Sí, descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
