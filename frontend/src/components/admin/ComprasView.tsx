'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStockFlowStore, DEFAULT_PERFUME_TYPES, getVariantGroupForCategory } from '@/store/useStockStore';
import { syncBatchItemsToStore } from '@/utils/syncBatch';

type Currency = 'ARS' | 'USD' | 'BRL' | 'PYG';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'USD $',
  BRL: 'R$',
  PYG: '₲',
};

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');
const fmtUSD = (n: number) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ComprasView({ showAlert, apiKey, apiUrl }: { showAlert: (msg: string) => void; apiKey: string; apiUrl: string }) {
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const registerPurchaseBatch = useStockFlowStore(s => s.registerPurchaseBatch);
  const deletePurchaseBatch = useStockFlowStore(s => s.deletePurchaseBatch);
  const updatePurchaseBatch = useStockFlowStore(s => s.updatePurchaseBatch);
  const productsStore = useStockFlowStore(s => s.products);
  const { categoriesConfig, variantGroupsConfig, perfumeTypesConfig } = useStockFlowStore();

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

  // TABS
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');

  // PASO 1
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>('ARS');
  const [exchangeRate, setExchangeRate] = useState<number | string>(1);
  const [supplierInput, setSupplierInput] = useState('');
  const [apiSuppliers, setApiSuppliers] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Autocomplete producto (dropdown custom con imagen)
  const [productDropdownPIdx, setProductDropdownPIdx] = useState<number | null>(null);

  // PASO 3
  const [shippingCurrency, setShippingCurrency] = useState<Currency>('ARS');
  const [shippingCostOriginal, setShippingCostOriginal] = useState<number | string>('');

  const effectiveExchangeRate = purchaseCurrency === 'ARS' ? 1 : (Number(exchangeRate) || 0);
  const shippingEffectiveRate = shippingCurrency === 'ARS' ? 1 : (Number(exchangeRate) || 0);
  const shippingCostARS = (Number(shippingCostOriginal) || 0) * shippingEffectiveRate;

  // PASO 2
  const createEmptyVariant = () => ({ size: 'M', description: '', quantity: 1 as number | string, unitPurchasePrice: '' as unknown as number, sizeIndex: 0 });
  const createEmptyProduct = () => ({
    productId: `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    newProductName: '', newProductSku: '', perfumeType: '',
    categoryId: categoriesConfig[0]?.opciones[0] || 'Perfumes de Mujer',
    targetGender: 'Unisex' as const,
    newProductImageUrls: [] as string[], _uploading: false,
    variants: [createEmptyVariant()],
    description: '', tag: 'Alta Demanda', showTag: false,
    olfactoryNotes: '', duration: '', intensity: '', family: '', showFeatures: false, _showDetails: false,
  });

  const [products, setProducts] = useState([createEmptyProduct()]);
  const addProductLine = () => setProducts(p => [...p, createEmptyProduct()]);
  const addVariant = (pIdx: number) => { const np = [...products]; np[pIdx].variants.push(createEmptyVariant()); setProducts(np); };
  const updateProduct = (pIdx: number, field: string, value: any) => { const np = [...products]; (np[pIdx] as any)[field] = value; setProducts(np); };
  const updateVariant = (pIdx: number, vIdx: number, field: string, value: any) => { const np = [...products]; (np[pIdx].variants[vIdx] as any)[field] = value; setProducts(np); };
  const removeProduct = (pIdx: number) => { if (products.length > 1) setProducts(products.filter((_, i) => i !== pIdx)); };
  const removeVariant = (pIdx: number, vIdx: number) => { const np = [...products]; if (np[pIdx].variants.length > 1) { np[pIdx].variants.splice(vIdx, 1); setProducts(np); } };

  // Totals
  const allVariants = products.flatMap(p => p.variants);
  const totalUnidades = allVariants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
  const totalCompraARS = allVariants.reduce((s, v) => s + (Number(v.quantity) || 0) * (Number(v.unitPurchasePrice) || 0) * effectiveExchangeRate, 0);

  // PASO 4
  type SummaryRow = {
    pIdx: number; vIdx: number; productName: string; variantLabel: string; quantity: number;
    unitCostOriginal: number; unitCostARS: number; shippingPerUnitARS: number; totalCostPerUnitARS: number;
    suggestedSalePrice: number; salePrice: number;
    existingProd: any | null; existingVariant: any | null;
    salePriceConflict: 'update' | 'keep' | 'custom' | null; customSalePrice: number;
  };
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [conflictModal, setConflictModal] = useState<{ row: SummaryRow; rowIdx: number } | null>(null);

  // Historial
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [searchBatch, setSearchBatch] = useState('');
  const [detailBatch, setDetailBatch] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal Eliminar Lote
  const [deleteModalBatch, setDeleteModalBatch] = useState<any | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Modal Editar Lote
  const [editModalBatch, setEditModalBatch] = useState<any | null>(null);
  const [loadingEditBatch, setLoadingEditBatch] = useState(false);
  const [savingEditBatch, setSavingEditBatch] = useState(false);

  // Modal Eliminar Datos / Borrador
  const [showClearDraftModal, setShowClearDraftModal] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const DRAFT_COMPRAS_KEY = 'lyg_draft_compra';

  // Modal Biblioteca de Medios (Imágenes)
  const [mediaLibTargetPIdx, setMediaLibTargetPIdx] = useState<number | null>(null);
  const [mediaLibImages, setMediaLibImages] = useState<Array<{ url: string; filename: string; category?: string }>>([]);
  const [mediaLibCategories, setMediaLibCategories] = useState<string[]>([]);
  const [selectedMediaCategory, setSelectedMediaCategory] = useState<string>('all');
  const [mediaLibLoading, setMediaLibLoading] = useState(false);
  const [mediaLibSearch, setMediaLibSearch] = useState('');

  const openMediaLib = async (pIdx: number, force = false) => {
    setMediaLibTargetPIdx(pIdx);
    if (!force && mediaLibImages.length > 0) return;
    setMediaLibLoading(true);
    try {
      const token = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
      const endpoint = apiUrl ? `${apiUrl}/api/admin/media` : '/api/admin/media';
      const res = await fetch(endpoint, {
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const files: any[] = data.files || [];
        const validImgs = files
          .map((f: any) => {
            const url = typeof f === 'string' ? f : f.url || '';
            const filename = typeof f === 'string' ? f.split('/').pop() || '' : f.filename || url.split('/').pop() || '';
            const category = typeof f === 'object' ? f.category : '';
            return { url, filename, category };
          })
          .filter(f => Boolean(f.url) && /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp)$/i.test(f.url));
        setMediaLibImages(validImgs);
        if (Array.isArray(data.categories)) {
          setMediaLibCategories(data.categories);
        }
      }
    } catch (e) {
      console.error('Error fetching media library:', e);
    } finally {
      setMediaLibLoading(false);
    }
  };

  const toggleProductImage = (pIdx: number, imgUrl: string) => {
    const cur = products[pIdx]?.newProductImageUrls || [];
    const exists = cur.includes(imgUrl);
    if (exists) {
      updateProduct(pIdx, 'newProductImageUrls', cur.filter(u => u !== imgUrl));
    } else {
      updateProduct(pIdx, 'newProductImageUrls', [...cur, imgUrl]);
    }
  };

  // Verifica si hay algún dato cargado
  const hasDraftData = Boolean(
    supplierInput.trim() !== '' ||
    purchaseCurrency !== 'ARS' ||
    shippingCurrency !== 'ARS' ||
    (shippingCostOriginal !== '' && Number(shippingCostOriginal) > 0) ||
    products.length > 1 ||
    products.some(p =>
      (p.newProductName && p.newProductName.trim() !== '') ||
      (p.newProductSku && p.newProductSku.trim() !== '') ||
      (p.newProductImageUrls && p.newProductImageUrls.length > 0) ||
      (p.description && p.description.trim() !== '') ||
      (p.olfactoryNotes && p.olfactoryNotes.trim() !== '') ||
      (p.duration && p.duration.trim() !== '') ||
      (p.intensity && p.intensity.trim() !== '') ||
      (p.family && p.family.trim() !== '') ||
      (p.variants && p.variants.length > 1) ||
      (p.variants && p.variants.some(v =>
        (v.description && v.description.trim() !== '') ||
        (Number(v.unitPurchasePrice) > 0) ||
        Number(v.quantity) > 1 ||
        (v.size && v.size !== 'M')
      ))
    )
  );

  // Cargar borrador persistido al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_COMPRAS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.supplierInput !== undefined) setSupplierInput(parsed.supplierInput);
        if (parsed.purchaseDate) setPurchaseDate(parsed.purchaseDate);
        if (parsed.purchaseCurrency) setPurchaseCurrency(parsed.purchaseCurrency);
        if (parsed.exchangeRate !== undefined) setExchangeRate(parsed.exchangeRate);
        if (parsed.shippingCurrency) setShippingCurrency(parsed.shippingCurrency);
        if (parsed.shippingCostOriginal !== undefined) setShippingCostOriginal(parsed.shippingCostOriginal);
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          setProducts(parsed.products);
        }
      }
    } catch (e) {
      console.error('Error al cargar borrador de compras:', e);
    } finally {
      setIsDraftLoaded(true);
    }
  }, []);

  // Guardar borrador automáticamente al cambiar datos
  useEffect(() => {
    if (!isDraftLoaded) return;
    try {
      if (hasDraftData) {
        const draft = {
          supplierInput,
          purchaseDate,
          purchaseCurrency,
          exchangeRate,
          shippingCurrency,
          shippingCostOriginal,
          products,
        };
        localStorage.setItem(DRAFT_COMPRAS_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(DRAFT_COMPRAS_KEY);
      }
    } catch (e) {
      console.error('Error al guardar borrador de compras:', e);
    }
  }, [isDraftLoaded, hasDraftData, supplierInput, purchaseDate, purchaseCurrency, exchangeRate, shippingCurrency, shippingCostOriginal, products]);

  // Limpiar y resetear borrador
  const handleClearDraft = () => {
    setSupplierInput('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseCurrency('ARS');
    setExchangeRate(1);
    setShippingCurrency('ARS');
    setShippingCostOriginal('');
    setProducts([createEmptyProduct()]);
    setShowSummary(false);
    try {
      localStorage.removeItem(DRAFT_COMPRAS_KEY);
    } catch {}
    setShowClearDraftModal(false);
    showAlert('🗑️ Datos eliminados y formulario reseteado.');
  };

  // Autocomplete proveedores
  const fetchSuppliers = useCallback(async () => {
    if (!apiKey) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/suppliers`, { headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } });
      if (res.ok) {
        const data = await res.json();
        const apiNames: string[] = data.map((s: any) => (s.name || '').trim()).filter(Boolean);
        setApiSuppliers(apiNames);
      }
    } catch { }
  }, [apiKey, apiUrl]);

  const fetchBatches = useCallback(async () => {
    if (!apiKey) return;
    setLoadingBatches(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches?limit=100`, { headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } });
      if (res.ok) {
        const data = await res.json();
        const bList = data.batches || [];
        setBatches(bList);
      }
    } catch { } finally { setLoadingBatches(false); }
  }, [apiKey, apiUrl]);

  const supplierSuggestions = useMemo(() => {
    const fromBatches = batches.map(b => (b.supplier_name || '').trim()).filter(Boolean);
    const fromApi = apiSuppliers.map(s => (s || '').trim()).filter(Boolean);
    return Array.from(new Set([...fromBatches, ...fromApi])).sort((a, b) => a.localeCompare(b));
  }, [apiSuppliers, batches]);

  // Cargar proveedores y lotes al inicio
  useEffect(() => {
    fetchSuppliers();
    fetchBatches();
  }, [fetchSuppliers, fetchBatches]);

  useEffect(() => {
    if (activeTab === 'historial') fetchBatches();
  }, [activeTab, fetchBatches]);

  const [syncingBatchId, setSyncingBatchId] = useState<number | null>(null);

  const syncBatchToStore = async (id: number) => {
    setSyncingBatchId(id);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${id}`, {
        headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error('No se pudo cargar el lote desde el servidor');
      const batchData = await res.json();
      const count = syncBatchItemsToStore(batchData, registerPurchaseBatch, Number(globalMarkupPrc) || 50);
      showAlert(`✅ ¡Éxito! Se sincronizaron ${count} productos del lote ${batchData.batch_number} al inventario.`);
    } catch (e: any) {
      showAlert(`Error al sincronizar: ${e.message}`);
    } finally {
      setSyncingBatchId(null);
    }
  };

  const fetchBatchDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${id}`, { headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } });
      if (res.ok) setDetailBatch(await res.json());
    } catch { } finally { setLoadingDetail(false); }
  };

  const openDeleteModal = async (batch: any) => {
    if (batch.items && batch.items.length > 0) {
      setDeleteModalBatch(batch);
      return;
    }
    // Si la lista de lotes no trae todos los items en detalle, los pedimos
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${batch.id}`, {
        headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        setDeleteModalBatch(await res.json());
      } else {
        setDeleteModalBatch(batch);
      }
    } catch {
      setDeleteModalBatch(batch);
    }
  };

  const handleConfirmDeleteBatch = async () => {
    if (!deleteModalBatch) return;
    setDeletingBatch(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${deleteModalBatch.id}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        let errMsg = 'Error al eliminar el lote';
        try {
          const err = await res.json();
          errMsg = err.detail || errMsg;
        } catch { }
        throw new Error(errMsg);
      }
      const data = await res.json();

      // Descontar del stock global y remover de purchases
      deletePurchaseBatch({
        batchNumber: data.deleted_batch_number,
        items: (data.items || []).map((it: any) => ({
          productId: it.product_id,
          variantId: it.variant_id,
          productName: it.product_name,
          variantLabel: it.variant_label,
          quantity: it.quantity,
        })),
      });

      showAlert(`🗑️ Lote ${deleteModalBatch.batch_number} eliminado y stock descontado.`);
      setDeleteModalBatch(null);
      if (detailBatch?.id === deleteModalBatch.id) setDetailBatch(null);
      fetchBatches();
    } catch (e: any) {
      showAlert(`Error al eliminar lote: ${e.message}`);
    } finally {
      setDeletingBatch(false);
    }
  };

  const openEditBatch = async (batchId: number) => {
    setLoadingEditBatch(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${batchId}`, {
        headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEditModalBatch({
          id: data.id,
          batch_number: data.batch_number,
          supplier_name: data.supplier_name || '',
          purchase_date: data.purchase_date ? data.purchase_date.split('T')[0] : '',
          notes: data.notes || '',
          currency: data.currency,
          exchange_rate: data.exchange_rate,
          shipping_cost_ars: data.shipping_cost_ars || 0,
          items: (data.items || []).map((it: any) => ({
            id: it.id,
            product_id: it.product_id,
            variant_id: it.variant_id,
            product_name: it.product_name,
            variant_label: it.variant_label,
            original_quantity: it.quantity,
            quantity: it.quantity,
            unit_cost_original: it.unit_cost_original || 0,
            unit_cost_ars: it.unit_cost_ars || 0,
            shipping_per_unit_ars: it.shipping_per_unit_ars || 0,
            total_cost_per_unit_ars: it.total_cost_per_unit_ars || 0,
            sale_price: it.sale_price || 0,
          })),
        });
      } else {
        showAlert('No se pudo cargar la información del lote para editar.');
      }
    } catch (e: any) {
      showAlert(`Error al cargar lote: ${e.message}`);
    } finally {
      setLoadingEditBatch(false);
    }
  };

  const updateEditItem = (idx: number, field: string, val: any) => {
    if (!editModalBatch) return;
    const nextItems = [...editModalBatch.items];
    nextItems[idx] = { ...nextItems[idx], [field]: val };
    setEditModalBatch({ ...editModalBatch, items: nextItems });
  };

  const handleSaveEditBatch = async () => {
    if (!editModalBatch) return;
    setSavingEditBatch(true);
    try {
      const payload = {
        supplier_name: editModalBatch.supplier_name.trim() || null,
        purchase_date: editModalBatch.purchase_date,
        notes: editModalBatch.notes.trim() || null,
        shipping_cost_ars: Number(editModalBatch.shipping_cost_ars) || 0,
        items: editModalBatch.items.map((it: any) => ({
          id: it.id,
          quantity: Number(it.quantity) || 0,
          sale_price: Number(it.sale_price) || 0,
          unit_cost_ars: Number(it.unit_cost_ars) || 0,
          shipping_per_unit_ars: Number(it.shipping_per_unit_ars) || 0,
          total_cost_per_unit_ars: Number(it.total_cost_per_unit_ars) || 0,
        })),
      };

      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${editModalBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = 'Error al actualizar lote';
        try {
          const err = await res.json();
          errMsg = err.detail || errMsg;
        } catch { }
        throw new Error(errMsg);
      }

      // Delta de cantidades y nuevos precios
      const itemsDiff = editModalBatch.items.map((it: any) => ({
        productId: it.product_id,
        variantId: it.variant_id,
        productName: it.product_name,
        variantLabel: it.variant_label,
        quantityDelta: (Number(it.quantity) || 0) - it.original_quantity,
        newSalePrice: Number(it.sale_price) || undefined,
        newTotalCostPerUnit: Number(it.total_cost_per_unit_ars) || undefined,
      }));

      updatePurchaseBatch({
        batchNumber: editModalBatch.batch_number,
        supplierName: editModalBatch.supplier_name.trim() || undefined,
        itemsDiff,
      });

      showAlert(`✅ Lote ${editModalBatch.batch_number} actualizado con éxito.`);
      setEditModalBatch(null);
      if (detailBatch?.id === editModalBatch.id) fetchBatchDetail(editModalBatch.id);
      fetchBatches();
      fetchSuppliers();
    } catch (e: any) {
      showAlert(`Error al guardar edición: ${e.message}`);
    } finally {
      setSavingEditBatch(false);
    }
  };

  const handleOpenSummary = () => {
    if (products.some(p => !p.newProductName?.trim())) { showAlert('Completá el nombre de todos los productos.'); return; }
    if (allVariants.some(v => !v.quantity || Number(v.quantity) <= 0)) { showAlert('Todas las variantes deben tener cantidad > 0.'); return; }
    if (purchaseCurrency !== 'ARS' && (!exchangeRate || Number(exchangeRate) <= 0)) { showAlert(`Ingresá la cotización del ${purchaseCurrency} en pesos.`); return; }

    const rows: SummaryRow[] = [];
    products.forEach((prod, pIdx) => {
      const variantGroup = getVariantGroupForCategory(prod.categoryId, categoriesConfig, variantGroupsConfig);
      prod.variants.forEach((variant, vIdx) => {
        const unitCostOriginal = Number(variant.unitPurchasePrice) || 0;
        const unitCostARS = unitCostOriginal * effectiveExchangeRate;
        const qty = Number(variant.quantity) || 1;
        const blockCostARS = unitCostARS * qty;
        const proportion = totalCompraARS > 0 ? blockCostARS / totalCompraARS : 0;
        const shippingPerUnitARS = qty > 0 ? (shippingCostARS * proportion) / qty : 0;
        const totalCostPerUnitARS = unitCostARS + shippingPerUnitARS;
        const suggestedSalePrice = globalMarkupPrc > 0 ? Math.round(totalCostPerUnitARS * (1 + globalMarkupPrc / 100)) : 0;

        let sizeLabel = 'Único';
        if (variantGroup) { const opt = variantGroup.options[variant.sizeIndex || 0]; if (opt) sizeLabel = opt.description ? `${opt.value} (${opt.description})` : opt.value; }
        const variantLabel = `${sizeLabel}${(variant as any).description ? ` – ${(variant as any).description}` : ''}`;

        const existingProd = prod.productId && !prod.productId.startsWith('NEW')
          ? productsStore.find(p => p.id === prod.productId)
          : productsStore.find(p => p.name.trim().toLowerCase() === prod.newProductName.trim().toLowerCase());
        const rawOptVal = (variantGroup?.options[variant.sizeIndex || 0]?.value || '').trim().toLowerCase();
        const existingVariant = existingProd
          ? (existingProd.variants.find(v =>
              v.size.trim().toLowerCase() === sizeLabel.trim().toLowerCase() ||
              (rawOptVal && v.size.trim().toLowerCase() === rawOptVal)
            ) || (existingProd.variants.length === 1 ? existingProd.variants[0] : null))
          : null;
        const hasConflict = !!existingProd && Math.abs((existingProd.purchasePrice || 0) - totalCostPerUnitARS) > 0.01;

        rows.push({ pIdx, vIdx, productName: prod.newProductName, variantLabel, quantity: qty, unitCostOriginal, unitCostARS, shippingPerUnitARS, totalCostPerUnitARS, suggestedSalePrice, salePrice: suggestedSalePrice, existingProd: existingProd || null, existingVariant: existingVariant || null, salePriceConflict: hasConflict ? null : 'update', customSalePrice: suggestedSalePrice });
      });
    });
    setSummaryRows(rows);
    setShowSummary(true);
  };

  const updateSummaryRow = (idx: number, field: string, value: any) => setSummaryRows(rows => { const nr = [...rows]; (nr[idx] as any)[field] = value; return nr; });

  const resolveConflict = (
    rowIdx: number,
    conflictType: 'update' | 'keep' | 'custom',
    salePriceToUse: number,
    customPrice?: number
  ) => {
    const nextRows = [...summaryRows];
    nextRows[rowIdx] = {
      ...nextRows[rowIdx],
      salePriceConflict: conflictType,
      salePrice: salePriceToUse,
      customSalePrice: customPrice !== undefined ? customPrice : nextRows[rowIdx].customSalePrice,
    };
    setSummaryRows(nextRows);

    // Buscar si queda algún otro producto con conflicto sin resolver
    const nextIdx = nextRows.findIndex(
      (r, i) => i !== rowIdx && r.existingProd && Math.abs((r.existingProd.purchasePrice || 0) - r.totalCostPerUnitARS) > 0.01 && r.salePriceConflict === null
    );

    if (nextIdx !== -1) {
      setConflictModal({ row: nextRows[nextIdx], rowIdx: nextIdx });
    } else {
      setConflictModal(null);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleConfirmSave = async () => {
    const firstUnresolvedIdx = summaryRows.findIndex(
      r => r.existingProd && Math.abs((r.existingProd.purchasePrice || 0) - r.totalCostPerUnitARS) > 0.01 && r.salePriceConflict === null
    );
    if (firstUnresolvedIdx !== -1) {
      setConflictModal({ row: summaryRows[firstUnresolvedIdx], rowIdx: firstUnresolvedIdx });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplier_name: supplierInput.trim() || null,
        purchase_date: purchaseDate,
        currency: purchaseCurrency,
        exchange_rate: effectiveExchangeRate,
        shipping_currency: shippingCurrency,
        shipping_cost_original: shippingCostOriginal,
        shipping_cost_ars: shippingCostARS,
        total_products_ars: totalCompraARS,
        total_cost_ars: totalCompraARS + shippingCostARS,
        items: summaryRows.map(row => {
          const prod = products[row.pIdx];
          const finalSalePrice = row.salePriceConflict === 'keep' ? (row.existingProd?.salePrice || row.salePrice) : row.salePriceConflict === 'custom' ? row.customSalePrice : row.salePrice;
          return { product_id: prod.productId, variant_id: `v-new`, product_name: row.productName, variant_label: row.variantLabel, quantity: row.quantity, unit_cost_original: row.unitCostOriginal, unit_cost_ars: row.unitCostARS, shipping_per_unit_ars: row.shippingPerUnitARS, total_cost_per_unit_ars: row.totalCostPerUnitARS, sale_price: finalSalePrice };
        }),
      };
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
      if (!res.ok) {
        let errMsg = 'Error en el servidor';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || JSON.stringify(errData);
        } catch {
          errMsg = `Error HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errMsg);
      }
      const saved = await res.json();

      registerPurchaseBatch({
        batchNumber: saved.batch_number,
        supplierName: supplierInput.trim() || undefined,
        purchaseCurrency,
        exchangeRate: effectiveExchangeRate,
        items: summaryRows.map(row => {
          const prod = products[row.pIdx];
          const finalSalePrice = row.salePriceConflict === 'keep' ? (row.existingProd?.salePrice || row.salePrice) : row.salePriceConflict === 'custom' ? row.customSalePrice : row.salePrice;
          return { productId: prod.productId, variantId: `v-new`, productName: row.productName, variantLabel: row.variantLabel, size: row.variantLabel.split(' –')[0].trim(), color: (row.variantLabel.split(' – ')[1] || ''), quantity: row.quantity, unitCostOriginal: row.unitCostOriginal, unitCostARS: row.unitCostARS, shippingPerUnitARS: row.shippingPerUnitARS, totalCostPerUnitARS: row.totalCostPerUnitARS, salePrice: finalSalePrice, newProductName: prod.newProductName, newProductSku: prod.newProductSku, perfumeType: prod.perfumeType || undefined, categoryId: prod.categoryId, targetGender: prod.targetGender, newProductImageUrls: prod.newProductImageUrls, description: prod.description || undefined, tag: prod.tag || undefined, showTag: prod.showTag, olfactoryNotes: prod.olfactoryNotes || undefined, duration: prod.duration || undefined, intensity: prod.intensity || undefined, family: prod.family || undefined, showFeatures: prod.showFeatures, salePriceConflict: row.salePriceConflict === null ? undefined : row.salePriceConflict, customSalePrice: row.customSalePrice };
        }),
      });

      showAlert(`✅ Lote ${saved.batch_number} guardado con éxito.`);
      try {
        localStorage.removeItem(DRAFT_COMPRAS_KEY);
      } catch {}
      setProducts([createEmptyProduct()]);
      setShippingCostOriginal('');
      setSupplierInput('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setShowSummary(false);
      setActiveTab('historial');
      fetchBatches();
      fetchSuppliers();
    } catch (e: any) { showAlert(`Error al guardar: ${e.message}`); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">

      {/* Header + Tabs */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
            Compras / Ingreso de Mercadería
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Registrá lotes con soporte multi-moneda y envío proporcional.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'nueva' && (
            <button
              type="button"
              onClick={() => setShowClearDraftModal(true)}
              disabled={!hasDraftData}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                hasDraftData
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 shadow-sm cursor-pointer'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
              }`}
              title={hasDraftData ? "Eliminar todos los datos cargados del ingreso" : "No hay datos para eliminar"}
            >
              <span className="material-symbols-outlined text-lg">delete_sweep</span>
              Eliminar datos
            </button>
          )}
          {(['nueva', 'historial'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <span className="material-symbols-outlined text-lg">{tab === 'nueva' ? 'add_circle' : 'history'}</span>
              {tab === 'nueva' ? 'Nueva Compra' : `Historial (${batches.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB NUEVA COMPRA ═══ */}
      {activeTab === 'nueva' && (
        <div className="space-y-6">
          {/* PASO 1 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-4">
            <h3 className="text-sm font-black text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">receipt_long</span> Paso 1 — Datos del Lote
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 mb-1">Proveedor / Tienda</label>
                <input
                  type="text"
                  placeholder="Ej: Tienda de Brazil..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={supplierInput}
                  onChange={e => {
                    const val = e.target.value;
                    setSupplierInput(val);
                    if (val.trim().length >= 1) {
                      setShowSuggestions(true);
                    } else {
                      setShowSuggestions(false);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {showSuggestions && supplierInput.trim().length >= 1 && (() => {
                  const q = supplierInput.trim().toLowerCase();
                  const filtered = supplierSuggestions.filter(s => s.toLowerCase().includes(q));
                  if (filtered.length === 0) return null;
                  return (
                    <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {filtered.map(s => (
                        <button
                          key={s}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 dark:hover:bg-primary/20 text-slate-800 dark:text-slate-200 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                          onMouseDown={() => {
                            setSupplierInput(s);
                            setShowSuggestions(false);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Fecha de Compra</label>
                <input type="date" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Moneda de Pago</label>
                <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white" value={purchaseCurrency} onChange={e => { const newCurr = e.target.value as Currency; setPurchaseCurrency(newCurr); if (newCurr === 'ARS') setExchangeRate(1); else if (exchangeRate === 1) setExchangeRate(''); }}>
                  <option value="ARS">🇦🇷 Pesos (ARS)</option>
                  <option value="USD">🇺🇸 Dólar (USD)</option>
                  <option value="BRL">🇧🇷 Real (BRL)</option>
                  <option value="PYG">🇵🇾 Guaraní (PYG)</option>
                </select>
              </div>
              {purchaseCurrency !== 'ARS' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">1 {purchaseCurrency} = $ ARS (cotización)</label>
                  <input type="number" min="0.01" step="0.01" placeholder="Ej: 1610" className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-sm font-bold text-amber-700 dark:text-amber-400" value={exchangeRate ?? ''} onChange={e => setExchangeRate(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* PASO 2: Productos */}
          <div className="space-y-6">
            {products.map((prod, pIdx) => (
              <div key={prod.productId} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl relative flex flex-col gap-4">
                <button onClick={() => removeProduct(pIdx)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 rounded-full size-8 flex items-center justify-center border border-red-200 hover:bg-red-200 z-10 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>

                {/* Selector de producto */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="col-span-1 md:col-span-5 space-y-2">
                    <label className="block text-xs font-bold text-slate-500">1. Producto Padre</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold h-10" value={prod.categoryId} onChange={e => updateProduct(pIdx, 'categoryId', e.target.value)}>
                        {categoriesConfig.map(g => (
                          <optgroup key={g.grupo} label={g.grupo}>
                            {g.opciones.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </optgroup>
                        ))}
                        {!categoriesConfig.some(g => g.opciones && g.opciones.includes(prod.categoryId)) && (
                          <option value={prod.categoryId}>{prod.categoryId}</option>
                        )}
                      </select>
                      <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold h-10" value={prod.targetGender || 'Unisex'} onChange={e => updateProduct(pIdx, 'targetGender', e.target.value)}>
                        <option value="Unisex">Unisex</option><option value="Mujer">Mujer</option><option value="Hombre">Hombre</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className={`relative ${isPerfumeCategory(prod.categoryId) ? '' : 'col-span-1 md:col-span-2'}`}>
                        <input
                          type="text"
                          placeholder="Nombre de Producto"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={prod.newProductName}
                          onChange={e => {
                            const val = e.target.value;
                            updateProduct(pIdx, 'newProductName', val);
                            if (val.trim().length >= 1) {
                              setProductDropdownPIdx(pIdx);
                            } else {
                              setProductDropdownPIdx(null);
                            }
                            // Si el valor coincide exactamente con un producto, lo selecciona
                            const ex = productsStore.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                            if (ex) {
                              updateProduct(pIdx, 'productId', ex.id);
                              updateProduct(pIdx, 'categoryId', ex.categoryId);
                              updateProduct(pIdx, 'newProductSku', ex.sku);
                              updateProduct(pIdx, 'perfumeType', (ex as any).perfumeType || '');
                              updateProduct(pIdx, 'newProductImageUrls', ex.imageUrls || []);
                              if (ex.targetGender) updateProduct(pIdx, 'targetGender', ex.targetGender);
                              ['description', 'tag', 'showTag', 'olfactoryNotes', 'duration', 'intensity', 'family', 'showFeatures'].forEach(f => { if ((ex as any)[f] !== undefined) updateProduct(pIdx, f, (ex as any)[f]); });
                              setProductDropdownPIdx(null);
                            } else if (!prod.productId || !prod.productId.startsWith('NEW-')) {
                              updateProduct(pIdx, 'productId', `NEW-${Date.now()}-${pIdx}`);
                            }
                          }}
                          onBlur={() => setTimeout(() => setProductDropdownPIdx(null), 200)}
                        />

                        {/* Dropdown de Productos idéntico a Proveedor */}
                        {productDropdownPIdx === pIdx && (prod.newProductName || '').trim().length >= 1 && (() => {
                          const q = (prod.newProductName || '').trim().toLowerCase();
                          const seenNames = new Set<string>();
                          const filtered = productsStore.filter(p => {
                            const nameLower = (p.name || '').trim().toLowerCase();
                            if (!nameLower.includes(q)) return false;
                            if (seenNames.has(nameLower)) return false;
                            seenNames.add(nameLower);
                            return true;
                          });
                          if (filtered.length === 0) return null;
                          return (
                            <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                              {filtered.map(p => {
                                const imgUrl = (p.imageUrls && p.imageUrls[0]) || '';
                                const fullImg = imgUrl.startsWith('http') ? imgUrl : (apiUrl && imgUrl ? `${apiUrl}${imgUrl}` : imgUrl);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 dark:hover:bg-primary/20 text-slate-800 dark:text-slate-200 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 flex items-center justify-between gap-2"
                                    onMouseDown={() => {
                                      updateProduct(pIdx, 'newProductName', p.name);
                                      updateProduct(pIdx, 'productId', p.id);
                                      updateProduct(pIdx, 'categoryId', p.categoryId);
                                      updateProduct(pIdx, 'newProductSku', p.sku);
                                      updateProduct(pIdx, 'perfumeType', (p as any).perfumeType || '');
                                      updateProduct(pIdx, 'newProductImageUrls', p.imageUrls || []);
                                      if (p.targetGender) updateProduct(pIdx, 'targetGender', p.targetGender);
                                      ['description', 'tag', 'showTag', 'olfactoryNotes', 'duration', 'intensity', 'family', 'showFeatures'].forEach(f => { if ((p as any)[f] !== undefined) updateProduct(pIdx, f, (p as any)[f]); });
                                      setProductDropdownPIdx(null);
                                    }}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {fullImg && (
                                        <img src={fullImg} alt="" className="size-5 rounded object-cover flex-shrink-0" />
                                      )}
                                      <span className="truncate">{p.name}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 flex-shrink-0">{p.categoryId}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      {isPerfumeCategory(prod.categoryId) && (
                        <select
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-medium h-10"
                          value={prod.perfumeType || ''}
                          onChange={e => updateProduct(pIdx, 'perfumeType', e.target.value)}
                        >
                          <option value="">Tipo de perfume (Opcional / Ninguno)</option>
                          {(perfumeTypesConfig && perfumeTypesConfig.length > 0 ? perfumeTypesConfig : DEFAULT_PERFUME_TYPES).map(pt => (
                            <option key={pt.value} value={pt.value}>
                              {pt.value}{pt.description ? ` (${pt.description})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      {/* SKU oculto según solicitud */}
                      <input type="hidden" value={prod.newProductSku || ''} />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-7 flex flex-col gap-2">
                    <label className="block text-xs font-bold text-slate-500">Imágenes del Producto</label>
                    <div className="flex items-center gap-2.5 w-full border border-slate-200 dark:border-slate-700/60 p-2 rounded-lg bg-white dark:bg-slate-800">
                      {/* Botón Subir Archivo Local */}
                      <label className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors text-xs font-bold whitespace-nowrap cursor-pointer ${prod._uploading ? 'bg-blue-50 border-blue-200 text-blue-600 cursor-wait' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="material-symbols-outlined text-[16px]">{prod._uploading ? 'sync' : 'add_photo_alternate'}</span>
                        {prod._uploading ? 'Subiendo...' : 'Subir'}
                        <input type="file" accept="image/*" multiple disabled={prod._uploading} className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files || []); if (!files.length) return;
                            const token = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
                            if (!token) { showAlert('Sin credenciales de administrador.'); return; }
                            updateProduct(pIdx, '_uploading', true); const uploadedUrls: string[] = [];
                            const uploadEndpoint = apiUrl
                              ? `${apiUrl}/api/admin/product-image?subcategory=${encodeURIComponent(prod.categoryId || 'General')}`
                              : `/api/admin/product-image?subcategory=${encodeURIComponent(prod.categoryId || 'General')}`;
                            for (const file of files) {
                              const fd = new FormData(); fd.append('file', file);
                              try { const r = await fetch(uploadEndpoint, { method: 'POST', headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }, body: fd }); if (r.ok) { const d = await r.json(); uploadedUrls.push(d.url); } else showAlert(`Error subiendo ${file.name}`); } catch { showAlert(`Error de red`); }
                            }
                            updateProduct(pIdx, 'newProductImageUrls', [...(prod.newProductImageUrls || []), ...uploadedUrls]);
                            setMediaLibImages(prev => [
                              ...uploadedUrls.map(u => ({ url: u, filename: u.split('/').pop() || '', category: prod.categoryId || 'General' })),
                              ...prev
                            ]);
                            updateProduct(pIdx, '_uploading', false); e.target.value = '';
                          }}
                        />
                      </label>

                      {/* Botón Buscar en Biblioteca */}
                      <button
                        type="button"
                        onClick={() => openMediaLib(pIdx)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 dark:border-indigo-700/80 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold whitespace-nowrap transition-colors"
                        title="Buscar o elegir imagen en la biblioteca"
                      >
                        <span className="material-symbols-outlined text-[16px]">photo_library</span>
                        Biblioteca
                      </button>

                      {/* Miniaturas de Fotos */}
                      <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 py-0.5">
                        {(prod.newProductImageUrls || []).map((imgUrl, imgIdx) => {
                          const fullImgSrc = imgUrl.startsWith('http') ? imgUrl : (apiUrl ? `${apiUrl}${imgUrl}` : imgUrl);
                          return (
                            <div
                              key={imgIdx}
                              title="Clic sobre la imagen para abrir biblioteca"
                              className="size-9 rounded-lg flex-shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden relative group/img cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:scale-105 transition-all shadow-sm"
                              onClick={() => openMediaLib(pIdx)}
                            >
                              <img src={fullImgSrc} alt="" className="w-full h-full object-cover" />
                              
                              {/* Overlay al hacer hover que muestra el icono de biblioteca */}
                              <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <span className="material-symbols-outlined text-white text-[14px]">photo_library</span>
                              </div>

                              {/* Botón flotante para eliminar foto */}
                              <button
                                type="button"
                                title="Eliminar imagen"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const arr = [...(prod.newProductImageUrls || [])];
                                  arr.splice(imgIdx, 1);
                                  updateProduct(pIdx, 'newProductImageUrls', arr);
                                }}
                                className="absolute top-0 right-0 size-4 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-bl z-10"
                              >
                                <span className="material-symbols-outlined text-[11px] font-bold">close</span>
                              </button>
                            </div>
                          );
                        })}
                        {!(prod.newProductImageUrls || []).length && (
                          <button
                            type="button"
                            onClick={() => openMediaLib(pIdx)}
                            className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 italic self-center cursor-pointer transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20"
                            title="Hacer clic para buscar y elegir de la biblioteca"
                          >
                            <span className="material-symbols-outlined text-[14px]">photo_library</span>
                            Sin fotos aún (clic para buscar en biblioteca)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variantes */}
                <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-500">2. Variantes (Ítem Físico)</label>
                  <div className="space-y-2">
                    {prod.variants.map((variant, vIdx) => {
                      const unitCostARS = (Number(variant.unitPurchasePrice) || 0) * effectiveExchangeRate;
                      const vg = getVariantGroupForCategory(prod.categoryId, categoriesConfig, variantGroupsConfig);
                      return (
                        <div key={vIdx} className="flex flex-wrap md:flex-nowrap items-end gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                          {vg && (
                            <div className="flex-1 min-w-[180px]">
                              <select 
                                className="w-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-900 dark:text-purple-300 font-bold h-10 outline-none focus:ring-2 focus:ring-purple-400" 
                                value={(() => {
                                  if ((variant as any).sizeIndex !== undefined && (variant as any).sizeIndex >= 0 && vg && (variant as any).sizeIndex < vg.options.length) {
                                    return (variant as any).sizeIndex;
                                  }
                                  const foundIdx = vg ? vg.options.findIndex(o => 
                                    variant.size && (variant.size === o.value || variant.size.startsWith(o.value) || (o.description && variant.size.includes(o.description)))
                                  ) : -1;
                                  return foundIdx >= 0 ? foundIdx : 0;
                                })()} 
                                onChange={e => {
                                  const idx = Number(e.target.value);
                                  updateVariant(pIdx, vIdx, 'sizeIndex', idx);
                                  if (vg && vg.options[idx]) {
                                    const opt = vg.options[idx];
                                    updateVariant(pIdx, vIdx, 'size', opt.description ? `${opt.value} - ${opt.description}` : opt.value);
                                  }
                                }}
                              >
                                {vg.options.map((row, rIdx) => <option key={rIdx} value={rIdx}>{row.value} {row.description ? `(${row.description})` : ''}</option>)}
                              </select>
                            </div>
                          )}
                          <div className="flex-1 min-w-[130px]">
                            <input type="text" placeholder="Descripción (ej: Negro/Rosa)" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white h-10" value={(variant as any).description} onChange={e => updateVariant(pIdx, vIdx, 'description', e.target.value)} />
                          </div>
                          <div className="w-[72px]">
                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Stock</label>
                            <input type="number" step="1" min="1" placeholder="1" className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm text-slate-900 dark:text-white font-bold h-9" value={variant.quantity ?? ''} onChange={e => updateVariant(pIdx, vIdx, 'quantity', e.target.value)} />
                          </div>
                          <div className="w-[110px]">
                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Costo ({CURRENCY_SYMBOLS[purchaseCurrency]})</label>
                            <input type="number" step="0.01" min="0" placeholder="0" className="w-full text-center bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/50 rounded-lg px-1 py-1 text-sm text-red-600 font-bold h-9" value={variant.unitPurchasePrice === 0 ? '' : (variant.unitPurchasePrice ?? '')} onChange={e => updateVariant(pIdx, vIdx, 'unitPurchasePrice', e.target.value)} />
                          </div>
                          {purchaseCurrency !== 'ARS' && (
                            <div className="text-xs text-slate-500 whitespace-nowrap self-end pb-2">→ <span className="font-bold text-slate-700 dark:text-slate-300">${fmt(unitCostARS)}</span></div>
                          )}
                          <button onClick={() => removeVariant(pIdx, vIdx)} className={`h-9 px-2 rounded-lg transition-colors flex items-center justify-center ${prod.variants.length > 1 ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-300 opacity-50 cursor-not-allowed'}`} disabled={prod.variants.length <= 1}>
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => addVariant(pIdx)} className="text-sm font-bold text-primary flex items-center gap-1 hover:bg-primary/10 px-3 py-2 rounded-lg w-max transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span> Añadir Variante
                  </button>
                </div>

                {/* Accordion descripción premium */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button type="button" className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors" onClick={() => updateProduct(pIdx, '_showDetails', !(prod as any)._showDetails)}>
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
                      Descripción Premium & Atributos
                      {((prod.tag && prod.showTag) || prod.description || prod.showFeatures) && <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Configurado</span>}
                    </span>
                    <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${(prod as any)._showDetails ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {(prod as any)._showDetails && (
                    <div className="p-4 space-y-5 bg-white dark:bg-slate-800/30">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insignia del Producto</label>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => updateProduct(pIdx, 'showTag', !prod.showTag)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prod.showTag ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${prod.showTag ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Mostrar insignia</span>
                          </div>
                          {prod.showTag && (
                            <select className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-medium" value={prod.tag || 'Alta Demanda'} onChange={e => updateProduct(pIdx, 'tag', e.target.value)}>
                              <option>Alta Demanda</option><option>Recomendado</option><option>Más Vendido</option><option>Nuevo</option><option>Edición Limitada</option><option>Oferta Especial</option>
                            </select>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción Premium</label>
                        <textarea rows={3} placeholder="Ej: Creada con las esencias más puras..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-primary outline-none transition-all" value={prod.description || ''} onChange={e => updateProduct(pIdx, 'description', e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atributos Olfativos</label>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => updateProduct(pIdx, 'showFeatures', !prod.showFeatures)} className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${prod.showFeatures ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${prod.showFeatures ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-xs text-slate-500">{prod.showFeatures ? 'Visible en tienda' : 'Oculto'}</span>
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
                              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="material-symbols-outlined text-[13px]">{icon}</span>{label}</label>
                              <input type="text" placeholder={placeholder} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all" value={(prod as any)[key] || ''} onChange={e => updateProduct(pIdx, key as any, e.target.value)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addProductLine} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-xl">add_circle</span> Añadir nuevo producto a este ingreso
            </button>
          </div>

          {/* PASO 3: Envío */}
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-2xl space-y-4">
            <h3 className="text-sm font-black text-green-800 dark:text-green-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">package_2</span> Paso 3 — Costo de Envío (opcional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Moneda del Envío</label>
                <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white" value={shippingCurrency} onChange={e => setShippingCurrency(e.target.value as Currency)}>
                  <option value="ARS">🇦🇷 Pesos (ARS)</option><option value="USD">🇺🇸 Dólar (USD)</option><option value="BRL">🇧🇷 Real (BRL)</option><option value="PYG">🇵🇾 Guaraní (PYG)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Valor del Envío ({CURRENCY_SYMBOLS[shippingCurrency]})</label>
                <input type="number" step="0.01" min="0" placeholder="0" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-green-700 dark:text-green-400" value={shippingCostOriginal === 0 ? '' : (shippingCostOriginal ?? '')} onChange={e => setShippingCostOriginal(e.target.value)} />
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-400 block">Total Envío en ARS</span>
                <span className="text-lg font-black text-green-700 dark:text-green-400">${fmt(shippingCostARS)}</span>
              </div>
            </div>
          </div>

          {/* Barra totales + CTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="flex gap-6 text-sm">
              {[['Productos', products.length, 'text-slate-800 dark:text-white'], ['Unidades', totalUnidades, 'text-primary'], [`Compra ARS`, `$${fmt(totalCompraARS)}`, 'text-slate-800 dark:text-white'], [`+ Envío`, `$${fmt(shippingCostARS)}`, 'text-green-600']].map(([label, value, cls]) => (
                <div key={String(label)} className="text-center">
                  <span className="text-xs text-slate-400 block font-bold uppercase">{label}</span>
                  <span className={`font-black ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={handleOpenSummary} className="w-full sm:w-auto bg-primary text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined">table_view</span> Ver Resumen y Finalizar →
            </button>
          </div>
        </div>
      )}

      {/* ═══ TAB HISTORIAL ═══ */}
      {activeTab === 'historial' && (() => {
        const filteredBatches = batches.filter(b => {
          if (!searchBatch.trim()) return true;
          const q = searchBatch.toLowerCase();
          return (
            (b.batch_number || '').toLowerCase().includes(q) ||
            (b.supplier_name || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-4">
            {/* Barra superior de Historial: Búsqueda y total */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Buscar por lote o proveedor..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={searchBatch}
                  onChange={e => setSearchBatch(e.target.value)}
                />
                {searchBatch && (
                  <button
                    type="button"
                    onClick={() => setSearchBatch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500 font-bold self-end sm:self-center">
                Total: {filteredBatches.length} {filteredBatches.length === 1 ? 'lote' : 'lotes'}
              </div>
            </div>

            {/* Banner de sincronización si el inventario local está vacío */}
            {productsStore.length === 0 && batches.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">inventory_2</span>
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-emerald-900 dark:text-emerald-200">
                      Lote registrado disponible para cargar al Inventario
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Tu inventario local actualmente está vacío. Podés cargar los {batches[0].items_count || 24} productos de <strong>{batches[0].batch_number} ({batches[0].supplier_name})</strong> directamente con un clic.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => syncBatchToStore(batches[0].id)}
                  disabled={syncingBatchId === batches[0].id}
                  className="whitespace-nowrap px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">{syncingBatchId === batches[0].id ? 'sync' : 'download'}</span>
                  {syncingBatchId === batches[0].id ? 'Cargando...' : 'Cargar al Inventario Ahora'}
                </button>
              </div>
            )}

            {loadingBatches ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>
                Cargando historial...
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <span className="material-symbols-outlined text-5xl block mb-3">inventory_2</span>
                <p className="font-bold">No hay lotes registrados todavía.</p>
                <p className="text-xs mt-1">Podés ingresar tu primera compra desde la pestaña &quot;Nueva Compra&quot;.</p>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-4xl block mb-2">search_off</span>
                <p className="font-bold text-sm">No se encontraron lotes para &quot;{searchBatch}&quot;</p>
                <button
                  type="button"
                  onClick={() => setSearchBatch('')}
                  className="mt-2 text-xs text-primary font-bold hover:underline"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBatches.map(b => (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Fila superior: lote + fecha + acciones */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                          {b.batch_number}
                        </span>
                        {b.purchase_date && (
                          <span className="text-xs text-slate-400 font-medium">
                            {new Date(b.purchase_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {b.supplier_name && (
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            · {b.supplier_name}
                          </span>
                        )}
                      </div>
                      {/* Botones de acción */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => fetchBatchDetail(b.id)}
                          title="Ver detalle del lote"
                          className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditBatch(b.id)}
                          title="Editar lote"
                          className="text-amber-600 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 p-1.5 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => syncBatchToStore(b.id)}
                          disabled={syncingBatchId === b.id}
                          title="Cargar al inventario"
                          className="text-emerald-600 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">{syncingBatchId === b.id ? 'sync' : 'inventory_2'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(b)}
                          title="Eliminar lote"
                          className="text-red-600 hover:bg-red-100/60 dark:hover:bg-red-950/40 p-1.5 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Fila inferior: datos financieros como chips */}
                    <div className="flex flex-wrap gap-2">
                      {/* Cotización destacada - solo si no es ARS */}
                      {b.currency !== 'ARS' && (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600 rounded-xl px-3 py-1.5">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider whitespace-nowrap">💵 1 {b.currency}</span>
                          <span className="text-sm font-black text-amber-700 dark:text-amber-300">${fmt(b.exchange_rate)}</span>
                          <span className="text-[10px] font-bold text-amber-400">ARS</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 rounded-xl px-3 py-1.5">
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Envío</span>
                        <span className="text-xs font-mono font-bold text-green-700 dark:text-green-400">${fmt(b.shipping_cost_ars)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-1.5">
                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">Total ARS</span>
                        <span className="text-xs font-mono font-black text-primary">${fmt(b.total_cost_ars)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 rounded-xl px-3 py-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{b.items_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* MODAL: RESUMEN */}
      {showSummary && (() => {
        const totalUnitsSummary = summaryRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
        const isUSDSummary = purchaseCurrency === 'USD';
        const totalCostOrigSummary = summaryRows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitCostOriginal) || 0), 0);
        const totalCostUSDSummary = isUSDSummary
          ? totalCostOrigSummary
          : (Number(exchangeRate) > 0 ? (totalCompraARS / Number(exchangeRate)) : null);
        const totalCostARSSummary = totalCompraARS;
        const totalCostFinalSummary = totalCompraARS + shippingCostARS;
        const totalSaleValueSummary = summaryRows.reduce((s, r) => {
          const displaySalePrice = r.salePriceConflict === 'keep' ? (r.existingProd?.salePrice || r.salePrice) : r.salePrice;
          return s + (Number(r.quantity) || 0) * (Number(displaySalePrice) || 0);
        }, 0);
        const totalProfitSummary = totalSaleValueSummary - totalCostFinalSummary;
        const marginPctSummary = totalCostFinalSummary > 0 ? (totalProfitSummary / totalCostFinalSummary) * 100 : 0;

        return (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-5xl w-full p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 sm:pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-2xl">receipt_long</span></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Resumen del Ingreso</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Revisá costos, envío proporcional y precios de venta.</p>
                  </div>
                </div>
                <button onClick={() => setShowSummary(false)} className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-xl">close</span></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[['Proveedor', supplierInput || '—'], ['Moneda', purchaseCurrency === 'ARS' ? 'Pesos ARS' : `${purchaseCurrency} → $${fmt(Number(exchangeRate) || 0)}`], ['Total Compra', `$${fmt(totalCompraARS)}`], ['Total + Envío', `$${fmt(totalCompraARS + shippingCostARS)}`]].map(([label, value]) => (
                  <div key={String(label)} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
              {/* Banner de alerta si hay conflictos pendientes */}
              {(() => {
                const pendingCount = summaryRows.filter(r => r.existingProd && Math.abs((r.existingProd.purchasePrice || 0) - r.totalCostPerUnitARS) > 0.01 && r.salePriceConflict === null).length;
                if (pendingCount === 0) return null;
                return (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs font-bold">
                      <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
                      <span>Hay <strong>{pendingCount} producto(s)</strong> con precio diferente al stock anterior. Seleccioná qué hacer con el precio de venta.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const firstIdx = summaryRows.findIndex(r => r.existingProd && Math.abs((r.existingProd.purchasePrice || 0) - r.totalCostPerUnitARS) > 0.01 && r.salePriceConflict === null);
                        if (firstIdx !== -1) setConflictModal({ row: summaryRows[firstIdx], rowIdx: firstIdx });
                      }}
                      className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-sm">tune</span>
                      Resolver conflictos ({pendingCount})
                    </button>
                  </div>
                );
              })()}

              {/* Vista Desktop: Tabla completa */}
              <div className="hidden md:block overflow-auto flex-1">
                <table className="w-full text-xs min-w-[750px]">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="pb-2 pr-3">Producto / Variante</th>
                      <th className="pb-2 pr-3 text-center">Cant.</th>
                      <th className="pb-2 pr-3 text-right">Costo orig.</th>
                      <th className="pb-2 pr-3 text-right">Costo ARS</th>
                      <th className="pb-2 pr-3 text-right">Envío/u</th>
                      <th className="pb-2 pr-3 text-right">Total/u</th>
                      <th className="pb-2 pr-3 text-right font-black text-slate-900 dark:text-white">Total</th>
                      <th className="pb-2 text-right min-w-[130px]">Precio de Venta ✏️</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summaryRows.map((row, idx) => {
                      const hasConflict = !!row.existingProd && Math.abs((row.existingProd.purchasePrice || 0) - row.totalCostPerUnitARS) > 0.01;
                      const displaySalePrice = row.salePriceConflict === 'keep' ? (row.existingProd?.salePrice || row.salePrice) : row.salePrice;
                      return (
                        <tr key={idx} className={hasConflict ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                          <td className="py-2 pr-3">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{row.productName}</p>
                            <p className="text-slate-400">{row.variantLabel}</p>
                            {hasConflict && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                  ⚠ Costo ant: ${fmt(row.existingProd.purchasePrice || 0)}
                                </span>
                                {row.salePriceConflict === null ? (
                                  <button
                                    type="button"
                                    onClick={() => setConflictModal({ row, rowIdx: idx })}
                                    className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-black px-2.5 py-0.5 rounded-lg shadow-sm flex items-center gap-1 transition"
                                  >
                                    <span className="material-symbols-outlined text-xs">tune</span> Resolver
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConflictModal({ row, rowIdx: idx })}
                                    className="text-[10px] bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-lg transition flex items-center gap-1"
                                  >
                                    ✓ {row.salePriceConflict === 'update' ? 'Actualizar Precio de Venta' : row.salePriceConflict === 'keep' ? 'Mantener Precio de Venta' : `Precio de Venta $${fmt(row.customSalePrice)}`} (Cambiar)
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.quantity}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-600 dark:text-slate-400">{purchaseCurrency !== 'ARS' ? `${CURRENCY_SYMBOLS[purchaseCurrency]}${row.unitCostOriginal.toFixed(2)}` : `$${fmt(row.unitCostOriginal)}`}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(row.unitCostARS)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-green-600 dark:text-green-400">${fmt(row.shippingPerUnitARS)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(row.totalCostPerUnitARS)}</td>
                          <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt(row.totalCostPerUnitARS * row.quantity)}</td>
                          <td className="py-2 text-right">
                            <input type="number" step="1" min="0" className={`w-28 text-right bg-white dark:bg-slate-700 border rounded-lg px-2 py-1 text-xs font-black transition-colors ${displaySalePrice > 0 ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 text-slate-600'}`} value={displaySalePrice || ''} onChange={e => { updateSummaryRow(idx, 'salePrice', Number(e.target.value)); if (row.salePriceConflict === 'custom') updateSummaryRow(idx, 'customSalePrice', Number(e.target.value)); }} disabled={row.salePriceConflict === 'keep'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/80 sticky bottom-0">
                    <tr className="font-bold text-xs">
                      <td className="py-2.5 pr-3 text-slate-500 font-bold">Totales ({summaryRows.length} variantes)</td>
                      <td className="py-2.5 pr-3 text-center text-slate-900 dark:text-white font-black">{totalUnitsSummary}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-600 dark:text-slate-300">
                        {purchaseCurrency !== 'ARS' ? `${CURRENCY_SYMBOLS[purchaseCurrency]}${fmtUSD(totalCostOrigSummary)}` : `$${fmt(totalCostOrigSummary)}`}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-900 dark:text-white">${fmt(totalCostARSSummary)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-green-600 font-bold">${fmt(shippingCostARS)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-400">—</td>
                      <td className="py-2.5 pr-3 text-right font-mono font-black text-slate-900 dark:text-white">${fmt(totalCostFinalSummary)}</td>
                      <td className="py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-black">${fmt(totalSaleValueSummary)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Vista Mobile: Tarjetas compactas con Precio de Venta al frente sin scroll horizontal */}
              <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5">
                {summaryRows.map((row, idx) => {
                  const hasConflict = !!row.existingProd && Math.abs((row.existingProd.purchasePrice || 0) - row.totalCostPerUnitARS) > 0.01;
                  const displaySalePrice = row.salePriceConflict === 'keep' ? (row.existingProd?.salePrice || row.salePrice) : row.salePrice;
                  return (
                    <div key={idx} className={`border rounded-2xl p-3.5 space-y-2.5 ${hasConflict ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight">{row.productName}</p>
                          {row.variantLabel && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{row.variantLabel}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">P. Venta ✏️</span>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1 text-xs font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className={`w-28 pl-5 pr-2 py-1 text-right bg-white dark:bg-slate-700 border rounded-xl text-xs font-black transition-colors ${displaySalePrice > 0 ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-600 text-slate-600'}`}
                              value={displaySalePrice || ''}
                              onChange={e => { updateSummaryRow(idx, 'salePrice', Number(e.target.value)); if (row.salePriceConflict === 'custom') updateSummaryRow(idx, 'customSalePrice', Number(e.target.value)); }}
                              disabled={row.salePriceConflict === 'keep'}
                            />
                          </div>
                        </div>
                      </div>

                      {hasConflict && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            ⚠ Costo ant: ${fmt(row.existingProd.purchasePrice || 0)}
                          </span>
                          {row.salePriceConflict === null ? (
                            <button
                              type="button"
                              onClick={() => setConflictModal({ row, rowIdx: idx })}
                              className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-black px-2.5 py-0.5 rounded-lg shadow-sm flex items-center gap-1 transition"
                            >
                              <span className="material-symbols-outlined text-xs">tune</span> Resolver
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConflictModal({ row, rowIdx: idx })}
                              className="text-[10px] bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-lg transition flex items-center gap-1"
                            >
                              ✓ {row.salePriceConflict === 'update' ? 'Actualizar' : row.salePriceConflict === 'keep' ? 'Mantener' : `$${fmt(row.customSalePrice)}`}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-5 gap-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Cant.</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">{row.quantity}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Costo ARS</span>
                          <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">${fmt(row.unitCostARS)}</span>
                        </div>
                        <div className="bg-green-50/80 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-green-600 uppercase block">Envío/u</span>
                          <span className="text-[10px] font-mono font-bold text-green-700 dark:text-green-400">${fmt(row.shippingPerUnitARS)}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Total/u</span>
                          <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">${fmt(row.totalCostPerUnitARS)}</span>
                        </div>
                        <div className="bg-primary/5 dark:bg-primary/20 border border-primary/20 rounded-lg p-1.5">
                          <span className="text-[9px] font-bold text-primary uppercase block">Total</span>
                          <span className="text-[10px] font-mono font-black text-primary">${fmt(row.totalCostPerUnitARS * row.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Panel de Rentabilidad y Proyección Financiera */}
              <div className="bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/40 dark:from-slate-900/60 dark:via-slate-900/60 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">query_stats</span>
                    Proyección de Venta & Rentabilidad del Lote
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                    Si vendés la totalidad de los artículos
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                  {/* 1. Cantidad Total de Artículos */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Artículos</span>
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">{totalUnitsSummary}</span>
                    <span className="text-[10px] text-slate-400 block font-medium">unidades</span>
                  </div>

                  {/* 2. Costo Total en Dólares */}
                  <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Costo en USD</span>
                    <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono leading-tight">
                      {totalCostUSDSummary !== null ? `USD $${fmtUSD(totalCostUSDSummary)}` : `${CURRENCY_SYMBOLS[purchaseCurrency]}${fmtUSD(totalCostOrigSummary)}`}
                    </span>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block font-medium">
                      {purchaseCurrency === 'USD' ? 'costo mercadería' : 'en dólares'}
                    </span>
                  </div>

                  {/* 3. Costo Total en Pesos */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo en Pesos</span>
                    <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono leading-tight">${fmt(totalCostARSSummary)}</span>
                    <span className="text-[10px] text-slate-400 block font-medium">sin flete</span>
                  </div>

                  {/* 4. Costo Total con Flete */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo Total c/Flete</span>
                    <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono leading-tight">${fmt(totalCostFinalSummary)}</span>
                    <span className="text-[10px] text-slate-400 block font-medium">flete incluido</span>
                  </div>

                  {/* 5. Total Precio de Venta */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Total P. Venta</span>
                    <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 font-mono leading-tight">${fmt(totalSaleValueSummary)}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">facturación total</span>
                  </div>

                  {/* 6. Ganancia Neta Proyectada */}
                  <div className="bg-emerald-600 text-white rounded-xl p-2.5 text-center shadow-md shadow-emerald-600/20 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-wider block text-emerald-100">Ganancia Neta</span>
                    <span className="text-base sm:text-lg font-black font-mono leading-tight">
                      {totalProfitSummary >= 0 ? `+$${fmt(totalProfitSummary)}` : `-$${fmt(Math.abs(totalProfitSummary))}`}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-200 block">
                      {marginPctSummary >= 0 ? `+${marginPctSummary.toFixed(1)}% margen` : `${marginPctSummary.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowSummary(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">arrow_back</span> Volver a editar
                </button>
                <button type="button" onClick={handleConfirmSave} disabled={saving} className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">check_circle</span>}
                  {saving ? 'Guardando...' : 'Confirmar Ingreso'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: CONFLICTO DE PRECIO */}
      {conflictModal && (() => {
        const totalConflicts = summaryRows.filter(r => r.existingProd && Math.abs((r.existingProd.purchasePrice || 0) - r.totalCostPerUnitARS) > 0.01).length;
        const currentConflictIdx = summaryRows.filter((r, i) => i <= conflictModal.rowIdx && r.existingProd && Math.abs((r.existingProd.purchasePrice || 0) - r.totalCostPerUnitARS) > 0.01).length;

        const existingStock = conflictModal.row.existingVariant?.stock ?? (conflictModal.row.existingProd?.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) ?? 0);
        const stockUnitsText = existingStock > 0 ? `${existingStock} unidades` : (conflictModal.row.existingVariant?.stock !== undefined ? `${conflictModal.row.existingVariant.stock} unidades` : '0 unidades');

        return (
          <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center text-2xl">🔄</div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-base">
                      Conflicto de Precio {totalConflicts > 1 ? `(${currentConflictIdx} de ${totalConflicts})` : ''}
                    </h4>
                    <p className="text-xs text-slate-500 font-bold">{conflictModal.row.productName} — {conflictModal.row.variantLabel}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setConflictModal(null)} className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Comparativa clara */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Anterior</span>
                    <p className="text-slate-700 dark:text-slate-300 font-bold">{stockUnitsText}</p>
                    <p className="text-slate-500">Costo: <span className="font-bold text-red-500">${fmt(conflictModal.row.existingProd?.purchasePrice || 0)}</span></p>
                    <p className="text-slate-500">Precio de Venta actual: <span className="font-bold text-slate-900 dark:text-white">${fmt(conflictModal.row.existingProd?.salePrice || 0)}</span></p>
                  </div>
                  <div className="space-y-1 bg-amber-100/50 dark:bg-amber-950/40 p-2 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Nuevo Ingreso</span>
                    <p className="text-slate-700 dark:text-slate-300 font-bold">+{conflictModal.row.quantity} unidades</p>
                    <p className="text-slate-500">Costo c/envío: <span className="font-bold text-red-600">${fmt(conflictModal.row.totalCostPerUnitARS)}</span></p>
                    <p className="text-slate-500">Precio de Venta sugerido: <span className="font-bold text-emerald-600">${fmt(conflictModal.row.suggestedSalePrice)}</span></p>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs">
                  El costo de este producto cambió. ¿Cómo querés actualizar el precio de venta?
                </p>
              </div>

              {/* Botones de decisión */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => resolveConflict(conflictModal.rowIdx, 'update', conflictModal.row.suggestedSalePrice)}
                  className="w-full flex items-center gap-3 p-3.5 border-2 border-blue-400/80 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-100/60 dark:bg-blue-950/30 rounded-2xl transition text-left group"
                >
                  <span className="size-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm shrink-0">1</span>
                  <div className="flex-1">
                    <p className="font-black text-slate-900 dark:text-white text-xs">Actualizar todo al nuevo Precio de Venta (${fmt(conflictModal.row.suggestedSalePrice)})</p>
                    <p className="text-[11px] text-slate-500">Tanto las {stockUnitsText} viejas como las nuevas se venderán al nuevo Precio de Venta.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => resolveConflict(conflictModal.rowIdx, 'keep', conflictModal.row.existingProd?.salePrice || conflictModal.row.salePrice)}
                  className="w-full flex items-center gap-3 p-3.5 border-2 border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 rounded-2xl transition text-left group"
                >
                  <span className="size-8 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-sm shrink-0">2</span>
                  <div className="flex-1">
                    <p className="font-black text-slate-900 dark:text-white text-xs">Mantener el Precio de Venta anterior (${fmt(conflictModal.row.existingProd?.salePrice || 0)})</p>
                    <p className="text-[11px] text-slate-500">Se mantiene el Precio de Venta anterior. Solo se suma el stock.</p>
                  </div>
                </button>

                <div className="p-3.5 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="size-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">3</span>
                    <div>
                      <p className="font-black text-slate-900 dark:text-white text-xs">Precio personalizado para todo</p>
                      <p className="text-[11px] text-slate-500">Ingresá un precio unificado para todas las unidades.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ej: 35000"
                      className="flex-1 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-200"
                      value={conflictModal.row.customSalePrice || ''}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setConflictModal(cm => cm ? { ...cm, row: { ...cm.row, customSalePrice: val } } : null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => resolveConflict(conflictModal.rowIdx, 'custom', conflictModal.row.customSalePrice, conflictModal.row.customSalePrice)}
                      disabled={!conflictModal.row.customSalePrice || conflictModal.row.customSalePrice <= 0}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs disabled:opacity-40 transition shadow"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: DETALLE DE LOTE */}
      {(detailBatch || loadingDetail) && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-5xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>
                Cargando detalle...
              </div>
            ) : detailBatch && (() => {
              const items = detailBatch.items || [];
              const totalUnits = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
              const isUSD = detailBatch.currency === 'USD';
              const totalCostOrig = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost_original) || 0), 0);
              const totalCostUSD = isUSD 
                ? totalCostOrig 
                : (detailBatch.exchange_rate && Number(detailBatch.exchange_rate) > 0 
                    ? (Number(detailBatch.total_products_ars) || 0) / Number(detailBatch.exchange_rate) 
                    : null);
              const totalCostARS = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost_ars) || 0), 0);
              const totalShippingARS = Number(detailBatch.shipping_cost_ars) || 0;
              const totalCostFinal = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.total_cost_per_unit_ars) || 0), 0);
              const totalSaleValue = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.sale_price) || 0), 0);
              const totalProfit = totalSaleValue - totalCostFinal;
              const marginPct = totalCostFinal > 0 ? (totalProfit / totalCostFinal) * 100 : 0;

              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 sm:pb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">{detailBatch.batch_number}</h3>
                      <p className="text-xs text-slate-500">
                        {detailBatch.supplier_name ? `${detailBatch.supplier_name} • ` : ''}
                        {detailBatch.purchase_date ? new Date(detailBatch.purchase_date).toLocaleDateString('es-AR') : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setDetailBatch(null)}
                      className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                  </div>

                  {/* Stat cards: 2 filas de 2 en mobile con el mismo tamaño exacto */}
                  <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${detailBatch.currency !== 'ARS' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                    {/* Cotización del dólar — mismo tamaño que los demás recuadros */}
                    {detailBatch.currency !== 'ARS' && (
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-center flex flex-col justify-center min-h-[68px]">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">💵 Cotiz. {detailBatch.currency}</span>
                        <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300">${fmt(detailBatch.exchange_rate)}</span>
                      </div>
                    )}
                    {[['Total Productos', `$${fmt(detailBatch.total_products_ars)}`], ['Costo Envío', `$${fmt(detailBatch.shipping_cost_ars)}`], ['Total Lote', `$${fmt(detailBatch.total_cost_ars)}`]].map(([label, value]) => (
                      <div key={String(label)} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center flex flex-col justify-center min-h-[68px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Items: Vista Desktop (Tabla espaciosa donde todo cabe sin scroll horizontal) */}
                  <div className="hidden md:block flex-1 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <th className="pb-2.5 pr-3">Producto / Variante</th>
                          <th className="pb-2.5 pr-3 text-center">Cant.</th>
                          <th className="pb-2.5 pr-3 text-right">Costo orig.</th>
                          <th className="pb-2.5 pr-3 text-right">Costo ARS</th>
                          <th className="pb-2.5 pr-3 text-right">Envío/u</th>
                          <th className="pb-2.5 pr-3 text-right">Total/u</th>
                          <th className="pb-2.5 pr-3 text-right font-black text-slate-900 dark:text-white">Total</th>
                          <th className="pb-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">Precio de Venta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map((it: any) => (
                          <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                            <td className="py-2.5 pr-3">
                              <p className="font-bold text-slate-800 dark:text-slate-200">{it.product_name}</p>
                              {it.variant_label && (
                                <p className="text-slate-400 text-[11px]">{it.variant_label}</p>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-center font-bold text-slate-700 dark:text-slate-300">{it.quantity}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-slate-500">
                              {detailBatch.currency !== 'ARS'
                                ? `${CURRENCY_SYMBOLS[detailBatch.currency as Currency]}${Number(it.unit_cost_original).toFixed(2)}`
                                : `$${fmt(it.unit_cost_original)}`}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(it.unit_cost_ars)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-green-600 font-bold">${fmt(it.shipping_per_unit_ars)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(it.total_cost_per_unit_ars)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt(it.total_cost_per_unit_ars * it.quantity)}</td>
                            <td className="py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1 inline-block">
                                ${fmt(it.sale_price)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 sticky bottom-0">
                        <tr className="font-bold text-xs">
                          <td className="py-2.5 pr-3 text-slate-500 font-bold">
                            Totales ({items.length} variantes)
                          </td>
                          <td className="py-2.5 pr-3 text-center text-slate-900 dark:text-white font-black">
                            {totalUnits}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-600 dark:text-slate-300">
                            {detailBatch.currency !== 'ARS'
                              ? `${CURRENCY_SYMBOLS[detailBatch.currency as Currency] || ''}${fmtUSD(totalCostOrig)}`
                              : `$${fmt(totalCostOrig)}`}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-900 dark:text-white">
                            ${fmt(totalCostARS)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-green-600 font-bold">
                            ${fmt(totalShippingARS)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-400">
                            —
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            ${fmt(totalCostFinal)}
                          </td>
                          <td className="py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            ${fmt(totalSaleValue)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Items: Vista Mobile (Tarjetas con Precio de Venta al frente y visible sin scroll) */}
                  <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                    {items.map((it: any) => (
                      <div key={it.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                        {/* Cabecera de la tarjeta: Nombre a la izquierda y Precio de Venta destacado a la derecha */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight">{it.product_name}</p>
                            {it.variant_label && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{it.variant_label}</p>
                            )}
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 rounded-xl px-2.5 py-1 text-right flex-shrink-0">
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">P. Venta</span>
                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">${fmt(it.sale_price)}</span>
                          </div>
                        </div>

                        {/* Desglose de costos en 5 columnas compactas */}
                        <div className="grid grid-cols-5 gap-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Cant.</span>
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{it.quantity}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Costo ARS</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">${fmt(it.unit_cost_ars)}</span>
                          </div>
                          <div className="bg-green-50/80 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-1.5">
                            <span className="text-[9px] font-bold text-green-600 uppercase block">Envío/u</span>
                            <span className="text-[10px] font-mono font-bold text-green-700 dark:text-green-400">${fmt(it.shipping_per_unit_ars)}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Total/u</span>
                            <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">${fmt(it.total_cost_per_unit_ars)}</span>
                          </div>
                          <div className="bg-primary/5 dark:bg-primary/20 border border-primary/20 rounded-lg p-1.5">
                            <span className="text-[9px] font-bold text-primary uppercase block">Total</span>
                            <span className="text-[10px] font-mono font-black text-primary">${fmt(it.total_cost_per_unit_ars * it.quantity)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Panel de Rentabilidad y Proyección Financiera */}
                  <div className="bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/40 dark:from-slate-900/60 dark:via-slate-900/60 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">query_stats</span>
                        Proyección de Venta & Rentabilidad del Lote
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                        Si vendés la totalidad de los artículos
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                      {/* 1. Cantidad Total de Artículos */}
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Artículos</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">{totalUnits}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">unidades</span>
                      </div>

                      {/* 2. Costo Total en Dólares */}
                      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Costo en USD</span>
                        <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono leading-tight">
                          {totalCostUSD !== null ? `USD $${fmtUSD(totalCostUSD)}` : `${CURRENCY_SYMBOLS[detailBatch.currency as Currency] || ''}${fmtUSD(totalCostOrig)}`}
                        </span>
                        <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block font-medium">
                          {detailBatch.currency === 'USD' ? 'costo mercadería' : 'en dólares'}
                        </span>
                      </div>

                      {/* 3. Costo Total en Pesos */}
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo en Pesos</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono leading-tight">${fmt(totalCostARS)}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">sin flete</span>
                      </div>

                      {/* 4. Costo Total con Flete */}
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo Total c/Flete</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono leading-tight">${fmt(totalCostFinal)}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">flete incluido</span>
                      </div>

                      {/* 5. Total Precio de Venta */}
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Total P. Venta</span>
                        <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 font-mono leading-tight">${fmt(totalSaleValue)}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">facturación total</span>
                      </div>

                      {/* 6. Ganancia Neta Proyectada */}
                      <div className="bg-emerald-600 text-white rounded-xl p-2.5 text-center shadow-md shadow-emerald-600/20 flex flex-col justify-center">
                        <span className="text-[10px] font-black uppercase tracking-wider block text-emerald-100">Ganancia Neta</span>
                        <span className="text-base sm:text-lg font-black font-mono leading-tight">
                          {totalProfit >= 0 ? `+$${fmt(totalProfit)}` : `-$${fmt(Math.abs(totalProfit))}`}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-200 block">
                          {marginPct >= 0 ? `+${marginPct.toFixed(1)}% margen` : `${marginPct.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const b = detailBatch;
                          setDetailBatch(null);
                          openEditBatch(b.id);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span> Editar este lote
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const b = detailBatch;
                          setDetailBatch(null);
                          openDeleteModal(b);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span> Eliminar lote
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailBatch(null)}
                      className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: ELIMINAR LOTE */}
      {deleteModalBatch && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/50 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">delete_forever</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    Eliminar Lote {deleteModalBatch.batch_number}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    {deleteModalBatch.supplier_name ? `${deleteModalBatch.supplier_name} • ` : ''}
                    {deleteModalBatch.purchase_date ? new Date(deleteModalBatch.purchase_date).toLocaleDateString('es-AR') : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalBatch(null)}
                disabled={deletingBatch}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 space-y-2 text-xs text-red-800 dark:text-red-300">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-base">warning</span>
                ¿Estás seguro de que querés eliminar este lote?
              </p>
              <p>
                Esta acción borrará el registro de la compra y <strong>descontará automáticamente del stock</strong> todas las unidades que fueron ingresadas con este lote.
              </p>
            </div>

            {/* Lista de productos que se descontarán del stock */}
            {deleteModalBatch.items && deleteModalBatch.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Unidades que se descontarán del stock:
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {deleteModalBatch.items.map((it: any, idx: number) => (
                    <div key={it.id || idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{it.product_name}</p>
                        <p className="text-[11px] text-slate-400">{it.variant_label}</p>
                      </div>
                      <span className="font-mono font-black text-red-600 dark:text-red-400 bg-red-100/70 dark:bg-red-950/60 px-2 py-0.5 rounded-lg text-xs">
                        -{it.quantity} u.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDeleteModalBatch(null)}
                disabled={deletingBatch}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBatch}
                disabled={deletingBatch}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition flex items-center gap-1.5 disabled:opacity-60"
              >
                {deletingBatch ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                    Eliminar y descontar del stock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR LOTE */}
      {(editModalBatch || loadingEditBatch) && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {loadingEditBatch ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>
                Cargando datos del lote...
              </div>
            ) : editModalBatch && (() => {
              const editItems = editModalBatch.items || [];
              const editTotalUnits = editItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
              const isUSDEdit = editModalBatch.currency === 'USD';
              const editTotalCostOrig = editItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost_original) || 0), 0);
              const editTotalCostARS = editItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost_ars) || 0), 0);
              const editTotalCostUSD = isUSDEdit 
                ? editTotalCostOrig 
                : (editModalBatch.exchange_rate && Number(editModalBatch.exchange_rate) > 0 
                    ? (editTotalCostARS / Number(editModalBatch.exchange_rate)) 
                    : null);
              const editTotalShippingARS = Number(editModalBatch.shipping_cost_ars) || 0;
              const editTotalCostFinal = editItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.total_cost_per_unit_ars) || 0), 0);
              const editTotalSaleValue = editItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.sale_price) || 0), 0);
              const editTotalProfit = editTotalSaleValue - editTotalCostFinal;
              const editMarginPct = editTotalCostFinal > 0 ? (editTotalProfit / editTotalCostFinal) * 100 : 0;

              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">edit_note</span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          Editar Lote {editModalBatch.batch_number}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Modificá proveedor, fecha, notas, cantidades de stock y Precio de Venta.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditModalBatch(null)}
                      disabled={savingEditBatch}
                      className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  {/* Cabecera de edición */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Proveedor / Tienda</label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                        value={editModalBatch.supplier_name}
                        onChange={e => setEditModalBatch({ ...editModalBatch, supplier_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha de Compra</label>
                      <input
                        type="date"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                        value={editModalBatch.purchase_date}
                        onChange={e => setEditModalBatch({ ...editModalBatch, purchase_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Notas / Observaciones</label>
                      <input
                        type="text"
                        placeholder="Opcional..."
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                        value={editModalBatch.notes}
                        onChange={e => setEditModalBatch({ ...editModalBatch, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Tabla de ítems a editar */}
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <th className="pb-2 pr-3">Producto / Variante</th>
                          <th className="pb-2 pr-3 text-center w-28">Cantidad</th>
                          <th className="pb-2 pr-3 text-right">Costo ARS</th>
                          <th className="pb-2 pr-3 text-right">Envío/u</th>
                          <th className="pb-2 pr-3 text-right">Total/u</th>
                          <th className="pb-2 pr-3 text-right font-black text-slate-900 dark:text-white">Total</th>
                          <th className="pb-2 text-right w-36">Precio de Venta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {editItems.map((it: any, idx: number) => {
                          const delta = (Number(it.quantity) || 0) - it.original_quantity;
                          return (
                            <tr key={it.id || idx}>
                              <td className="py-2.5 pr-3">
                                <p className="font-bold text-slate-800 dark:text-slate-200">{it.product_name}</p>
                                <p className="text-slate-400">{it.variant_label}</p>
                              </td>
                              <td className="py-2.5 pr-3 text-center">
                                <div className="flex flex-col items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-20 text-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white"
                                    value={it.quantity ?? ''}
                                    onChange={e => updateEditItem(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                                  />
                                  {delta !== 0 && (
                                    <span className={`text-[10px] font-bold mt-0.5 ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      {delta > 0 ? `+${delta}` : delta} stock
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                ${fmt(it.unit_cost_ars)}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono text-green-600">
                                ${fmt(it.shipping_per_unit_ars)}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                ${fmt(it.total_cost_per_unit_ars)}
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                ${fmt(it.total_cost_per_unit_ars * (Number(it.quantity) || 0))}
                              </td>
                              <td className="py-2.5 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="w-28 text-right bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg px-2 py-1 text-xs font-black"
                                  value={it.sale_price ?? ''}
                                  onChange={e => updateEditItem(idx, 'sale_price', e.target.value === '' ? 0 : Number(e.target.value))}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 sticky bottom-0">
                        <tr className="font-bold text-xs">
                          <td className="py-2.5 pr-3 text-slate-500 font-bold">
                            Totales ({editItems.length} variantes)
                          </td>
                          <td className="py-2.5 pr-3 text-center text-slate-900 dark:text-white font-black">
                            {editTotalUnits}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-900 dark:text-white">
                            ${fmt(editTotalCostARS)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-green-600 font-bold">
                            ${fmt(editTotalShippingARS)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-400">
                            —
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            ${fmt(editTotalCostFinal)}
                          </td>
                          <td className="py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            ${fmt(editTotalSaleValue)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Panel de Rentabilidad y Proyección Financiera */}
                  <div className="bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/40 dark:from-slate-900/60 dark:via-slate-900/60 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">query_stats</span>
                        Proyección de Venta & Rentabilidad del Lote
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                        Valores calculados con cambios actuales
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Artículos</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">{editTotalUnits}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">unidades</span>
                      </div>
                      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Costo en USD</span>
                        <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono leading-tight">
                          {editTotalCostUSD !== null ? `USD $${fmtUSD(editTotalCostUSD)}` : '—'}
                        </span>
                        <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block font-medium">
                          {editModalBatch.currency === 'USD' ? 'costo mercadería' : 'en dólares'}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo en Pesos</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono leading-tight">${fmt(editTotalCostARS)}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">sin flete</span>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo Total c/Flete</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono leading-tight">${fmt(editTotalCostFinal)}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">flete incluido</span>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Total P. Venta</span>
                        <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 font-mono leading-tight">${fmt(editTotalSaleValue)}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">facturación total</span>
                      </div>
                      <div className="bg-emerald-600 text-white rounded-xl p-2.5 text-center shadow-md shadow-emerald-600/20 flex flex-col justify-center">
                        <span className="text-[10px] font-black uppercase tracking-wider block text-emerald-100">Ganancia Neta</span>
                        <span className="text-base sm:text-lg font-black font-mono leading-tight">
                          {editTotalProfit >= 0 ? `+$${fmt(editTotalProfit)}` : `-$${fmt(Math.abs(editTotalProfit))}`}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-200 block">
                          {editMarginPct >= 0 ? `+${editMarginPct.toFixed(1)}% margen` : `${editMarginPct.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-500">
                      Los cambios de cantidad ajustarán el stock inmediatamente.
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditModalBatch(null)}
                        disabled={savingEditBatch}
                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditBatch}
                        disabled={savingEditBatch}
                        className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-lg shadow-primary/25 transition flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {savingEditBatch ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">save</span>
                            Guardar Cambios
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* MODAL: CONFIRMAR ELIMINAR DATOS (BORRADOR) */}
      {showClearDraftModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/50 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">delete_sweep</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    ¿Eliminar todos los datos?
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    Ingreso de mercadería en curso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearDraftModal(false)}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 space-y-2 text-xs text-red-800 dark:text-red-300">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-base">warning</span>
                ¿Estás seguro de que querés resetear este formulario?
              </p>
              <p>
                Se borrarán todos los productos, variantes, costos, proveedor y datos ingresados en este borrador. Esta acción no se puede deshacer y el formulario quedará completamente limpio.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowClearDraftModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">delete_sweep</span>
                Sí, eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BIBLIOTECA DE MEDIOS / IMÁGENES */}
      {mediaLibTargetPIdx !== null && products[mediaLibTargetPIdx] && (
        <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">photo_library</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      Biblioteca de Imágenes
                    </h3>
                    {mediaLibImages.length > 0 && (
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                        {mediaLibImages.length} fotos
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Asignando a: <strong className="text-slate-700 dark:text-slate-300">{products[mediaLibTargetPIdx].newProductName || `Producto #${mediaLibTargetPIdx + 1}`}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openMediaLib(mediaLibTargetPIdx, true)}
                  title="Recargar biblioteca"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaLibTargetPIdx(null)}
                  className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  value={mediaLibSearch}
                  onChange={e => setMediaLibSearch(e.target.value)}
                  placeholder="Buscar imagen por nombre..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800 dark:text-slate-100"
                />
                {mediaLibSearch && (
                  <button
                    type="button"
                    onClick={() => setMediaLibSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Categorías si existen */}
              {mediaLibCategories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedMediaCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedMediaCategory === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Todas
                  </button>
                  {mediaLibCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedMediaCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                        selectedMediaCategory === cat
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid de Imágenes */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40 min-h-[280px]">
              {mediaLibLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-3xl text-indigo-500">progress_activity</span>
                  <p className="text-sm font-medium">Cargando biblioteca de imágenes...</p>
                </div>
              ) : mediaLibImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                  <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">photo_library</span>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hay imágenes en la biblioteca</p>
                  <p className="text-xs text-slate-400">Podés subir imágenes con el botón Subir o en el módulo de Biblioteca.</p>
                </div>
              ) : (() => {
                const targetProd = products[mediaLibTargetPIdx];
                const selectedUrls = targetProd?.newProductImageUrls || [];

                const filtered = mediaLibImages.filter(item => {
                  const matchesSearch = !mediaLibSearch.trim() || item.filename.toLowerCase().includes(mediaLibSearch.toLowerCase()) || item.url.toLowerCase().includes(mediaLibSearch.toLowerCase());
                  const matchesCat = selectedMediaCategory === 'all' || item.category === selectedMediaCategory;
                  return matchesSearch && matchesCat;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                      <span className="material-symbols-outlined text-4xl">search_off</span>
                      <p className="text-sm font-bold">No se encontraron imágenes</p>
                      <p className="text-xs">Probá con otro término de búsqueda.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
                    {filtered.map((item, idx) => {
                      const fullUrl = item.url.startsWith('http') ? item.url : (apiUrl ? `${apiUrl}${item.url}` : item.url);
                      const isSelected = selectedUrls.includes(item.url);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleProductImage(mediaLibTargetPIdx, item.url)}
                          className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-500 shadow-md scale-[0.98]'
                              : 'border-transparent bg-white dark:bg-slate-800 hover:border-indigo-400 hover:shadow-lg hover:scale-[1.03]'
                          }`}
                        >
                          <img
                            src={fullUrl}
                            alt={item.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />

                          {/* Gradient & Filename */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] text-white font-medium truncate text-center">
                              {item.filename}
                            </p>
                          </div>

                          {/* Estado de Selección */}
                          {isSelected ? (
                            <div className="absolute inset-0 bg-indigo-600/30 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1">
                              <span className="material-symbols-outlined text-white text-2xl drop-shadow">check_circle</span>
                              <span className="text-[10px] font-black uppercase tracking-wider text-white bg-indigo-600 px-1.5 py-0.5 rounded shadow">
                                Elegida
                              </span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="material-symbols-outlined text-white text-2xl drop-shadow opacity-90">add_circle</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs text-slate-500 font-medium">
                {products[mediaLibTargetPIdx]?.newProductImageUrls?.length || 0} imagen(es) seleccionada(s) para este producto.
              </div>
              <button
                type="button"
                onClick={() => setMediaLibTargetPIdx(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check</span>
                Listo
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
