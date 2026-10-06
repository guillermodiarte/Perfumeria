'use client';
import { useState, useEffect, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';

type Currency = 'ARS' | 'USD' | 'BRL' | 'PYG';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'USD $',
  BRL: 'R$',
  PYG: '₲',
};

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');

export default function ComprasView({ showAlert, apiKey, apiUrl }: { showAlert: (msg: string) => void; apiKey: string; apiUrl: string }) {
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const registerPurchaseBatch = useStockFlowStore(s => s.registerPurchaseBatch);
  const productsStore = useStockFlowStore(s => s.products);
  const { categoriesConfig, variantGroupsConfig } = useStockFlowStore();

  // TABS
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');

  // PASO 1
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>('ARS');
  const [exchangeRate, setExchangeRate] = useState<number | string>(1);
  const [supplierInput, setSupplierInput] = useState('');
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

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
    newProductName: '', newProductSku: '',
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
  const [detailBatch, setDetailBatch] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Autocomplete proveedores
  const fetchSuppliers = useCallback(async () => {
    if (!apiKey) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/suppliers`, { headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } });
      if (res.ok) { const data = await res.json(); setSupplierSuggestions(data.map((s: any) => s.name)); }
    } catch { }
  }, [apiKey, apiUrl]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const fetchBatches = useCallback(async () => {
    if (!apiKey) return;
    setLoadingBatches(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches?limit=100`, { headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } });
      if (res.ok) { const data = await res.json(); setBatches(data.batches || []); }
    } catch { } finally { setLoadingBatches(false); }
  }, [apiKey, apiUrl]);

  useEffect(() => { if (activeTab === 'historial') fetchBatches(); }, [activeTab, fetchBatches]);

  const fetchBatchDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${id}`, { headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } });
      if (res.ok) setDetailBatch(await res.json());
    } catch { } finally { setLoadingDetail(false); }
  };

  const handleOpenSummary = () => {
    if (products.some(p => !p.newProductName?.trim())) { showAlert('Completá el nombre de todos los productos.'); return; }
    if (allVariants.some(v => !v.quantity || Number(v.quantity) <= 0)) { showAlert('Todas las variantes deben tener cantidad > 0.'); return; }
    if (purchaseCurrency !== 'ARS' && (!exchangeRate || Number(exchangeRate) <= 0)) { showAlert(`Ingresá la cotización del ${purchaseCurrency} en pesos.`); return; }

    const rows: SummaryRow[] = [];
    products.forEach((prod, pIdx) => {
      const group = categoriesConfig.find(g => g.opciones.includes(prod.categoryId));
      const variantGroup = (group && group.variantGroupId !== 'none') ? variantGroupsConfig.find(vg => vg.id === group.variantGroupId) : null;
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
          return { productId: prod.productId, variantId: `v-new`, productName: row.productName, variantLabel: row.variantLabel, size: row.variantLabel.split(' –')[0].trim(), color: (row.variantLabel.split(' – ')[1] || ''), quantity: row.quantity, unitCostOriginal: row.unitCostOriginal, unitCostARS: row.unitCostARS, shippingPerUnitARS: row.shippingPerUnitARS, totalCostPerUnitARS: row.totalCostPerUnitARS, salePrice: finalSalePrice, newProductName: prod.newProductName, newProductSku: prod.newProductSku, categoryId: prod.categoryId, targetGender: prod.targetGender, newProductImageUrls: prod.newProductImageUrls, description: prod.description || undefined, tag: prod.tag || undefined, showTag: prod.showTag, olfactoryNotes: prod.olfactoryNotes || undefined, duration: prod.duration || undefined, intensity: prod.intensity || undefined, family: prod.family || undefined, showFeatures: prod.showFeatures, salePriceConflict: row.salePriceConflict === null ? undefined : row.salePriceConflict, customSalePrice: row.customSalePrice };
        }),
      });

      showAlert(`✅ Lote ${saved.batch_number} guardado con éxito.`);
      setProducts([createEmptyProduct()]); setShippingCostOriginal(0); setSupplierInput(''); setPurchaseDate(new Date().toISOString().split('T')[0]); setShowSummary(false);
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
        <div className="flex gap-2">
          {(['nueva', 'historial'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <span className="material-symbols-outlined text-lg">{tab === 'nueva' ? 'add_circle' : 'history'}</span>
              {tab === 'nueva' ? 'Nueva Compra' : 'Historial'}
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
                <input type="text" placeholder="Ej: Tienda de Brazil..." className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={supplierInput} onChange={e => { setSupplierInput(e.target.value); setShowSuggestions(true); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} onFocus={() => setShowSuggestions(true)} />
                {showSuggestions && supplierSuggestions.filter(s => s.toLowerCase().includes(supplierInput.toLowerCase())).length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
                    {supplierSuggestions.filter(s => s.toLowerCase().includes(supplierInput.toLowerCase())).map(s => (
                      <button key={s} className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 text-slate-800 dark:text-slate-200" onMouseDown={() => { setSupplierInput(s); setShowSuggestions(false); }}>{s}</button>
                    ))}
                  </div>
                )}
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
                      </select>
                      <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold h-10" value={prod.targetGender || 'Unisex'} onChange={e => updateProduct(pIdx, 'targetGender', e.target.value)}>
                        <option value="Unisex">Unisex</option><option value="Mujer">Mujer</option><option value="Hombre">Hombre</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input list={`pnames-${pIdx}`} placeholder="Nombre de Producto" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={prod.newProductName}
                        onChange={e => {
                          const val = e.target.value; updateProduct(pIdx, 'newProductName', val);
                          const ex = productsStore.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                          if (ex) {
                            updateProduct(pIdx, 'productId', ex.id); updateProduct(pIdx, 'categoryId', ex.categoryId); updateProduct(pIdx, 'newProductSku', ex.sku); updateProduct(pIdx, 'newProductImageUrls', ex.imageUrls || []);
                            if (ex.targetGender) updateProduct(pIdx, 'targetGender', ex.targetGender);
                            ['description', 'tag', 'showTag', 'olfactoryNotes', 'duration', 'intensity', 'family', 'showFeatures'].forEach(f => { if ((ex as any)[f] !== undefined) updateProduct(pIdx, f, (ex as any)[f]); });
                          } else if (!prod.productId || !prod.productId.startsWith('NEW-')) { updateProduct(pIdx, 'productId', `NEW-${Date.now()}-${pIdx}`); }
                        }}
                      />
                      <datalist id={`pnames-${pIdx}`}>{productsStore.map(p => <option key={p.id} value={p.name} />)}</datalist>
                      <input placeholder="SKU (Opcional)" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={prod.newProductSku} onChange={e => updateProduct(pIdx, 'newProductSku', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-7 flex flex-col gap-2">
                    <label className="block text-xs font-bold text-slate-500">Imágenes del Producto</label>
                    <div className="flex items-center gap-3 w-full border border-slate-200 dark:border-slate-700/60 p-2 rounded-lg bg-white dark:bg-slate-800">
                      <label className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-colors text-xs font-bold whitespace-nowrap cursor-pointer ${prod._uploading ? 'bg-blue-50 border-blue-200 text-blue-600 cursor-wait' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="material-symbols-outlined text-[16px]">{prod._uploading ? 'sync' : 'add_photo_alternate'}</span>
                        {prod._uploading ? 'Subiendo...' : 'Subir'}
                        <input type="file" accept="image/*" multiple disabled={prod._uploading} className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files || []); if (!files.length) return; if (!apiKey) { showAlert('Sin conexión.'); return; }
                            updateProduct(pIdx, '_uploading', true); const uploadedUrls: string[] = [];
                            for (const file of files) {
                              const fd = new FormData(); fd.append('file', file);
                              try { const r = await fetch(`${apiUrl}/api/admin/product-image?subcategory=${encodeURIComponent(prod.categoryId)}`, { method: 'POST', headers: { 'X-API-KEY': apiKey }, body: fd }); if (r.ok) { const d = await r.json(); uploadedUrls.push(d.url); } else showAlert(`Error subiendo ${file.name}`); } catch { showAlert(`Error de red`); }
                            }
                            updateProduct(pIdx, 'newProductImageUrls', [...(prod.newProductImageUrls || []), ...uploadedUrls]); updateProduct(pIdx, '_uploading', false); e.target.value = '';
                          }}
                        />
                      </label>
                      <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
                        {(prod.newProductImageUrls || []).map((imgUrl, imgIdx) => (
                          <div key={imgIdx} className="size-8 rounded-md flex-shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden relative group/img cursor-pointer" onClick={() => { const arr = [...prod.newProductImageUrls]; arr.splice(imgIdx, 1); updateProduct(pIdx, 'newProductImageUrls', arr); }}>
                            <img src={imgUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"><span className="material-symbols-outlined text-white text-[12px]">close</span></div>
                          </div>
                        ))}
                        {!(prod.newProductImageUrls || []).length && <p className="text-xs text-slate-400 italic self-center">Sin fotos aún</p>}
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
                      const group = categoriesConfig.find(g => g.opciones.includes(prod.categoryId));
                      const vg = group && group.variantGroupId !== 'none' ? variantGroupsConfig.find(v => v.id === group.variantGroupId) : null;
                      return (
                        <div key={vIdx} className="flex flex-wrap md:flex-nowrap items-end gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                          {vg && (
                            <div className="flex-1 min-w-[180px]">
                              <select className="w-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-900 dark:text-purple-300 font-bold h-10" value={(variant as any).sizeIndex || 0} onChange={e => updateVariant(pIdx, vIdx, 'sizeIndex', Number(e.target.value))}>
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
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {loadingBatches ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>Cargando historial...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-16 text-slate-400"><span className="material-symbols-outlined text-5xl block mb-3">inventory_2</span><p className="font-bold">No hay lotes registrados todavía.</p></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60">
                  <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {['Lote', 'Fecha', 'Proveedor', 'Moneda', 'Cotización', 'Envío', 'Total ARS', 'Items', 'Ver'].map(h => (
                      <th key={h} className={`px-4 py-3 ${['Cotización', 'Envío', 'Total ARS'].includes(h) ? 'text-right' : h === 'Moneda' || h === 'Items' || h === 'Ver' ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {batches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{b.batch_number}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{b.purchase_date ? new Date(b.purchase_date).toLocaleDateString('es-AR') : '—'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{b.supplier_name || <span className="text-slate-400 italic">—</span>}</td>
                      <td className="px-4 py-3 text-center"><span className="inline-block bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-bold text-slate-700 dark:text-slate-300">{b.currency}</span></td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{b.currency === 'ARS' ? '—' : `$${fmt(b.exchange_rate)}`}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-700 dark:text-green-400">${fmt(b.shipping_cost_ars)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900 dark:text-white">${fmt(b.total_cost_ars)}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400">{b.items_count}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => fetchBatchDetail(b.id)} className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-lg">visibility</span></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: RESUMEN */}
      {showSummary && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-5xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
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

            <div className="overflow-auto flex-1">
              <table className="w-full text-xs min-w-[800px]">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-2 pr-3">Producto / Variante</th>
                    <th className="pb-2 pr-3 text-center">Cant.</th>
                    <th className="pb-2 pr-3 text-right">Costo orig.</th>
                    <th className="pb-2 pr-3 text-right">Costo ARS</th>
                    <th className="pb-2 pr-3 text-right">Envío/u</th>
                    <th className="pb-2 pr-3 text-right">Total/u</th>
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
                        <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt(row.totalCostPerUnitARS)}</td>
                        <td className="py-2 text-right">
                          <input type="number" step="1" min="0" className={`w-28 text-right bg-white dark:bg-slate-700 border rounded-lg px-2 py-1 text-xs font-black transition-colors ${displaySalePrice > 0 ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 text-slate-600'}`} value={displaySalePrice || ''} onChange={e => { updateSummaryRow(idx, 'salePrice', Number(e.target.value)); if (row.salePriceConflict === 'custom') updateSummaryRow(idx, 'customSalePrice', Number(e.target.value)); }} disabled={row.salePriceConflict === 'keep'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 dark:border-slate-600">
                  <tr className="font-bold text-xs">
                    <td className="pt-3 pr-3 text-slate-500">{summaryRows.length} variante(s)</td>
                    <td className="pt-3 pr-3 text-center text-slate-900 dark:text-white">{summaryRows.reduce((s, r) => s + r.quantity, 0)}</td>
                    <td></td>
                    <td className="pt-3 pr-3 text-right font-mono text-slate-900 dark:text-white">${fmt(summaryRows.reduce((s, r) => s + r.unitCostARS * r.quantity, 0))}</td>
                    <td className="pt-3 pr-3 text-right font-mono text-green-600">${fmt(shippingCostARS)}</td>
                    <td className="pt-3 pr-3 text-right font-mono text-slate-900 dark:text-white">${fmt(summaryRows.reduce((s, r) => s + r.totalCostPerUnitARS * r.quantity, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
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
      )}

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
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailBatch(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-16 text-slate-400"><span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>Cargando detalle...</div>
            ) : detailBatch && (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{detailBatch.batch_number}</h3>
                    <p className="text-xs text-slate-500">{detailBatch.supplier_name ? `${detailBatch.supplier_name} • ` : ''}{detailBatch.purchase_date ? new Date(detailBatch.purchase_date).toLocaleDateString('es-AR') : ''} • {detailBatch.currency}{detailBatch.currency !== 'ARS' ? ` (cotiz. $${fmt(detailBatch.exchange_rate)})` : ''}</p>
                  </div>
                  <button onClick={() => setDetailBatch(null)} className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-xl">close</span></button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[['Total Productos', `$${fmt(detailBatch.total_products_ars)}`], ['Costo Envío', `$${fmt(detailBatch.shipping_cost_ars)}`], ['Total Lote', `$${fmt(detailBatch.total_cost_ars)}`]].map(([label, value]) => (
                    <div key={String(label)} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{label}</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        {['Producto / Variante', 'Cant.', 'Costo orig.', 'Costo ARS', 'Envío/u', 'Total/u', 'Precio de Venta'].map((h, i) => (
                          <th key={h} className={`pb-2 pr-3 ${i > 1 ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(detailBatch.items || []).map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2 pr-3"><p className="font-bold text-slate-800 dark:text-slate-200">{it.product_name}</p><p className="text-slate-400">{it.variant_label}</p></td>
                          <td className="py-2 pr-3 text-center font-bold text-slate-700 dark:text-slate-300">{it.quantity}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-500">{detailBatch.currency !== 'ARS' ? `${CURRENCY_SYMBOLS[detailBatch.currency as Currency]}${Number(it.unit_cost_original).toFixed(2)}` : `$${fmt(it.unit_cost_original)}`}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(it.unit_cost_ars)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-green-600">${fmt(it.shipping_per_unit_ars)}</td>
                          <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt(it.total_cost_per_unit_ars)}</td>
                          <td className="py-2 text-right font-mono font-black text-primary">${fmt(it.sale_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
