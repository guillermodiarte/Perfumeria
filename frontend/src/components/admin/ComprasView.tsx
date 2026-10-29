'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStockFlowStore, DEFAULT_PERFUME_TYPES, getVariantGroupForCategory, isSameVariant, normalizeVariantSize, COMMON_COLORS, getColorHex } from '@/store/useStockStore';
import { syncBatchItemsToStore } from '@/utils/syncBatch';

type Currency = 'ARS' | 'USD' | 'BRL' | 'PYG';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'USD $',
  BRL: 'R$',
  PYG: '₲',
};

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('es-AR');
const fmtUSD = (n: number) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatOrigCost = (amount: number, currency: string = 'ARS') => {
  const c = (currency || 'ARS').toUpperCase().trim();
  const n = Number(amount) || 0;
  if (c === 'PYG' || c === 'GUARANIES' || c === 'GUARANÍES' || c === '₲') {
    return `₲ ${Math.round(n).toLocaleString('es-AR')}`;
  }
  if (c === 'USD' || c === 'U$S') {
    return `USD $ ${fmtUSD(n)}`;
  }
  if (c === 'BRL') {
    return `R$ ${fmtUSD(n)}`;
  }
  return `$ ${fmt(n)}`;
};

export function formatNumberAR(
  value: number | string | null | undefined,
  options?: { allowDecimals?: boolean; maxDecimals?: number }
): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.'));
  if (isNaN(num)) return '';
  const allowDecimals = options?.allowDecimals ?? false;
  if (allowDecimals) {
    if (num % 1 !== 0) {
      return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: options?.maxDecimals ?? 2 });
    }
    return num.toLocaleString('es-AR');
  }
  return Math.round(num).toLocaleString('es-AR');
}

interface PriceInputProps {
  value: number | string | undefined | null;
  onChange: (val: number | '') => void;
  currencySymbol?: string;
  allowDecimals?: boolean;
  placeholder?: string | number;
  disabled?: boolean;
  className?: string;
}

function PriceInput({
  value,
  onChange,
  currencySymbol,
  allowDecimals = false,
  placeholder = '0',
  disabled = false,
  className = '',
}: PriceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  // Texto que se muestra mientras el campo está enfocado (sin formato de miles)
  const [rawText, setRawText] = useState('');

  const prefix = useMemo(() => (currencySymbol ? `${currencySymbol} ` : ''), [currencySymbol]);

  // Formatea un número para mostrar cuando NO está enfocado
  const formatForDisplay = useCallback((val: number | string | undefined | null): string => {
    if (val === '' || val === undefined || val === null) return '';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    if (isNaN(num)) return '';
    const formatted = formatNumberAR(num, { allowDecimals });
    return formatted ? `${prefix}${formatted}` : '';
  }, [allowDecimals, prefix]);

  const formattedPlaceholder = useMemo(() => {
    if (placeholder === undefined || placeholder === null || placeholder === '') return '';
    if (typeof placeholder === 'number') {
      const formatted = formatNumberAR(placeholder, { allowDecimals });
      return formatted ? `${prefix}${formatted}` : '';
    }
    const num = parseFloat(String(placeholder).replace(',', '.'));
    if (!isNaN(num)) {
      const formatted = formatNumberAR(num, { allowDecimals });
      return formatted ? `${prefix}${formatted}` : '';
    }
    return String(placeholder);
  }, [placeholder, allowDecimals, prefix]);

  // Cuando el valor externo cambia y el campo NO está enfocado → no afecta el rawText
  // El rawText solo se usa mientras está enfocado

  const handleFocus = () => {
    setIsFocused(true);
    // Al enfocar, convertir el valor actual a texto raw (sin formato de miles)
    if (value === '' || value === undefined || value === null) {
      setRawText('');
    } else {
      const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
      if (isNaN(num) || num === 0) {
        setRawText('');
      } else if (allowDecimals && num % 1 !== 0) {
        // Mostrar con coma decimal para edición
        setRawText(String(num).replace('.', ','));
      } else {
        setRawText(String(Math.round(num)));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let str = e.target.value;

    // Quitar el prefijo si está presente
    if (currencySymbol) {
      const sym = currencySymbol.trim();
      if (str.startsWith(sym)) str = str.slice(sym.length).trim();
      // También strip del prefix completo (con espacio)
      if (str.startsWith(prefix)) str = str.slice(prefix.length);
    }
    str = str.trim();

    if (!str) {
      setRawText('');
      onChange('');
      return;
    }

    if (!allowDecimals) {
      // Solo dígitos enteros
      const digits = str.replace(/\D/g, '');
      setRawText(digits);
      onChange(digits ? Number(digits) : '');
    } else {
      // Permitir dígitos y UNA coma (separador decimal)
      // Eliminar todo excepto dígitos y coma
      let cleaned = str.replace(/[^\d,]/g, '');
      // Solo permitir una coma
      const commaIdx = cleaned.indexOf(',');
      if (commaIdx !== -1) {
        cleaned = cleaned.slice(0, commaIdx + 1) + cleaned.slice(commaIdx + 1).replace(/,/g, '');
        // Limitar a 2 decimales
        const parts = cleaned.split(',');
        if (parts[1] !== undefined) {
          parts[1] = parts[1].slice(0, 2);
          cleaned = parts.join(',');
        }
      }
      setRawText(cleaned);

      // Calcular valor numérico
      const numStr = cleaned.replace(',', '.');
      const num = parseFloat(numStr);
      if (cleaned === '' || cleaned === ',') {
        onChange('');
      } else if (isNaN(num)) {
        onChange('');
      } else {
        onChange(num);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setRawText('');
  };

  // Valor que se muestra en el input
  const displayValue = isFocused
    ? (rawText ? `${prefix}${rawText}` : '')
    : formatForDisplay(value);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      disabled={disabled}
      placeholder={formattedPlaceholder}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={className}
    />
  );
}

export default function ComprasView({ showAlert, apiKey, apiUrl, resetKey }: { showAlert: (msg: string) => void; apiKey: string; apiUrl: string; resetKey?: number }) {
  const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
  const wholesaleConfig = useStockFlowStore(s => s.wholesaleConfig);
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

  const categorySupportsVisualVariants = (catId?: string) => {
    if (!catId) return false;
    const group = categoriesConfig.find(g => g.opciones && g.opciones.includes(catId));
    if (group && group.hasVisualVariants) return true;
    const directGroup = categoriesConfig.find(g => g.grupo.toLowerCase() === catId.toLowerCase());
    if (directGroup?.hasVisualVariants) return true;
    return false;
  };

  const getCategoryAttributeLabel = (catId?: string) => {
    const group = (catId ? categoriesConfig.find(g => g.opciones && g.opciones.includes(catId)) : undefined)
      || categoriesConfig.find(g => g.grupo.toLowerCase() === (catId || '').toLowerCase());
    return group?.customAttributeLabel || 'Forma / Modelo';
  };

  // TABS
  const [activeTab, setActiveTabState] = useState<'nueva' | 'historial'>('nueva');
  const setActiveTab = (tab: 'nueva' | 'historial', pushHistory = true) => {
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
    const initialTab = params.get('tab');
    if (initialTab === 'historial' || initialTab === 'nueva') {
      setActiveTabState(initialTab);
    }

    const handlePopState = (e: PopStateEvent) => {
      const p = new URLSearchParams(window.location.search);
      const t = (e.state?.tab || p.get('tab')) as 'nueva' | 'historial' | null;
      if (t === 'historial' || t === 'nueva') {
        setActiveTabState(t);
      } else {
        setActiveTabState('nueva');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Reset to 'nueva' tab when parent triggers resetKey change
  useEffect(() => {
    if (resetKey === undefined) return;
    setActiveTabState('nueva');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'nueva');
      window.history.replaceState({ tab: 'nueva' }, '', url.toString());
    }
  }, [resetKey]);

  // PASO 1
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>('ARS');
  const [exchangeRate, setExchangeRate] = useState<number | string>(1);
  const [supplierInput, setSupplierInput] = useState('');
  const [apiSuppliers, setApiSuppliers] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Autocomplete producto (dropdown custom con imagen)
  const [productDropdownPIdx, setProductDropdownPIdx] = useState<number | null>(null);

  // PASO 3: Envío e Impuestos
  const [shippingCurrency, setShippingCurrency] = useState<Currency>('ARS');
  const [shippingCostOriginal, setShippingCostOriginal] = useState<number | string>('');
  const [shippingDescription, setShippingDescription] = useState('');

  // Impuestos extras (opcional, lista dinámica)
  interface TaxItem {
    id: string;
    description: string;
    currency: Currency;
    amount: number | string;
  }
  const createEmptyTaxItem = (): TaxItem => ({
    id: `tax-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    description: '',
    currency: 'ARS',
    amount: '',
  });

  const [extraTaxes, setExtraTaxes] = useState<TaxItem[]>([]);

  const addTaxItem = () => setExtraTaxes(prev => [...prev, createEmptyTaxItem()]);
  const removeTaxItem = (id: string) => setExtraTaxes(prev => prev.filter(t => t.id !== id));
  const updateTaxItem = (id: string, field: keyof TaxItem, value: any) => {
    setExtraTaxes(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const effectiveExchangeRate = purchaseCurrency === 'ARS' ? 1 : (Number(exchangeRate) || 0);
  const shippingEffectiveRate = shippingCurrency === 'ARS' ? 1 : (Number(exchangeRate) || 0);
  const shippingCostARS = (Number(shippingCostOriginal) || 0) * shippingEffectiveRate;

  // Cálculo individual y total de impuestos en ARS
  const calculateTaxItemARS = (tax: TaxItem) => {
    const rate = tax.currency === 'ARS' ? 1 : (Number(exchangeRate) || 0);
    return (Number(tax.amount) || 0) * rate;
  };
  const taxCostARS = extraTaxes.reduce((sum, t) => sum + calculateTaxItemARS(t), 0);
  const totalShippingAndTaxARS = shippingCostARS + taxCostARS;

  // Verifica si alguna moneda extranjera requiere cotización
  const hasForeignCurrency = purchaseCurrency !== 'ARS' || shippingCurrency !== 'ARS' || extraTaxes.some(t => t.currency !== 'ARS');
  const firstForeignCurrency = purchaseCurrency !== 'ARS'
    ? purchaseCurrency
    : shippingCurrency !== 'ARS'
      ? shippingCurrency
      : (extraTaxes.find(t => t.currency !== 'ARS')?.currency || 'USD');

  // PASO 2
  const createEmptyVariant = () => ({
    size: 'Único',
    color: '',
    colorHex: '#18181b',
    imageUrl: '',
    attributeName: 'Forma',
    attributeValue: '',
    description: '',
    quantity: 1 as number | string,
    unitPurchasePrice: '' as unknown as number,
    manualSalePrice: '' as unknown as number,
    manualWholesalePrice: '' as unknown as number,
    sizeIndex: 0
  });

  const createEmptyProduct = () => ({
    productId: `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    newProductName: '', newProductSku: '', perfumeType: '',
    categoryId: categoriesConfig[0]?.opciones[0] || 'Perfumes de Mujer',
    targetGender: 'Unisex' as const,
    notForPublicSale: false,
    hasVariantPricing: false,
    hasVisualVariants: false,
    globalPurchasePrice: '' as unknown as number,
    globalSalePrice: '' as unknown as number,
    globalWholesalePrice: '' as unknown as number,
    newProductImageUrls: [] as string[], _uploading: false,
    variants: [createEmptyVariant()],
    description: '', tag: 'Alta Demanda', showTag: false,
    olfactoryNotes: '', duration: '', intensity: '', family: '', showFeatures: false, _showDetails: false,
  });

  const [products, setProducts] = useState([createEmptyProduct()]);
  const addProductLine = () => setProducts(p => [...p, createEmptyProduct()]);
  const addVariant = (pIdx: number) => { const np = [...products]; np[pIdx].variants.push(createEmptyVariant()); setProducts(np); };
  const duplicateVariant = (pIdx: number, vIdx: number) => {
    const np = [...products];
    const target = np[pIdx].variants[vIdx];
    np[pIdx].variants.splice(vIdx + 1, 0, {
      ...target,
      quantity: 1,
      attributeValue: '',
    });
    setProducts(np);
  };
  const addColorVariant = (pIdx: number, colorName: string, colorHex: string) => {
    const np = [...products];
    const attrName = getCategoryAttributeLabel(np[pIdx]?.categoryId);
    // Si la única variante está vacía, la reemplazamos
    const curVars = np[pIdx].variants;
    if (curVars.length === 1 && !curVars[0].color && (!curVars[0].attributeValue || curVars[0].attributeValue === '')) {
      np[pIdx].variants = [{
        ...createEmptyVariant(),
        color: colorName,
        colorHex: colorHex,
        attributeName: attrName,
      }];
    } else {
      np[pIdx].variants.push({
        ...createEmptyVariant(),
        color: colorName,
        colorHex: colorHex,
        attributeName: attrName,
      });
    }
    setProducts(np);
  };
  const updateProduct = (pIdx: number, field: string, value: any) => { const np = [...products]; (np[pIdx] as any)[field] = value; setProducts(np); };
  const updateVariant = (pIdx: number, vIdx: number, field: string, value: any) => { const np = [...products]; (np[pIdx].variants[vIdx] as any)[field] = value; setProducts(np); };
  const removeProduct = (pIdx: number) => { if (products.length > 1) setProducts(products.filter((_, i) => i !== pIdx)); };
  const removeVariant = (pIdx: number, vIdx: number) => { const np = [...products]; if (np[pIdx].variants.length > 1) { np[pIdx].variants.splice(vIdx, 1); setProducts(np); } };

  const updateProductGlobalPrice = (pIdx: number, type: 'cost' | 'sale' | 'wholesale', val: number | '') => {
    const np = [...products];
    const prod = np[pIdx];
    if (type === 'cost') {
      (prod as any).globalPurchasePrice = val;
      prod.variants.forEach(v => { v.unitPurchasePrice = val as any; });
    } else if (type === 'sale') {
      (prod as any).globalSalePrice = val;
      prod.variants.forEach(v => { (v as any).manualSalePrice = val; });
    } else if (type === 'wholesale') {
      (prod as any).globalWholesalePrice = val;
      prod.variants.forEach(v => { (v as any).manualWholesalePrice = val; });
    }
    setProducts(np);
  };

  const [matrixModalPIdx, setMatrixModalPIdx] = useState<number | null>(null);
  const [matrixColorsInput, setMatrixColorsInput] = useState('');
  const [matrixShapesInput, setMatrixShapesInput] = useState('');

  const generateMatrixVariants = (pIdx: number, colorsText: string, shapesText: string) => {
    const colors = colorsText.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const shapes = shapesText.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!colors.length && !shapes.length) return;
    const newVars: any[] = [];
    const attrName = getCategoryAttributeLabel(products[pIdx]?.categoryId);

    if (colors.length && shapes.length) {
      for (const c of colors) {
        for (const s of shapes) {
          newVars.push({
            ...createEmptyVariant(),
            color: c,
            colorHex: getColorHex(c),
            attributeName: attrName,
            attributeValue: s,
            size: s,
            quantity: 1,
            unitPurchasePrice: products[pIdx]?.variants[0]?.unitPurchasePrice || '',
            manualSalePrice: (products[pIdx]?.variants[0] as any)?.manualSalePrice || '',
          });
        }
      }
    } else if (colors.length) {
      for (const c of colors) {
        newVars.push({
          ...createEmptyVariant(),
          color: c,
          colorHex: getColorHex(c),
          attributeName: attrName,
          attributeValue: 'Único',
          size: 'Único',
          quantity: 1,
          unitPurchasePrice: products[pIdx]?.variants[0]?.unitPurchasePrice || '',
          manualSalePrice: (products[pIdx]?.variants[0] as any)?.manualSalePrice || '',
        });
      }
    } else if (shapes.length) {
      for (const s of shapes) {
        newVars.push({
          ...createEmptyVariant(),
          color: '',
          attributeName: attrName,
          attributeValue: s,
          size: s,
          quantity: 1,
          unitPurchasePrice: products[pIdx]?.variants[0]?.unitPurchasePrice || '',
          manualSalePrice: (products[pIdx]?.variants[0] as any)?.manualSalePrice || '',
        });
      }
    }

    if (newVars.length > 0) {
      const np = [...products];
      const curVars = np[pIdx].variants;
      if (curVars.length === 1 && !curVars[0].color && (!curVars[0].attributeValue || curVars[0].attributeValue === '')) {
        np[pIdx].variants = newVars;
      } else {
        np[pIdx].variants = [...curVars, ...newVars];
      }
      setProducts(np);
    }
  };

  const handleVariantFileUpload = async (pIdx: number, vIdx: number, files: FileList | null) => {
    if (!files || !files.length) return;
    const token = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
    if (!token) { showAlert('Sin credenciales de administrador.'); return; }
    const uploadEndpoint = apiUrl ? `${apiUrl}/api/admin/product-image` : `/api/admin/product-image`;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` },
          body: fd
        });
        if (r.ok) {
          const d = await r.json();
          const uploadedUrl = d.url;
          updateVariant(pIdx, vIdx, 'imageUrl', uploadedUrl);
          const cur = products[pIdx]?.newProductImageUrls || [];
          if (!cur.includes(uploadedUrl)) {
            updateProduct(pIdx, 'newProductImageUrls', [...cur, uploadedUrl]);
          }
          setMediaLibImages(prev => [
            { url: uploadedUrl, filename: uploadedUrl.split('/').pop() || '', category: 'Productos' },
            ...prev
          ]);
          break;
        } else {
          showAlert('Error subiendo imagen para la variante');
        }
      } catch {
        showAlert('Error de red al subir imagen');
      }
    }
  };

  // Totals
  const allVariants = products.flatMap(p => p.variants);
  const totalUnidades = allVariants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
  const totalCompraARS = allVariants.reduce((s, v) => s + (Number(v.quantity) || 0) * (Number(v.unitPurchasePrice) || 0) * effectiveExchangeRate, 0);

  // PASO 4
  type SummaryRow = {
    pIdx: number; vIdx: number; productName: string; variantLabel: string; quantity: number;
    unitCostOriginal: number; unitCostARS: number; shippingPerUnitARS: number; totalCostPerUnitARS: number;
    suggestedSalePrice: number; salePrice: number;
    suggestedWholesalePrice: number; wholesalePrice: number;
    existingProd: any | null; existingVariant: any | null;
    salePriceConflict: 'update' | 'keep' | 'custom' | null; customSalePrice: number;
    notForPublicSale?: boolean;
    imageUrl?: string;
    colorHex?: string;
    attributeName?: string;
    attributeValue?: string;
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

  // Modo Edición en línea (reemplaza el modal de editar lote)
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [editingBatchNumber, setEditingBatchNumber] = useState<string | null>(null);
  const [loadingEditBatch, setLoadingEditBatch] = useState(false);
  // Pendiente para confirmar reemplazo de borrador
  const [pendingEditBatchId, setPendingEditBatchId] = useState<number | null>(null);
  const [showReplaceWithEditModal, setShowReplaceWithEditModal] = useState(false);

  // Modal Eliminar Datos / Borrador
  const [showClearDraftModal, setShowClearDraftModal] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const DRAFT_COMPRAS_KEY = 'lyg_draft_compra';
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftUpdatedBy, setDraftUpdatedBy] = useState<string | null>(null);
  const [isSyncingServerDraft, setIsSyncingServerDraft] = useState(false);

  // Modal Biblioteca de Medios (Imágenes)
  const [mediaLibTargetPIdx, setMediaLibTargetPIdx] = useState<number | null>(null);
  const [mediaLibTargetVIdx, setMediaLibTargetVIdx] = useState<number | null>(null);
  const [mediaLibImages, setMediaLibImages] = useState<Array<{ url: string; filename: string; category?: string }>>([]);
  const [mediaLibCategories, setMediaLibCategories] = useState<string[]>([]);
  const [selectedMediaCategory, setSelectedMediaCategory] = useState<string>('all');
  const [mediaLibLoading, setMediaLibLoading] = useState(false);
  const [mediaLibSearch, setMediaLibSearch] = useState('');

  const openMediaLib = async (pIdx: number, force = false, vIdx: number | null = null) => {
    setMediaLibTargetPIdx(pIdx);
    setMediaLibTargetVIdx(vIdx);
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
            const mtime = typeof f === 'object' ? (f.mtime || 0) : 0;
            return { url, filename, category, mtime };
          })
          .filter(f => Boolean(f.url) && /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp)$/i.test(f.url))
          .sort((a: any, b: any) => (b.mtime || 0) - (a.mtime || 0));
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
    shippingDescription.trim() !== '' ||
    purchaseCurrency !== 'ARS' ||
    shippingCurrency !== 'ARS' ||
    (shippingCostOriginal !== '' && Number(shippingCostOriginal) > 0) ||
    extraTaxes.length > 0 ||
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

  // Helper para obtener token de autenticación
  const getAuthToken = useCallback(() => {
    return apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || '' : '');
  }, [apiKey]);

  // Consulta el borrador compartido desde el servidor
  const fetchServerDraft = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsSyncingServerDraft(true);
      const token = getAuthToken();
      const endpoint = apiUrl ? `${apiUrl}/api/admin/purchases/draft` : '/api/admin/purchases/draft';
      const res = await fetch(endpoint, {
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.draft) {
          const parsed = data.draft;
          if (parsed.supplierInput !== undefined) setSupplierInput(parsed.supplierInput);
          if (parsed.purchaseDate) setPurchaseDate(parsed.purchaseDate);
          if (parsed.purchaseCurrency) setPurchaseCurrency(parsed.purchaseCurrency);
          if (parsed.exchangeRate !== undefined) setExchangeRate(parsed.exchangeRate);
          if (parsed.shippingCurrency) setShippingCurrency(parsed.shippingCurrency);
          if (parsed.shippingDescription !== undefined) setShippingDescription(parsed.shippingDescription);
          if (parsed.shippingCostOriginal !== undefined) setShippingCostOriginal(parsed.shippingCostOriginal);
          if (Array.isArray(parsed.extraTaxes)) {
            setExtraTaxes(parsed.extraTaxes);
          } else if (parsed.taxCostOriginal !== undefined && parsed.taxCostOriginal !== '') {
            // Compatibilidad hacia atrás
            setExtraTaxes([{
              id: `tax-init-${Date.now()}`,
              description: parsed.taxDescription || '',
              currency: parsed.taxCurrency || 'ARS',
              amount: parsed.taxCostOriginal || ''
            }]);
          }
          if (Array.isArray(parsed.products) && parsed.products.length > 0) {
            setProducts(parsed.products);
          }
          try {
            localStorage.setItem(DRAFT_COMPRAS_KEY, JSON.stringify(parsed));
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
      const endpoint = apiUrl ? `${apiUrl}/api/admin/purchases/draft` : '/api/admin/purchases/draft';
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
      const endpoint = apiUrl ? `${apiUrl}/api/admin/purchases/draft` : '/api/admin/purchases/draft';
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
        const saved = localStorage.getItem(DRAFT_COMPRAS_KEY);
        if (saved) {
          localDraft = JSON.parse(saved);
          if (localDraft.supplierInput !== undefined) setSupplierInput(localDraft.supplierInput);
          if (localDraft.purchaseDate) setPurchaseDate(localDraft.purchaseDate);
          if (localDraft.purchaseCurrency) setPurchaseCurrency(localDraft.purchaseCurrency);
          if (localDraft.exchangeRate !== undefined) setExchangeRate(localDraft.exchangeRate);
          if (localDraft.shippingCurrency) setShippingCurrency(localDraft.shippingCurrency);
          if (localDraft.shippingDescription !== undefined) setShippingDescription(localDraft.shippingDescription);
          if (localDraft.shippingCostOriginal !== undefined) setShippingCostOriginal(localDraft.shippingCostOriginal);
          if (Array.isArray(localDraft.extraTaxes)) {
            setExtraTaxes(localDraft.extraTaxes);
          } else if (localDraft.taxCostOriginal !== undefined && localDraft.taxCostOriginal !== '') {
            setExtraTaxes([{
              id: `tax-local-${Date.now()}`,
              description: localDraft.taxDescription || '',
              currency: localDraft.taxCurrency || 'ARS',
              amount: localDraft.taxCostOriginal || ''
            }]);
          }
          if (Array.isArray(localDraft.products) && localDraft.products.length > 0) {
            setProducts(localDraft.products);
          }
        }
      } catch (e) {
        console.error('Error al cargar borrador local de compras:', e);
      }

      // Sincronizar con el servidor
      const foundOnServer = await fetchServerDraft(false);

      // Si no había en el servidor pero sí local, respaldarlo al servidor para que el otro admin lo vea
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

  // Guardar borrador automáticamente al cambiar datos con debounce
  useEffect(() => {
    if (!isDraftLoaded) return;
    if (editingBatchId) return; // No sobreescribir el borrador compartido si se está editando un lote existente
    const timer = setTimeout(() => {
      try {
        if (hasDraftData) {
          const draft = {
            supplierInput,
            purchaseDate,
            purchaseCurrency,
            exchangeRate,
            shippingCurrency,
            shippingDescription,
            shippingCostOriginal,
            extraTaxes,
            products,
          };
          localStorage.setItem(DRAFT_COMPRAS_KEY, JSON.stringify(draft));
          saveServerDraft(draft);
        } else {
          localStorage.removeItem(DRAFT_COMPRAS_KEY);
          clearServerDraft();
          setCloudSyncStatus('idle');
          setDraftUpdatedAt(null);
          setDraftUpdatedBy(null);
        }
      } catch (e) {
        console.error('Error al guardar borrador de compras:', e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isDraftLoaded, editingBatchId, hasDraftData, supplierInput, purchaseDate, purchaseCurrency, exchangeRate, shippingCurrency, shippingDescription, shippingCostOriginal, extraTaxes, products, saveServerDraft, clearServerDraft]);

  // Si el usuario vuelve a enfocar la ventana o navegador, comprobar cambios del servidor
  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeTab === 'nueva' && isDraftLoaded && !editingBatchId) {
        fetchServerDraft(false);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [activeTab, isDraftLoaded, editingBatchId, fetchServerDraft]);

  // Limpiar y resetear borrador / Cancelar edición total
  const handleClearDraft = async () => {
    const wasEditing = Boolean(editingBatchId);
    setEditingBatchId(null);
    setEditingBatchNumber(null);
    setSupplierInput('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseCurrency('ARS');
    setExchangeRate(1);
    setShippingCurrency('ARS');
    setShippingDescription('');
    setShippingCostOriginal('');
    setExtraTaxes([]);
    setProducts([createEmptyProduct()]);
    setShowSummary(false);
    setCloudSyncStatus('idle');
    setDraftUpdatedAt(null);
    setDraftUpdatedBy(null);
    try {
      localStorage.removeItem(DRAFT_COMPRAS_KEY);
    } catch {}
    await clearServerDraft();
    setShowClearDraftModal(false);
    showAlert(wasEditing ? '✅ Edición cancelada. Formulario limpio y listo para una nueva compra.' : '🗑️ Datos eliminados y formulario reseteado.');
  };

  // Vaciar solo los productos pero conservar datos de cabecera y envío para continuar editando
  const handleClearProductsOnly = () => {
    setProducts([createEmptyProduct()]);
    setShowSummary(false);
    setShowClearDraftModal(false);
    showAlert(`🗑️ Productos vaciados. Continuás editando el lote ${editingBatchNumber || ''}.`);
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
    // Si hay datos en el borrador, pedir confirmación antes de sobreescribir
    if (hasDraftData) {
      setPendingEditBatchId(batchId);
      setShowReplaceWithEditModal(true);
      return;
    }
    await _loadBatchIntoForm(batchId);
  };

  const _loadBatchIntoForm = async (batchId: number) => {
    setLoadingEditBatch(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${batchId}`, {
        headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) { showAlert('No se pudo cargar la información del lote para editar.'); return; }
      const data = await res.json();

      // Popular el formulario con los datos del lote
      setSupplierInput(data.supplier_name || '');
      setPurchaseDate(data.purchase_date ? data.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      const batchCurrency: Currency = (['ARS','USD','BRL','PYG'].includes(data.currency) ? data.currency : 'ARS') as Currency;
      setPurchaseCurrency(batchCurrency);
      setExchangeRate(data.exchange_rate && data.exchange_rate !== 1 ? data.exchange_rate : (batchCurrency === 'ARS' ? 1 : ''));
      setShippingCurrency('ARS');
      setShippingDescription('');
      setShippingCostOriginal(data.shipping_cost_ars || '');

      // Extraer datos de impuestos y envío si fueron guardados en notes
      let parsedNotes: any = null;
      if (data.notes) {
        try {
          parsedNotes = typeof data.notes === 'string' ? JSON.parse(data.notes) : data.notes;
          if (parsedNotes && typeof parsedNotes === 'object') {
            if (parsedNotes.shippingDescription) setShippingDescription(parsedNotes.shippingDescription);
            if (parsedNotes.shippingCurrency) setShippingCurrency(parsedNotes.shippingCurrency);
            if (parsedNotes.shippingCostOriginal !== undefined && parsedNotes.shippingCostOriginal !== '') {
              setShippingCostOriginal(parsedNotes.shippingCostOriginal);
            }
            if (Array.isArray(parsedNotes.extraTaxes)) {
              setExtraTaxes(parsedNotes.extraTaxes);
            } else if (parsedNotes.taxCostOriginal !== undefined && parsedNotes.taxCostOriginal !== '') {
              // Compatibilidad hacia atrás con formato antiguo
              setExtraTaxes([{
                id: `tax-batch-${Date.now()}`,
                description: parsedNotes.taxDescription || '',
                currency: parsedNotes.taxCurrency || 'ARS',
                amount: parsedNotes.taxCostOriginal || ''
              }]);
            } else {
              setExtraTaxes([]);
            }
          }
        } catch { setExtraTaxes([]); }
      } else {
        setExtraTaxes([]);
      }

      // Convertir los items del lote al formato de productos del formulario
      const loadedProducts: any[] = [];
      const seenProductNames = new Map<string, number>(); // productName -> índice en loadedProducts

      for (const it of (data.items || [])) {
        const pName = (it.product_name || '').trim();
        const existingIdx = seenProductNames.get(pName.toLowerCase());

        // Buscar si el producto ya existe en el catálogo para cargar imágenes y metadatos
        const matchingStoreProd = productsStore.find(p =>
          (it.product_id && String(p.id) === String(it.product_id)) ||
          p.name.trim().toLowerCase() === pName.toLowerCase()
        );

        const categoryId = matchingStoreProd?.categoryId || it.category_id || categoriesConfig[0]?.opciones[0] || 'Perfumes de Mujer';
        const vg = getVariantGroupForCategory(categoryId, categoriesConfig, variantGroupsConfig);

        const unitCostInOrigCurrency = batchCurrency !== 'ARS' && data.exchange_rate && Number(data.exchange_rate) > 0
          ? (Number(it.unit_cost_ars) || 0) / Number(data.exchange_rate)
          : (Number(it.unit_cost_original) || Number(it.unit_cost_ars) || 0);

        // Buscar variante correspondiente en el producto guardado
        const matchingVariant = matchingStoreProd?.variants?.find(v =>
          (it.variant_id && v.id === it.variant_id) ||
          (v.color && (it.variant_label || '').toLowerCase().includes(v.color.toLowerCase())) ||
          v.size?.toLowerCase() === (it.variant_label || '').toLowerCase()
        );

        // Parsear tamaño y descripción desde variant_label
        const labelParts = (it.variant_label || '').split(' – ').length > 1
          ? (it.variant_label || '').split(' – ')
          : (it.variant_label || '').split(' - ');
        const vSize = labelParts[0]?.trim() || '';
        const vDesc = labelParts.slice(1).join(' - ').trim();

        // Encontrar sizeIndex en el grupo de variantes
        let sizeIndex = 0;
        let isKnownSize = false;
        if (vg && vg.options.length > 0) {
          const foundIdx = vg.options.findIndex(o =>
            vSize && (o.value === vSize || vSize.startsWith(o.value) || (o.description && vSize.includes(o.description)))
          );
          if (foundIdx >= 0) {
            sizeIndex = foundIdx;
            isKnownSize = true;
          }
        }

        const savedMeta = parsedNotes?.productsMeta?.find((m: any) =>
          m.productName?.trim().toLowerCase() === pName.toLowerCase()
        );

        const canUseVisual = categorySupportsVisualVariants(categoryId);
        const isVisualForProd = savedMeta?.hasVisualVariants !== undefined
          ? Boolean(savedMeta.hasVisualVariants)
          : (matchingStoreProd?.hasVisualVariants !== undefined
            ? Boolean(matchingStoreProd.hasVisualVariants)
            : (canUseVisual && (
                Boolean(matchingVariant?.color || (matchingVariant as any)?.colorHex || (matchingVariant as any)?.imageUrl || (matchingVariant as any)?.attributeValue) ||
                Boolean(matchingStoreProd?.variants?.some(v => (v as any).colorHex || (v as any).attributeValue || (v as any).imageUrl)) ||
                COMMON_COLORS.some(c => c.name.toLowerCase() === (it.variant_label || '').trim().toLowerCase()) ||
                (it.variant_label || '').includes(' – ')
              )));

        let vColor = matchingVariant?.color || '';
        let vColorHex = (matchingVariant as any)?.colorHex || '';
        let vAttr = (matchingVariant as any)?.attributeValue || '';
        let vImg = (matchingVariant as any)?.imageUrl || '';

        if (isVisualForProd) {
          if (!vColor && !vAttr) {
            if (labelParts.length > 1) {
              vColor = labelParts[0].trim();
              vAttr = labelParts.slice(1).join(' - ').trim();
            } else {
              const singleLabel = (it.variant_label || '').trim();
              if (COMMON_COLORS.some(c => c.name.toLowerCase() === singleLabel.toLowerCase()) || !vg || vg.options.length === 0) {
                vColor = singleLabel;
              } else {
                vAttr = singleLabel;
              }
            }
          }
          if (vColor && !vColorHex) {
            vColorHex = getColorHex(vColor);
          }
        }

        const newVariant = {
          size: isVisualForProd ? (vAttr || 'Único') : (isKnownSize ? vSize : (vg?.options?.[0]?.value || 'Único')),
          description: isVisualForProd ? (vColor || vDesc) : (vDesc || (!isKnownSize && vSize !== 'Único' ? vSize : '')),
          color: vColor,
          colorHex: vColorHex,
          attributeValue: vAttr,
          attributeName: getCategoryAttributeLabel(categoryId),
          imageUrl: vImg,
          quantity: it.quantity || 1,
          unitPurchasePrice: unitCostInOrigCurrency,
          sizeIndex,
          manualSalePrice: it.sale_price || '',
          manualWholesalePrice: it.wholesale_price || '',
          _editBatchItemId: it.id,
          _editVariantId: it.variant_id,
          _editProductId: it.product_id,
          _editOrigQty: it.quantity || 0,
        };

        if (existingIdx !== undefined) {
          loadedProducts[existingIdx].variants.push(newVariant);
        } else {
          const newProd = {
            productId: matchingStoreProd ? matchingStoreProd.id : (it.product_id ? String(it.product_id) : `NEW-${Date.now()}-${Math.random().toString(36).substr(2,6)}`),
            newProductName: matchingStoreProd ? matchingStoreProd.name : pName,
            newProductSku: matchingStoreProd?.sku || '',
            perfumeType: (matchingStoreProd as any)?.perfumeType || '',
            categoryId,
            targetGender: matchingStoreProd?.targetGender || ('Unisex' as const),
            notForPublicSale: Boolean((matchingStoreProd as any)?.notForPublicSale),
            hasVisualVariants: isVisualForProd,
            hasVariantPricing: false,
            globalPurchasePrice: '' as unknown as number,
            globalSalePrice: '' as unknown as number,
            globalWholesalePrice: '' as unknown as number,
            newProductImageUrls: matchingStoreProd?.imageUrls || [],
            _uploading: false,
            variants: [newVariant],
            description: matchingStoreProd?.description || '',
            tag: (matchingStoreProd as any)?.tag || 'Alta Demanda',
            showTag: Boolean((matchingStoreProd as any)?.showTag),
            olfactoryNotes: (matchingStoreProd as any)?.olfactoryNotes || '',
            duration: (matchingStoreProd as any)?.duration || '',
            intensity: (matchingStoreProd as any)?.intensity || '',
            family: (matchingStoreProd as any)?.family || '',
            showFeatures: Boolean((matchingStoreProd as any)?.showFeatures),
            _showDetails: false,
          };
          seenProductNames.set(pName.toLowerCase(), loadedProducts.length);
          loadedProducts.push(newProd);
        }
      }

      // Post-procesar productos cargados para ajustar precios individuales y globales
      for (const p of loadedProducts) {
        if (p.variants.some((v: any) => v.color || v.colorHex || v.attributeValue || v.imageUrl)) {
          p.hasVisualVariants = true;
        }

        const savedMeta = parsedNotes?.productsMeta?.find((m: any) =>
          m.productName?.trim().toLowerCase() === p.newProductName.trim().toLowerCase()
        );
        const matchingStore = productsStore.find(sp =>
          sp.id === p.productId || sp.name.trim().toLowerCase() === p.newProductName.trim().toLowerCase()
        );

        const uniqueCosts = new Set(p.variants.map((v: any) => Number(v.unitPurchasePrice) || 0));
        const uniqueSales = new Set(p.variants.map((v: any) => Number(v.manualSalePrice) || 0));
        const uniqueWholesale = new Set(p.variants.map((v: any) => Number(v.manualWholesalePrice) || 0));
        const pricesVary = uniqueCosts.size > 1 || uniqueSales.size > 1 || uniqueWholesale.size > 1;

        if (savedMeta?.hasVariantPricing !== undefined) {
          p.hasVariantPricing = Boolean(savedMeta.hasVariantPricing);
        } else if (matchingStore?.hasVariantPricing !== undefined) {
          p.hasVariantPricing = Boolean(matchingStore.hasVariantPricing);
        } else if (pricesVary) {
          p.hasVariantPricing = true;
        } else {
          p.hasVariantPricing = false;
        }

        const firstV = p.variants[0];
        p.globalPurchasePrice = savedMeta?.globalPurchasePrice !== undefined
          ? savedMeta.globalPurchasePrice
          : (firstV ? (firstV.unitPurchasePrice || '') : '');
        p.globalSalePrice = savedMeta?.globalSalePrice !== undefined
          ? savedMeta.globalSalePrice
          : (firstV ? (firstV.manualSalePrice || '') : '');
        p.globalWholesalePrice = savedMeta?.globalWholesalePrice !== undefined
          ? savedMeta.globalWholesalePrice
          : (firstV ? (firstV.manualWholesalePrice || '') : '');
      }

      if (loadedProducts.length > 0) setProducts(loadedProducts);
      else setProducts([createEmptyProduct()]);

      // Registrar el batch que se está editando
      setEditingBatchId(data.id);
      setEditingBatchNumber(data.batch_number);

      // Limpiar borrador anterior para evitar colisiones
      try { localStorage.removeItem(DRAFT_COMPRAS_KEY); } catch {}
      clearServerDraft();
      setCloudSyncStatus('idle');
      setDraftUpdatedAt(null);
      setDraftUpdatedBy(null);
      setShowSummary(false);

      // Navegar al tab nueva compra
      setActiveTab('nueva');
    } catch (e: any) {
      showAlert(`Error al cargar lote: ${e.message}`);
    } finally {
      setLoadingEditBatch(false);
    }
  };

  // Helper para verificar si una fila de resumen tiene conflicto de precio con el stock previo de esa MISMA variante
  const isRowConflict = (r: { existingVariant?: any | null; existingProd?: any | null; totalCostPerUnitARS: number; notForPublicSale?: boolean }) => {
    if (r.notForPublicSale) return false;
    if (!r.existingVariant) return false;
    const prevCost = r.existingVariant.unitPurchasePrice ?? (
      r.existingProd?.variants?.length === 1 ? r.existingProd.purchasePrice : 0
    ) ?? 0;
    return prevCost > 0 && Math.abs(prevCost - r.totalCostPerUnitARS) > 0.01;
  };

  const handleOpenSummary = () => {
    if (products.some(p => !p.newProductName?.trim())) { showAlert('Completá el nombre de todos los productos.'); return; }
    if (allVariants.some(v => !v.quantity || Number(v.quantity) <= 0)) { showAlert('Todas las variantes deben tener cantidad > 0.'); return; }
    if (purchaseCurrency !== 'ARS' && (!exchangeRate || Number(exchangeRate) <= 0)) { showAlert(`Ingresá la cotización del ${purchaseCurrency} en pesos.`); return; }

    const rows: SummaryRow[] = [];
    products.forEach((prod, pIdx) => {
      const variantGroup = getVariantGroupForCategory(prod.categoryId, categoriesConfig, variantGroupsConfig);
      const isNotForSale = Boolean((prod as any).notForPublicSale);
      prod.variants.forEach((variant, vIdx) => {
        const unitCostOriginal = Number(variant.unitPurchasePrice) || 0;
        const unitCostARS = unitCostOriginal * effectiveExchangeRate;
        const qty = Number(variant.quantity) || 1;
        const blockCostARS = unitCostARS * qty;
        const proportion = totalCompraARS > 0 ? blockCostARS / totalCompraARS : 0;
        const shippingPerUnitARS = qty > 0 ? (totalShippingAndTaxARS * proportion) / qty : 0;
        const totalCostPerUnitARS = unitCostARS + shippingPerUnitARS;
        const suggestedSalePrice = isNotForSale
          ? 0
          : (globalMarkupPrc > 0 ? Math.round(totalCostPerUnitARS * (1 + globalMarkupPrc / 100)) : 0);

        const userSalePrice = (variant as any).manualSalePrice !== undefined && (variant as any).manualSalePrice !== ''
          ? Number((variant as any).manualSalePrice)
          : undefined;

        const finalSalePrice = isNotForSale
          ? 0
          : (userSalePrice !== undefined ? userSalePrice : suggestedSalePrice);

        const suggestedWholesalePrice = isNotForSale
          ? 0
          : (finalSalePrice > 0 && wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0
            ? Math.round(finalSalePrice * (1 - (wholesaleConfig.discountPercentage / 100)))
            : 0);

        const userWholesalePrice = (variant as any).manualWholesalePrice !== undefined && (variant as any).manualWholesalePrice !== ''
          ? Number((variant as any).manualWholesalePrice)
          : undefined;

        const finalWholesalePrice = isNotForSale
          ? 0
          : (userWholesalePrice !== undefined ? userWholesalePrice : suggestedWholesalePrice);

        const isVisual = categorySupportsVisualVariants(prod.categoryId) && Boolean((prod as any).hasVisualVariants);
        let variantLabel = '';
        if (isVisual) {
          const c = (variant as any).color?.trim();
          const attr = (variant as any).attributeValue?.trim() || variant.size?.trim();
          if (c && attr && attr !== 'Único') {
            variantLabel = `${c} – ${attr}`;
          } else if (c) {
            variantLabel = `${c}`;
          } else if (attr && attr !== 'Único') {
            variantLabel = `${attr}`;
          } else {
            variantLabel = (variant as any).description || 'Único';
          }
        } else {
          let sizeLabel = 'Único';
          if (variantGroup) { const opt = variantGroup.options[variant.sizeIndex || 0]; if (opt) sizeLabel = opt.description ? `${opt.value} - ${opt.description}` : opt.value; }
          variantLabel = `${sizeLabel}${(variant as any).description ? ` – ${(variant as any).description}` : ''}`;
        }

        const existingProd = prod.productId && !prod.productId.startsWith('NEW')
          ? productsStore.find(p => p.id === prod.productId)
          : productsStore.find(p => p.name.trim().toLowerCase() === prod.newProductName.trim().toLowerCase());
        const rawOptVal = isVisual
          ? ((variant as any).attributeValue || (variant as any).size || '').trim()
          : (variantGroup?.options[variant.sizeIndex || 0]?.value || '').trim();
        const cleanSize = variantLabel.split(' –')[0].trim();

        // Buscar si existe exactamente esta variante en el producto (por tamaño y color)
        const existingVariant = existingProd
          ? (existingProd.variants.find(v => {
              if (isSameVariant(v, { size: cleanSize, color: (variant as any).color || (variant as any).description, attributeValue: (variant as any).attributeValue, description: (variant as any).description })) {
                return true;
              }
              const normVSize = normalizeVariantSize(v.size);
              if (rawOptVal && normVSize === normalizeVariantSize(rawOptVal)) return true;
              if (cleanSize && normVSize === normalizeVariantSize(cleanSize)) return true;
              return false;
            }) || null)
          : null;

        // Solo hay conflicto si la variante YA existía previamente en el producto y su costo cambió (y está para venta al público)
        const hasConflict = isNotForSale ? false : isRowConflict({ existingVariant, existingProd, totalCostPerUnitARS, notForPublicSale: isNotForSale });

        rows.push({
          pIdx,
          vIdx,
          productName: prod.newProductName,
          variantLabel,
          quantity: qty,
          unitCostOriginal,
          unitCostARS,
          shippingPerUnitARS,
          totalCostPerUnitARS,
          suggestedSalePrice,
          salePrice: finalSalePrice,
          suggestedWholesalePrice,
          wholesalePrice: finalWholesalePrice,
          existingProd: existingProd || null,
          existingVariant: existingVariant || null,
          salePriceConflict: hasConflict ? null : 'update',
          customSalePrice: finalSalePrice,
          notForPublicSale: isNotForSale,
          imageUrl: (variant as any).imageUrl || undefined,
          colorHex: (variant as any).colorHex || undefined,
          attributeName: (variant as any).attributeName || undefined,
          attributeValue: (variant as any).attributeValue || undefined,
        });
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
      (r, i) => i !== rowIdx && isRowConflict(r) && r.salePriceConflict === null
    );

    if (nextIdx !== -1) {
      setConflictModal({ row: nextRows[nextIdx], rowIdx: nextIdx });
    } else {
      setConflictModal(null);
    }
  };

  const [saving, setSaving] = useState(false);

  const cancelEditMode = () => {
    setEditingBatchId(null);
    setEditingBatchNumber(null);
    setSupplierInput('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseCurrency('ARS');
    setExchangeRate(1);
    setShippingCurrency('ARS');
    setShippingCostOriginal('');
    setProducts([createEmptyProduct()]);
    setShowSummary(false);
    setActiveTab('historial');
  };

  const handleConfirmSave = async () => {
    const firstUnresolvedIdx = summaryRows.findIndex(
      r => isRowConflict(r) && r.salePriceConflict === null
    );
    if (firstUnresolvedIdx !== -1) {
      setConflictModal({ row: summaryRows[firstUnresolvedIdx], rowIdx: firstUnresolvedIdx });
      return;
    }
    setSaving(true);
    try {
      const buildItems = () => summaryRows.map(row => {
        const prod = products[row.pIdx];
        const isNotForSale = Boolean(row.notForPublicSale || (prod as any).notForPublicSale);
        const prevVariantSalePrice = row.existingVariant?.manualSalePrice ?? (row.existingProd?.variants?.length === 1 ? row.existingProd.salePrice : 0) ?? row.salePrice;
        const finalSalePrice = isNotForSale ? 0 : (row.salePriceConflict === 'keep' ? prevVariantSalePrice : row.salePriceConflict === 'custom' ? row.customSalePrice : row.salePrice);
        const finalWholesalePrice = isNotForSale ? 0 : (row.wholesalePrice || 0);
        const variant = prod.variants[row.vIdx];
        return {
          id: (variant as any)._editBatchItemId ?? undefined,
          product_id: prod.productId,
          variant_id: (variant as any)._editVariantId || `v-new`,
          product_name: row.productName,
          variant_label: row.variantLabel,
          quantity: row.quantity,
          unit_cost_original: row.unitCostOriginal,
          unit_cost_ars: row.unitCostARS,
          shipping_per_unit_ars: row.shippingPerUnitARS,
          total_cost_per_unit_ars: row.totalCostPerUnitARS,
          sale_price: finalSalePrice,
          wholesale_price: finalWholesalePrice,
        };
      });

      const notesDataObj: Record<string, any> = {};
      if (extraTaxes.length > 0) {
        notesDataObj.extraTaxes = extraTaxes;
        notesDataObj.taxCostARS = taxCostARS;
      }
      if (shippingDescription.trim()) {
        notesDataObj.shippingDescription = shippingDescription.trim();
      }
      if (shippingCurrency !== 'ARS') {
        notesDataObj.shippingCurrency = shippingCurrency;
      }
      if (shippingCostOriginal !== '') {
        notesDataObj.shippingCostOriginal = shippingCostOriginal;
        notesDataObj.shippingCostARS = shippingCostARS;
      }
      notesDataObj.productsMeta = products.map(p => ({
        productName: p.newProductName,
        hasVisualVariants: Boolean((p as any).hasVisualVariants),
        hasVariantPricing: Boolean((p as any).hasVariantPricing),
        globalPurchasePrice: (p as any).globalPurchasePrice,
        globalSalePrice: (p as any).globalSalePrice,
        globalWholesalePrice: (p as any).globalWholesalePrice,
      }));
      const taxNotesData = Object.keys(notesDataObj).length > 0 ? JSON.stringify(notesDataObj) : null;

      // ── Modo edición: PUT al lote existente ──
      if (editingBatchId) {
        const editPayload = {
          supplier_name: supplierInput.trim() || null,
          purchase_date: purchaseDate,
          currency: purchaseCurrency,
          exchange_rate: effectiveExchangeRate,
          shipping_currency: shippingCurrency,
          shipping_cost_original: shippingCostOriginal,
          shipping_cost_ars: totalShippingAndTaxARS,
          notes: taxNotesData,
          items: buildItems(),
        };
        const res = await fetch(`${apiUrl}/api/admin/purchase-batches/${editingBatchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(editPayload),
        });
        if (!res.ok) {
          let errMsg = 'Error al actualizar lote';
          try { const err = await res.json(); errMsg = err.detail || errMsg; } catch {}
          throw new Error(errMsg);
        }
        const itemsDiff = summaryRows.map(row => {
          const prod = products[row.pIdx];
          const variant = prod.variants[row.vIdx];
          const origQty = (variant as any)._editOrigQty ?? row.quantity;
          const isNotForSale = Boolean(row.notForPublicSale || (prod as any).notForPublicSale);
          const prevVariantSalePrice = row.existingVariant?.manualSalePrice ?? row.salePrice;
          const finalSalePrice = isNotForSale ? 0 : (row.salePriceConflict === 'keep' ? prevVariantSalePrice : row.salePriceConflict === 'custom' ? row.customSalePrice : row.salePrice);
          return { productId: prod.productId, variantId: (variant as any)._editVariantId, productName: row.productName, variantLabel: row.variantLabel, quantityDelta: row.quantity - origQty, newSalePrice: finalSalePrice, newTotalCostPerUnit: row.totalCostPerUnitARS };
        });
        updatePurchaseBatch({ batchNumber: editingBatchNumber || '', supplierName: supplierInput.trim() || undefined, itemsDiff });
        showAlert(`✅ Lote ${editingBatchNumber} actualizado con éxito.`);
      } else {
        // ── Modo nuevo: POST ──
        const payload = {
          supplier_name: supplierInput.trim() || null,
          purchase_date: purchaseDate,
          currency: purchaseCurrency,
          exchange_rate: effectiveExchangeRate,
          shipping_currency: shippingCurrency,
          shipping_cost_original: shippingCostOriginal,
          shipping_cost_ars: totalShippingAndTaxARS,
          total_products_ars: totalCompraARS,
          total_cost_ars: totalCompraARS + totalShippingAndTaxARS,
          notes: taxNotesData,
          items: buildItems(),
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
            const isNotForSale = Boolean(row.notForPublicSale || (prod as any).notForPublicSale);
            const prevVariantSalePrice = row.existingVariant?.manualSalePrice ?? (row.existingProd?.variants?.length === 1 ? row.existingProd.salePrice : 0) ?? row.salePrice;
            const finalSalePrice = isNotForSale ? 0 : (row.salePriceConflict === 'keep' ? prevVariantSalePrice : row.salePriceConflict === 'custom' ? row.customSalePrice : row.salePrice);
            const finalWholesalePrice = isNotForSale ? undefined : (row.wholesalePrice && row.wholesalePrice > 0 ? row.wholesalePrice : undefined);
            const variant = prod.variants[row.vIdx];
            const isVisual = categorySupportsVisualVariants(prod.categoryId) && Boolean((prod as any).hasVisualVariants);
            const variantColor = isVisual ? ((variant as any)?.color || '') : (row.variantLabel.split(' – ')[1] || '');
            const variantSize = isVisual ? ((variant as any)?.attributeValue || (variant as any)?.size || 'Único') : (row.variantLabel.split(' –')[0].trim() || 'Único');

            return {
              productId: prod.productId,
              variantId: `v-new`,
              productName: row.productName,
              variantLabel: row.variantLabel,
              size: variantSize,
              color: variantColor,
              colorHex: (variant as any)?.colorHex || getColorHex(variantColor),
              imageUrl: (variant as any)?.imageUrl || undefined,
              attributeName: (variant as any)?.attributeName || getCategoryAttributeLabel(prod.categoryId),
              attributeValue: (variant as any)?.attributeValue || undefined,
              quantity: row.quantity,
              unitCostOriginal: row.unitCostOriginal,
              unitCostARS: row.unitCostARS,
              shippingPerUnitARS: row.shippingPerUnitARS,
              totalCostPerUnitARS: row.totalCostPerUnitARS,
              salePrice: finalSalePrice,
              manualWholesalePrice: finalWholesalePrice,
              wholesalePrice: finalWholesalePrice,
              notForPublicSale: isNotForSale,
              hasVariantPricing: Boolean((prod as any).hasVariantPricing),
              newProductName: prod.newProductName,
              newProductSku: prod.newProductSku,
              perfumeType: prod.perfumeType || undefined,
              categoryId: prod.categoryId,
              targetGender: prod.targetGender,
              newProductImageUrls: prod.newProductImageUrls,
              description: prod.description || undefined,
              tag: prod.tag || undefined,
              showTag: prod.showTag,
              olfactoryNotes: prod.olfactoryNotes || undefined,
              duration: prod.duration || undefined,
              intensity: prod.intensity || undefined,
              family: prod.family || undefined,
              showFeatures: prod.showFeatures,
              hasVisualVariants: isVisual,
              salePriceConflict: row.salePriceConflict === null ? undefined : row.salePriceConflict,
              customSalePrice: row.customSalePrice
            };
          }),
        });
        showAlert(`✅ Lote ${saved.batch_number} guardado con éxito.`);
      }

      // Limpieza post-guardado
      try { localStorage.removeItem(DRAFT_COMPRAS_KEY); } catch {}
      clearServerDraft();
      setCloudSyncStatus('idle');
      setDraftUpdatedAt(null);
      setDraftUpdatedBy(null);
      setEditingBatchId(null);
      setEditingBatchNumber(null);
      setProducts([createEmptyProduct()]);
      setShippingCostOriginal('');
      setShippingDescription('');
      setShippingCurrency('ARS');
      setExtraTaxes([]);
      setSupplierInput('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setPurchaseCurrency('ARS');
      setExchangeRate(1);
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
              disabled={!hasDraftData && !editingBatchId}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                hasDraftData || editingBatchId
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 shadow-sm cursor-pointer'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
              }`}
              title={
                editingBatchId
                  ? "Cancelar edición y vaciar formulario para una nueva compra"
                  : hasDraftData
                  ? "Eliminar todos los datos cargados del ingreso"
                  : "No hay datos para eliminar"
              }
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

          {/* Banner modo edición */}
          {editingBatchId && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-200 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <p className="text-sm font-black text-amber-800 dark:text-amber-300">
                    Editando lote <span className="font-mono">{editingBatchNumber}</span>
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Modificá los datos y guardá para actualizar el lote. Los cambios de stock se aplicarán automáticamente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelEditMode}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Cancelar edición
              </button>
            </div>
          )}

          {/* PASO 1 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">receipt_long</span> Paso 1 — Datos del Lote
              </h3>

              <div className="flex items-center gap-2">
                {cloudSyncStatus === 'saving' && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span> Guardando en la nube...
                  </span>
                )}
                {hasDraftData && cloudSyncStatus === 'saved' && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5" title="Este borrador está sincronizado en la base de datos y visible para todos los administradores en cualquier dispositivo">
                    <span className="material-symbols-outlined text-sm">cloud_done</span> Borrador compartido {draftUpdatedBy ? `(${draftUpdatedBy})` : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fetchServerDraft(true)}
                  disabled={isSyncingServerDraft}
                  title="Consultar si otro administrador actualizó este borrador en otro dispositivo"
                  className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/80 hover:bg-blue-200/80 dark:bg-blue-900/50 dark:hover:bg-blue-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <span className={`material-symbols-outlined text-sm ${isSyncingServerDraft ? 'animate-spin' : ''}`}>sync</span>
                  {isSyncingServerDraft ? 'Sincronizando...' : 'Sincronizar'}
                </button>
              </div>
            </div>
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
                <select className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white" value={purchaseCurrency} onChange={e => {
                    const newCurr = e.target.value as Currency;
                    setPurchaseCurrency(newCurr);
                    if (newCurr === 'ARS') {
                      setExchangeRate(1);
                      // Resetear monedas dependientes a ARS
                      setShippingCurrency('ARS');
                      setExtraTaxes(prev => prev.map(t => ({ ...t, currency: 'ARS' })));
                    } else {
                      if (exchangeRate === 1) setExchangeRate('');
                      // Si el envío o impuestos tenían otra moneda extranjera, actualizarla
                      if (shippingCurrency !== 'ARS' && shippingCurrency !== newCurr) setShippingCurrency(newCurr);
                      setExtraTaxes(prev => prev.map(t => t.currency !== 'ARS' && t.currency !== newCurr ? { ...t, currency: newCurr } : t));
                    }
                  }}>
                  <option value="ARS">🇦🇷 Pesos (ARS)</option>
                  <option value="USD">🇺🇸 Dólar (USD)</option>
                  <option value="BRL">🇧🇷 Real (BRL)</option>
                  <option value="PYG">🇵🇾 Guaraní (PYG)</option>
                </select>
              </div>
              {purchaseCurrency !== 'ARS' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    1 {purchaseCurrency} = $ ARS (cotización)
                  </label>
                  <PriceInput
                    currencySymbol="$"
                    allowDecimals={true}
                    placeholder="Ej: 1.610"
                    className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-sm font-bold text-amber-700 dark:text-amber-400"
                    value={exchangeRate ?? ''}
                    onChange={val => setExchangeRate(val === '' ? '' : val)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* PASO 2: Productos */}
          <div className="space-y-6">
            {products.map((prod, pIdx) => (
              <div 
                key={prod.productId} 
                className={`p-4 rounded-xl relative flex flex-col gap-4 border transition-all ${
                  (prod as any).notForPublicSale
                    ? 'bg-purple-50/25 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 ring-2 ring-purple-500/10 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <button onClick={() => removeProduct(pIdx)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 rounded-full size-8 flex items-center justify-center border border-red-200 hover:bg-red-200 z-10 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>

                {/* Selector de producto */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="col-span-1 md:col-span-5 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="block text-xs font-bold text-slate-500">1. Producto Padre</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {categorySupportsVisualVariants(prod.categoryId) && (
                          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors border select-none ${
                            (prod as any).hasVisualVariants
                              ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:border-purple-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={Boolean((prod as any).hasVisualVariants)}
                              onChange={e => updateProduct(pIdx, 'hasVisualVariants', e.target.checked)}
                              className="rounded text-purple-600 focus:ring-purple-500 size-3.5"
                            />
                            <span className="material-symbols-outlined text-[15px]">palette</span>
                            <span>Variantes por Color / Forma</span>
                          </label>
                        )}
                        <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors border select-none ${
                          (prod as any).notForPublicSale
                            ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={Boolean((prod as any).notForPublicSale)}
                            onChange={e => updateProduct(pIdx, 'notForPublicSale', e.target.checked)}
                            className="rounded text-purple-600 focus:ring-purple-500 size-3.5"
                          />
                          <span className="material-symbols-outlined text-[15px]">
                            {(prod as any).notForPublicSale ? 'visibility_off' : 'visibility'}
                          </span>
                          <span>{(prod as any).notForPublicSale ? 'Fuera de venta' : 'No para venta al público'}</span>
                        </label>
                      </div>
                    </div>

                    {(prod as any).notForPublicSale && (
                      <div className="px-3 py-1.5 rounded-lg bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-purple-600 dark:text-purple-400">info</span>
                        <span>Se cargará al inventario pero <strong>no estará en la tienda</strong> ni requerirá precio de venta.</span>
                      </div>
                    )}

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
                              updateProduct(pIdx, 'notForPublicSale', Boolean((ex as any).notForPublicSale));
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
                                      updateProduct(pIdx, 'notForPublicSale', Boolean((p as any).notForPublicSale));
                                      updateProduct(pIdx, 'hasVisualVariants', Boolean(p.hasVisualVariants || p.variants?.some((v: any) => v.colorHex || v.attributeValue || v.imageUrl)));
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
                              ? `${apiUrl}/api/admin/product-image`
                              : `/api/admin/product-image`;
                            for (const file of files) {
                              const fd = new FormData(); fd.append('file', file);
                              try { const r = await fetch(uploadEndpoint, { method: 'POST', headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }, body: fd }); if (r.ok) { const d = await r.json(); uploadedUrls.push(d.url); } else showAlert(`Error subiendo ${file.name}`); } catch { showAlert(`Error de red`); }
                            }
                            updateProduct(pIdx, 'newProductImageUrls', [...(prod.newProductImageUrls || []), ...uploadedUrls]);
                            setMediaLibImages(prev => [
                              ...uploadedUrls.map(u => ({ url: u, filename: u.split('/').pop() || '', category: 'Productos' })),
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
                {(() => {
                  const isVisual = categorySupportsVisualVariants(prod.categoryId) && Boolean((prod as any).hasVisualVariants);
                  const prodTotalStock = prod.variants.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
                  const attrLabel = getCategoryAttributeLabel(prod.categoryId);

                  if (isVisual) {
                    return (
                      <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                        {/* Cabecera del Gestor de Variantes Visuales */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/70 dark:bg-purple-950/30 p-3.5 rounded-xl border border-purple-200/80 dark:border-purple-800/40">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm">
                              <span className="material-symbols-outlined text-[20px]">palette</span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Variantes Visuales (Colores / {attrLabel} y Fotos)
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Asigna stock y foto para cada color o combinación.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {/* Switch: Variantes por Color / Forma */}
                            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-700 text-xs font-bold text-purple-700 dark:text-purple-300 hover:border-purple-400 transition-colors select-none shadow-xs">
                              <input
                                type="checkbox"
                                checked={Boolean((prod as any).hasVisualVariants)}
                                onChange={e => updateProduct(pIdx, 'hasVisualVariants', e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                              />
                              <span>Variantes por Color / Forma</span>
                            </label>

                            {/* Contador de Stock Total Acumulado */}
                            <div className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700/60 font-black text-xs shadow-sm">
                              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                              <span>Stock Total: {prodTotalStock} {prodTotalStock === 1 ? 'unidad' : 'unidades'}</span>
                            </div>

                            {/* Switch: Diferenciar Precios */}
                            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-purple-300 transition-colors select-none">
                              <input
                                type="checkbox"
                                checked={Boolean((prod as any).hasVariantPricing)}
                                onChange={e => updateProduct(pIdx, 'hasVariantPricing', e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                              />
                              <span>Precios individuales</span>
                            </label>
                          </div>
                        </div>

                        {/* Barra de Precios Globales (si no están diferenciados) */}
                        {!Boolean((prod as any).hasVariantPricing) && !(prod as any).notForPublicSale && (
                          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">sell</span>
                              Precios Generales para todas las variantes:
                            </span>

                            <div className="flex items-center gap-2">
                              <label className="text-[11px] font-bold text-slate-500">Costo ({CURRENCY_SYMBOLS[purchaseCurrency]}):</label>
                              <PriceInput
                                currencySymbol={CURRENCY_SYMBOLS[purchaseCurrency]}
                                allowDecimals={true}
                                placeholder="0"
                                className="w-24 text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm text-red-600 font-bold"
                                value={(prod as any).globalPurchasePrice ?? ''}
                                onChange={val => updateProductGlobalPrice(pIdx, 'cost', val)}
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-[11px] font-bold text-emerald-600">P. Venta ($):</label>
                              <PriceInput
                                currencySymbol="$"
                                allowDecimals={false}
                                placeholder="0"
                                className="w-28 text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1 text-sm text-emerald-700 dark:text-emerald-300 font-bold"
                                value={(prod as any).globalSalePrice ?? ''}
                                onChange={val => updateProductGlobalPrice(pIdx, 'sale', val)}
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-[11px] font-bold text-indigo-500">P. Mayorista ($):</label>
                              <PriceInput
                                currencySymbol="$"
                                allowDecimals={false}
                                placeholder="0"
                                className="w-28 text-center bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-700 rounded-lg px-2 py-1 text-sm text-indigo-600 dark:text-indigo-300 font-bold"
                                value={(prod as any).globalWholesalePrice ?? ''}
                                onChange={val => updateProductGlobalPrice(pIdx, 'wholesale', val)}
                              />
                            </div>
                          </div>
                        )}

                        {/* Barra de Acciones Rápidas (Colores frecuentes y Matriz) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Colores rápidos:</span>
                            {COMMON_COLORS.slice(0, 9).map(cc => (
                              <button
                                key={cc.name}
                                type="button"
                                onClick={() => addColorVariant(pIdx, cc.name, cc.hex)}
                                title={`Agregar variante de color ${cc.name}`}
                                className="size-6 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm hover:scale-125 transition-transform flex items-center justify-center"
                                style={{ backgroundColor: cc.hex }}
                              />
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setMatrixModalPIdx(pIdx);
                                setMatrixColorsInput('');
                                setMatrixShapesInput('');
                              }}
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                              title="Generar combinaciones automáticas de colores y formas"
                            >
                              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                              Generador por Matriz
                            </button>
                            <button
                              type="button"
                              onClick={() => addVariant(pIdx)}
                              className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                              Nueva Variante
                            </button>
                          </div>
                        </div>

                        {/* Lista de Filas de Variantes Visuales */}
                        <div className="space-y-2.5">
                          {prod.variants.map((variant, vIdx) => {
                            const curColor = (variant as any).color || '';
                            const curHex = (variant as any).colorHex || getColorHex(curColor);
                            const curShape = (variant as any).attributeValue || '';
                            const curImg = (variant as any).imageUrl || '';

                            return (
                              <div
                                key={vIdx}
                                className="flex flex-wrap md:flex-nowrap items-center gap-2.5 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                              >
                                {/* Color Swatch & Nombre */}
                                <div className="flex items-center gap-2 flex-1 min-w-[170px]">
                                  {/* Swatch interactivo con input nativo de color */}
                                  <label
                                    className="size-8 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-sm cursor-pointer hover:scale-105 transition-transform flex-shrink-0 relative overflow-hidden flex items-center justify-center"
                                    style={{ backgroundColor: curHex }}
                                    title="Elegir tono exacto de color"
                                  >
                                    <input
                                      type="color"
                                      value={curHex.startsWith('#') ? curHex : '#18181b'}
                                      onChange={e => updateVariant(pIdx, vIdx, 'colorHex', e.target.value)}
                                      className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                                    />
                                  </label>

                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      placeholder="Color (ej: Negro, Rosa)"
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-bold h-9 outline-none focus:border-purple-400"
                                      value={curColor}
                                      onChange={e => {
                                        const cName = e.target.value;
                                        updateVariant(pIdx, vIdx, 'color', cName);
                                        if (!(variant as any)._customHexChosen) {
                                          updateVariant(pIdx, vIdx, 'colorHex', getColorHex(cName));
                                        }
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Atributo Secundario (Forma / Modelo / Texto) */}
                                <div className="flex-1 min-w-[150px]">
                                  <input
                                    type="text"
                                    placeholder={`${attrLabel} (ej: Flor, Corazón)`}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white h-9 outline-none focus:border-purple-400"
                                    value={curShape}
                                    onChange={e => {
                                      updateVariant(pIdx, vIdx, 'attributeValue', e.target.value);
                                      updateVariant(pIdx, vIdx, 'size', e.target.value || 'Único');
                                    }}
                                  />
                                </div>

                                {/* Selector de Foto de la Variante */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {curImg ? (
                                    <div className="relative group/varimg size-9 rounded-lg border border-purple-300 dark:border-purple-700 overflow-hidden shadow-sm">
                                      <img
                                        src={curImg.startsWith('http') ? curImg : (apiUrl ? `${apiUrl}${curImg}` : curImg)}
                                        alt=""
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => openMediaLib(pIdx, false, vIdx)}
                                        title="Cambiar foto de esta variante"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateVariant(pIdx, vIdx, 'imageUrl', '');
                                        }}
                                        className="absolute top-0 right-0 size-3.5 bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/varimg:opacity-100 transition-opacity rounded-bl text-[9px] font-bold"
                                        title="Quitar foto"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      {/* Subir archivo local */}
                                      <label
                                        className="h-9 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                                        title="Subir foto para esta variante"
                                      >
                                        <span className="material-symbols-outlined text-[15px]">add_photo_alternate</span>
                                        <span>Foto</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={e => handleVariantFileUpload(pIdx, vIdx, e.target.files)}
                                        />
                                      </label>
                                      {/* Elegir de biblioteca */}
                                      <button
                                        type="button"
                                        onClick={() => openMediaLib(pIdx, false, vIdx)}
                                        className="size-9 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors"
                                        title="Elegir de la biblioteca de medios"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">photo_library</span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Stock */}
                                <div className="w-[72px] flex-shrink-0">
                                  <label className="block text-[9px] text-center font-bold text-slate-500 mb-0.5 leading-none">Stock</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    placeholder="1"
                                    className="w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm text-slate-900 dark:text-white font-bold h-9 outline-none focus:ring-1 focus:ring-purple-400"
                                    value={variant.quantity ?? ''}
                                    onChange={e => updateVariant(pIdx, vIdx, 'quantity', e.target.value)}
                                  />
                                </div>

                                {/* Precios por variante (si están activados) */}
                                {Boolean((prod as any).hasVariantPricing) && (
                                  <>
                                    <div className="w-[100px] flex-shrink-0">
                                      <label className="block text-[9px] text-center font-bold text-slate-500 mb-0.5 leading-none">Costo ({CURRENCY_SYMBOLS[purchaseCurrency]})</label>
                                      <PriceInput
                                        currencySymbol={CURRENCY_SYMBOLS[purchaseCurrency]}
                                        allowDecimals={true}
                                        placeholder="0"
                                        className="w-full text-center bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/50 rounded-lg px-1 py-1 text-sm text-red-600 font-bold h-9"
                                        value={variant.unitPurchasePrice === 0 ? '' : (variant.unitPurchasePrice ?? '')}
                                        onChange={val => updateVariant(pIdx, vIdx, 'unitPurchasePrice', val === '' ? 0 : val)}
                                      />
                                    </div>

                                    {!(prod as any).notForPublicSale && (() => {
                                      const costARS = (Number(variant.unitPurchasePrice) || 0) * effectiveExchangeRate;
                                      const sugPV = globalMarkupPrc > 0 ? Math.round(costARS * (1 + globalMarkupPrc / 100)) : 0;
                                      const manualPV = (variant as any).manualSalePrice;
                                      const displayPV = manualPV !== undefined && manualPV !== '' ? Number(manualPV) : sugPV;
                                      const manualWP = (variant as any).manualWholesalePrice;
                                      const autoWP = (displayPV > 0 && wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0)
                                        ? Math.round(displayPV * (1 - wholesaleConfig.discountPercentage / 100))
                                        : 0;
                                      const displayWP = manualWP !== undefined && manualWP !== '' ? Number(manualWP) : autoWP;
                                      return (
                                        <>
                                          <div className="w-[105px] flex-shrink-0">
                                            <label className="block text-[9px] text-center font-bold text-emerald-600 mb-0.5 leading-none">P. Venta ($)</label>
                                            <PriceInput
                                              currencySymbol="$"
                                              allowDecimals={false}
                                              placeholder={sugPV > 0 ? sugPV : '0'}
                                              className="w-full text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-lg px-1 py-1 text-sm text-emerald-700 dark:text-emerald-300 font-bold h-9"
                                              value={displayPV || ''}
                                              onChange={val => {
                                                const pv = typeof val === 'number' ? val : 0;
                                                updateVariant(pIdx, vIdx, 'manualSalePrice', pv);
                                                if ((variant as any)._wholesaleManual) return;
                                                const newWP = (pv > 0 && wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0)
                                                  ? Math.round(pv * (1 - wholesaleConfig.discountPercentage / 100))
                                                  : 0;
                                                updateVariant(pIdx, vIdx, 'manualWholesalePrice', newWP);
                                              }}
                                            />
                                          </div>
                                          <div className="w-[105px] flex-shrink-0">
                                            <label className="block text-[9px] text-center font-bold text-indigo-500 mb-0.5 leading-none">P. Mayorista ($)</label>
                                            <PriceInput
                                              currencySymbol="$"
                                              allowDecimals={false}
                                              placeholder={autoWP > 0 ? autoWP : '0'}
                                              className="w-full text-center bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-700 rounded-lg px-1 py-1 text-sm text-indigo-600 dark:text-indigo-300 font-bold h-9"
                                              value={displayWP || ''}
                                              onChange={val => {
                                                updateVariant(pIdx, vIdx, 'manualWholesalePrice', typeof val === 'number' ? val : 0);
                                                updateVariant(pIdx, vIdx, '_wholesaleManual', true);
                                              }}
                                            />
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </>
                                )}

                                {/* Acciones */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => duplicateVariant(pIdx, vIdx)}
                                    title="Duplicar para agregar otra forma/subcategoría con este mismo color"
                                    className="size-9 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center justify-center transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeVariant(pIdx, vIdx)}
                                    className={`size-9 rounded-lg flex items-center justify-center transition-colors ${
                                      prod.variants.length > 1
                                        ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        : 'text-slate-300 opacity-40 cursor-not-allowed'
                                    }`}
                                    disabled={prod.variants.length <= 1}
                                    title="Eliminar variante"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // ─── MODO TRADICIONAL (Perfumería o categorías sin variantes visuales) ───
                  const canUseVisual = categorySupportsVisualVariants(prod.categoryId);
                  return (
                    <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-xs font-bold text-slate-500">2. Variantes (Ítem Físico)</label>
                        {canUseVisual && (
                          <label className="flex items-center gap-2 cursor-pointer bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 transition-colors select-none shadow-xs">
                            <input
                              type="checkbox"
                              checked={Boolean((prod as any).hasVisualVariants)}
                              onChange={e => updateProduct(pIdx, 'hasVisualVariants', e.target.checked)}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                            />
                            <span className="material-symbols-outlined text-[16px]">palette</span>
                            <span>Variantes por Color / Forma</span>
                          </label>
                        )}
                      </div>
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
                                <PriceInput
                                  currencySymbol={CURRENCY_SYMBOLS[purchaseCurrency]}
                                  allowDecimals={true}
                                  placeholder="0"
                                  className="w-full text-center bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/50 rounded-lg px-1 py-1 text-sm text-red-600 font-bold h-9"
                                  value={variant.unitPurchasePrice === 0 ? '' : (variant.unitPurchasePrice ?? '')}
                                  onChange={val => updateVariant(pIdx, vIdx, 'unitPurchasePrice', val === '' ? 0 : val)}
                                />
                              </div>
                              {purchaseCurrency !== 'ARS' && (
                                <div className="text-xs text-slate-500 whitespace-nowrap self-end pb-2">→ <span className="font-bold text-slate-700 dark:text-slate-300">${fmt(unitCostARS)}</span></div>
                              )}
                              {/* P. Venta sugerido */}
                              {!(prod as any).notForPublicSale && (() => {
                                const costARS = (Number(variant.unitPurchasePrice) || 0) * effectiveExchangeRate;
                                const sugPV = globalMarkupPrc > 0 ? Math.round(costARS * (1 + globalMarkupPrc / 100)) : 0;
                                const manualPV = (variant as any).manualSalePrice;
                                const displayPV = manualPV !== undefined && manualPV !== '' ? Number(manualPV) : sugPV;
                                const manualWP = (variant as any).manualWholesalePrice;
                                const autoWP = (displayPV > 0 && wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0)
                                  ? Math.round(displayPV * (1 - wholesaleConfig.discountPercentage / 100))
                                  : 0;
                                const displayWP = manualWP !== undefined && manualWP !== '' ? Number(manualWP) : autoWP;
                                return (
                                  <>
                                    <div className="w-[110px]">
                                      <label className="block text-[10px] text-center font-bold text-emerald-600 dark:text-emerald-400 mb-1 leading-none">P. Venta ($)</label>
                                      <PriceInput
                                        currencySymbol="$"
                                        allowDecimals={false}
                                        placeholder={sugPV > 0 ? sugPV : '0'}
                                        className="w-full text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-lg px-1 py-1 text-sm text-emerald-700 dark:text-emerald-300 font-bold h-9"
                                        value={displayPV || ''}
                                        onChange={val => {
                                          const pv = typeof val === 'number' ? val : 0;
                                          updateVariant(pIdx, vIdx, 'manualSalePrice', pv);
                                          if ((variant as any)._wholesaleManual) return;
                                          const newWP = (pv > 0 && wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0)
                                            ? Math.round(pv * (1 - wholesaleConfig.discountPercentage / 100))
                                            : 0;
                                          updateVariant(pIdx, vIdx, 'manualWholesalePrice', newWP);
                                        }}
                                      />
                                    </div>
                                    <div className="w-[110px]">
                                      <label className="block text-[10px] text-center font-bold text-indigo-500 dark:text-indigo-400 mb-1 leading-none">P. Mayorista ($)</label>
                                      <PriceInput
                                        currencySymbol="$"
                                        allowDecimals={false}
                                        placeholder={autoWP > 0 ? autoWP : '0'}
                                        className="w-full text-center bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-700 rounded-lg px-1 py-1 text-sm text-indigo-600 dark:text-indigo-300 font-bold h-9"
                                        value={displayWP || ''}
                                        onChange={val => {
                                          updateVariant(pIdx, vIdx, 'manualWholesalePrice', typeof val === 'number' ? val : 0);
                                          updateVariant(pIdx, vIdx, '_wholesaleManual', true);
                                        }}
                                      />
                                    </div>
                                  </>
                                );
                              })()}
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
                  );
                })()}

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

          {/* PASO 3: Envío e Impuestos */}
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-black text-green-800 dark:text-green-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">local_shipping</span> Paso 3 — Costo de Envío e Impuestos (opcional)
              </h3>
            </div>

            {/* Fila 1: Costo de Envío */}
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              {/* Selector de moneda — siempre a la izquierda */}
              <div className="w-full sm:w-44 shrink-0">
                <label className="block text-xs font-bold text-slate-500 mb-1">Moneda del Envío</label>
                <select
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white"
                  value={shippingCurrency}
                  onChange={e => setShippingCurrency(e.target.value as Currency)}
                >
                  <option value="ARS">🇦🇷 Pesos (ARS)</option>
                  {purchaseCurrency !== 'ARS' && (
                    <option value={purchaseCurrency}>
                      {purchaseCurrency === 'USD' ? '🇺🇸 Dólar (USD)' : purchaseCurrency === 'BRL' ? '🇧🇷 Real (BRL)' : '🇵🇾 Guaraní (PYG)'}
                    </option>
                  )}
                </select>
              </div>

              {/* Descripción del envío */}
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Llega el jueves 27, via Andreani..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={shippingDescription}
                  onChange={e => setShippingDescription(e.target.value)}
                />
              </div>

              {/* Monto en la moneda elegida */}
              <div className="w-full sm:w-48 shrink-0">
                <label className="block text-xs font-bold text-slate-500 mb-1">Valor del Envío ({CURRENCY_SYMBOLS[shippingCurrency]})</label>
                <PriceInput
                  currencySymbol={CURRENCY_SYMBOLS[shippingCurrency]}
                  allowDecimals={true}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-green-700 dark:text-green-400"
                  value={shippingCostOriginal === 0 ? '' : (shippingCostOriginal ?? '')}
                  onChange={val => setShippingCostOriginal(val === '' ? '' : val)}
                />
              </div>

              {/* Equivalente en ARS — solo si la moneda de envío no es ARS */}
              {shippingCurrency !== 'ARS' && (
                <div className="w-full sm:w-40 shrink-0">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Total Envío en ARS</label>
                  <div className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-green-700 dark:text-green-400 font-mono text-right">
                    ${fmt(shippingCostARS)}
                    {(Number(exchangeRate) || 0) <= 0 && <span className="text-[10px] text-amber-500 block font-normal">⚠ Cotiz. no definida</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Sección de Impuestos / Tasas extra */}
            <div className="pt-3 border-t border-green-200/60 dark:border-green-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">receipt</span> Impuestos / Tasas extra (opcional)
                </span>
                <button
                  type="button"
                  onClick={addTaxItem}
                  className="flex items-center gap-1 text-[11px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 px-2.5 py-1 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span> Agregar impuesto
                </button>
              </div>

              {extraTaxes.length === 0 && (
                <p className="text-[11px] text-slate-400 italic">Sin impuestos extra cargados. Hacé clic en "+ Agregar impuesto" para añadir uno.</p>
              )}

              {extraTaxes.map((tax, tidx) => {
                const taxARS = calculateTaxItemARS(tax);
                const taxRate = tax.currency === 'ARS' ? 1 : (Number(exchangeRate) || 0);
                const isForeignTax = tax.currency !== 'ARS';
                return (
                  <div key={tax.id} className="flex flex-col sm:flex-row gap-2 items-end bg-white/60 dark:bg-slate-800/50 border border-green-200/70 dark:border-green-800/40 rounded-xl p-2.5">
                    {/* Moneda — siempre a la izquierda */}
                    <div className="w-full sm:w-40 shrink-0">
                      {tidx === 0 && <label className="block text-xs font-bold text-slate-500 mb-1">Moneda</label>}
                      <select
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white"
                        value={tax.currency}
                        onChange={e => updateTaxItem(tax.id, 'currency', e.target.value as Currency)}
                      >
                        <option value="ARS">🇦🇷 Pesos (ARS)</option>
                        {purchaseCurrency !== 'ARS' && (
                          <option value={purchaseCurrency}>
                            {purchaseCurrency === 'USD' ? '🇺🇸 Dólar (USD)' : purchaseCurrency === 'BRL' ? '🇧🇷 Real (BRL)' : '🇵🇾 Guaraní (PYG)'}
                          </option>
                        )}
                      </select>
                    </div>

                    {/* Descripción */}
                    <div className="flex-1">
                      {tidx === 0 && <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>}
                      <input
                        type="text"
                        placeholder="Ej: IVA, Aduana, Tasa..."
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={tax.description}
                        onChange={e => updateTaxItem(tax.id, 'description', e.target.value)}
                      />
                    </div>

                    {/* Monto original */}
                    <div className="w-full sm:w-40 shrink-0">
                      {tidx === 0 && <label className="block text-xs font-bold text-slate-500 mb-1">Monto ({CURRENCY_SYMBOLS[tax.currency]})</label>}
                      <PriceInput
                        currencySymbol={CURRENCY_SYMBOLS[tax.currency]}
                        allowDecimals={true}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-green-700 dark:text-green-400"
                        value={tax.amount === 0 ? '' : (tax.amount ?? '')}
                        onChange={val => updateTaxItem(tax.id, 'amount', val === '' ? '' : val)}
                      />
                    </div>

                    {/* Equivalente en ARS — solo si moneda ≠ ARS */}
                    {isForeignTax && (
                      <div className="w-full sm:w-40 shrink-0">
                        {tidx === 0 && <label className="block text-xs font-bold text-slate-500 mb-1">En ARS</label>}
                        <div className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-green-700 dark:text-green-400 font-mono text-right">
                          ${fmt(taxARS)}
                          {taxRate <= 0 && <span className="text-[10px] text-amber-500 block font-normal">⚠ Cotiz. no definida</span>}
                        </div>
                      </div>
                    )}

                    {/* Botón eliminar */}
                    <div className="shrink-0">
                      {tidx === 0 && <div className="hidden sm:block h-[20px] mb-1" />}
                      <button
                        type="button"
                        onClick={() => removeTaxItem(tax.id)}
                        className="h-[38px] w-[38px] flex items-center justify-center rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                        title="Eliminar impuesto"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Subtotal de todos los impuestos — solo si hay 2 o más */}
              {extraTaxes.length > 1 && taxCostARS > 0 && (
                <div className="flex items-center justify-between p-2 bg-white/70 dark:bg-slate-800/70 border border-green-200 dark:border-green-800/50 rounded-xl text-xs mt-1">
                  <span className="font-bold text-slate-500">Total impuestos ({extraTaxes.length} concepto{extraTaxes.length !== 1 ? 's' : ''})</span>
                  <span className="font-mono font-black text-green-700 dark:text-green-400">+${fmt(taxCostARS)} ARS</span>
                </div>
              )}
            </div>

            {/* Barra total Envío + Impuestos */}
            {totalShippingAndTaxARS > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-green-300/60 dark:border-green-700/40">
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap justify-center sm:justify-start">
                  {shippingCostARS > 0 && (
                    <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 font-mono font-bold text-green-700 dark:text-green-400">
                      Envío: ${fmt(shippingCostARS)}
                    </span>
                  )}
                  {shippingCostARS > 0 && taxCostARS > 0 && <span className="text-slate-400 font-bold">+</span>}
                  {taxCostARS > 0 && (
                    <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 font-mono font-bold text-green-700 dark:text-green-400">
                      Impuestos: ${fmt(taxCostARS)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-green-600 dark:bg-green-700 text-white px-4 py-1.5 rounded-xl text-sm font-black">
                  <span className="material-symbols-outlined text-[16px]">calculate</span>
                  Total a prorratear: ${fmt(totalShippingAndTaxARS)} ARS
                </div>
              </div>
            )}
          </div>

          {/* Barra totales + CTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="flex gap-6 text-sm">
              {[['Productos', products.length, 'text-slate-800 dark:text-white'], ['Unidades', totalUnidades, 'text-primary'], [`Compra ARS`, `$${fmt(totalCompraARS)}`, 'text-slate-800 dark:text-white'], [`+ Envío e Imp.`, `$${fmt(totalShippingAndTaxARS)}`, 'text-green-600']].map(([label, value, cls]) => (
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
        const totalCostFinalSummary = totalCompraARS + totalShippingAndTaxARS;
        const totalSaleValueSummary = summaryRows.reduce((s, r) => {
          if (r.notForPublicSale) return s;
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
                {[['Proveedor', supplierInput || '—'], ['Moneda', purchaseCurrency === 'ARS' ? 'Pesos ARS' : `${purchaseCurrency} → $${fmt(Number(exchangeRate) || 0)}`], ['Total Compra', `$${fmt(totalCompraARS)}`], ['Total + Envío/Imp.', `$${fmt(totalCompraARS + totalShippingAndTaxARS)}`]].map(([label, value]) => (
                  <div key={String(label)} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{value}</span>
                  </div>
                ))}
              </div>

              {/* Detalle de envío e impuestos en el resumen si existen */}
              {(totalShippingAndTaxARS > 0 || shippingDescription.trim() !== '') && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-green-50/80 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-xl text-xs text-green-900 dark:text-green-200">
                  <span className="font-bold flex items-center gap-1 text-green-800 dark:text-green-300">
                    <span className="material-symbols-outlined text-[16px] text-green-600">local_shipping</span>
                    Envío:
                  </span>
                  <span className="font-mono font-bold">${fmt(shippingCostARS)} ARS</span>
                  {shippingDescription.trim() !== '' && (
                    <span className="text-slate-600 dark:text-slate-400 font-medium">({shippingDescription.trim()})</span>
                  )}
                  {taxCostARS > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600 mx-1">•</span>
                      <span className="font-bold flex items-center gap-1 text-green-800 dark:text-green-300">
                        <span className="material-symbols-outlined text-[16px] text-green-600">receipt</span>
                        Impuestos ({extraTaxes.length}):
                      </span>
                      <span className="font-mono font-bold">+${fmt(taxCostARS)} ARS</span>
                    </>
                  )}
                </div>
              )}
              {/* Banner de alerta si hay conflictos pendientes */}
              {(() => {
                const pendingCount = summaryRows.filter(r => isRowConflict(r) && r.salePriceConflict === null).length;
                if (pendingCount === 0) return null;
                return (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs font-bold">
                      <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
                      <span>Hay <strong>{pendingCount} variante(s)</strong> con costo diferente al stock anterior de esa misma variante. Seleccioná qué hacer con el precio de venta.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const firstIdx = summaryRows.findIndex(r => isRowConflict(r) && r.salePriceConflict === null);
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
                      <th className="pb-2 pr-3 text-right min-w-[120px] text-emerald-600 dark:text-emerald-400">P. Venta ✏️</th>
                      <th className="pb-2 text-right min-w-[120px] text-indigo-500 dark:text-indigo-400">P. Mayorista ✏️</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summaryRows.map((row, idx) => {
                      const hasConflict = isRowConflict(row);
                      const prevVariantSalePrice = row.existingVariant?.manualSalePrice ?? (row.existingProd?.variants?.length === 1 ? row.existingProd.salePrice : 0) ?? row.salePrice;
                      const displaySalePrice = row.salePriceConflict === 'keep' ? prevVariantSalePrice : row.salePrice;
                      const prevVariantCost = row.existingVariant?.unitPurchasePrice ?? (row.existingProd?.variants?.length === 1 ? row.existingProd.purchasePrice : 0) ?? 0;
                      return (
                        <tr key={idx} className={row.notForPublicSale ? 'bg-purple-50/30 dark:bg-purple-950/15' : hasConflict ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-800 dark:text-slate-200">{row.productName}</p>
                              {row.notForPublicSale && (
                                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[11px]">visibility_off</span>
                                  Fuera de venta
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400">{row.variantLabel}</p>
                            {hasConflict && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                  ⚠ Costo ant: ${fmt(prevVariantCost)}
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
                          <td className="py-2 pr-3 text-right font-mono text-slate-600 dark:text-slate-400">{purchaseCurrency !== 'ARS' ? `${CURRENCY_SYMBOLS[purchaseCurrency]} ${fmtUSD(row.unitCostOriginal)}` : `$ ${fmt(row.unitCostOriginal)}`}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(row.unitCostARS)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-green-600 dark:text-green-400">${fmt(row.shippingPerUnitARS)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(row.totalCostPerUnitARS)}</td>
                          <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt(row.totalCostPerUnitARS * row.quantity)}</td>
                          <td className="py-2 pr-3 text-right">
                            {row.notForPublicSale ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2.5 py-1 rounded-lg">
                                <span className="material-symbols-outlined text-[13px]">visibility_off</span>
                                Sin venta
                              </span>
                            ) : (
                              <PriceInput
                                currencySymbol="$"
                                allowDecimals={false}
                                placeholder="0"
                                className={`w-28 text-right bg-white dark:bg-slate-700 border rounded-lg px-2 py-1 text-xs font-black transition-colors ${displaySalePrice > 0 ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-600 text-slate-600'}`}
                                value={displaySalePrice || ''}
                                disabled={row.salePriceConflict === 'keep'}
                                onChange={val => {
                                  const pv = typeof val === 'number' ? val : 0;
                                  updateSummaryRow(idx, 'salePrice', pv);
                                  if (row.salePriceConflict === 'custom') updateSummaryRow(idx, 'customSalePrice', pv);
                                  // Recalculate wholesale from new sale price
                                  if (wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0) {
                                    updateSummaryRow(idx, 'wholesalePrice', pv > 0 ? Math.round(pv * (1 - wholesaleConfig.discountPercentage / 100)) : 0);
                                  }
                                }}
                              />
                            )}
                          </td>
                          <td className="py-2 text-right">
                            {row.notForPublicSale ? (
                              <span className="text-[11px] text-purple-400">—</span>
                            ) : (
                              <PriceInput
                                currencySymbol="$"
                                allowDecimals={false}
                                placeholder="0"
                                className={`w-28 text-right bg-indigo-50 dark:bg-indigo-950/30 border rounded-lg px-2 py-1 text-xs font-black transition-colors ${row.wholesalePrice > 0 ? 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-600 text-slate-500'}`}
                                value={row.wholesalePrice || ''}
                                onChange={val => updateSummaryRow(idx, 'wholesalePrice', typeof val === 'number' ? val : 0)}
                              />
                            )}
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
                      <td className="py-2.5 pr-3 text-right font-mono text-green-600 font-bold">${fmt(totalShippingAndTaxARS)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-400">—</td>
                      <td className="py-2.5 pr-3 text-right font-mono font-black text-slate-900 dark:text-white">${fmt(totalCostFinalSummary)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-black">${fmt(totalSaleValueSummary)}</td>
                      <td className="py-2.5 text-right font-mono text-indigo-600 dark:text-indigo-400 font-black">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Vista Mobile: Tarjetas compactas con Precio de Venta al frente sin scroll horizontal */}
              <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5">
                {summaryRows.map((row, idx) => {
                  const hasConflict = isRowConflict(row);
                  const prevVariantSalePrice = row.existingVariant?.manualSalePrice ?? (row.existingProd?.variants?.length === 1 ? row.existingProd.salePrice : 0) ?? row.salePrice;
                  const displaySalePrice = row.salePriceConflict === 'keep' ? prevVariantSalePrice : row.salePrice;
                  const prevVariantCost = row.existingVariant?.unitPurchasePrice ?? (row.existingProd?.variants?.length === 1 ? row.existingProd.purchasePrice : 0) ?? 0;
                  return (
                    <div key={idx} className={`border rounded-2xl p-3.5 space-y-2.5 ${row.notForPublicSale ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800' : hasConflict ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight">{row.productName}</p>
                            {row.notForPublicSale && (
                              <span className="text-[9px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">visibility_off</span>
                                Fuera de venta
                              </span>
                            )}
                          </div>
                          {row.variantLabel && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{row.variantLabel}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          {row.notForPublicSale ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2 py-1 rounded-lg">
                              <span className="material-symbols-outlined text-[12px]">visibility_off</span>
                              Sin venta
                            </span>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <div>
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5 block">P. Venta ✏️</span>
                                <PriceInput
                                  currencySymbol="$"
                                  allowDecimals={false}
                                  placeholder="0"
                                  className={`w-28 pl-2 pr-2 py-1 text-right bg-white dark:bg-slate-700 border rounded-xl text-xs font-black transition-colors ${displaySalePrice > 0 ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-600 text-slate-600'}`}
                                  value={displaySalePrice || ''}
                                  disabled={row.salePriceConflict === 'keep'}
                                  onChange={val => {
                                    const pv = typeof val === 'number' ? val : 0;
                                    updateSummaryRow(idx, 'salePrice', pv);
                                    if (row.salePriceConflict === 'custom') updateSummaryRow(idx, 'customSalePrice', pv);
                                    if (wholesaleConfig?.enabled !== false && (wholesaleConfig?.discountPercentage || 0) > 0) {
                                      updateSummaryRow(idx, 'wholesalePrice', pv > 0 ? Math.round(pv * (1 - wholesaleConfig.discountPercentage / 100)) : 0);
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-0.5 block">P. Mayorista ✏️</span>
                                <PriceInput
                                  currencySymbol="$"
                                  allowDecimals={false}
                                  placeholder="0"
                                  className={`w-28 pl-2 pr-2 py-1 text-right bg-indigo-50 dark:bg-indigo-950/30 border rounded-xl text-xs font-black transition-colors ${row.wholesalePrice > 0 ? 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-600 text-slate-500'}`}
                                  value={row.wholesalePrice || ''}
                                  onChange={val => updateSummaryRow(idx, 'wholesalePrice', typeof val === 'number' ? val : 0)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {hasConflict && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            ⚠ Costo ant: ${fmt(prevVariantCost)}
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

                  {/* 2. Moneda original o Costo Envío si es ARS */}
                  {purchaseCurrency !== 'ARS' ? (
                    <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 text-center flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                        {purchaseCurrency === 'USD' ? 'Costo en USD' : purchaseCurrency === 'PYG' ? 'Costo en Guaraníes' : purchaseCurrency === 'BRL' ? 'Costo en Reales' : `Costo en ${purchaseCurrency}`}
                      </span>
                      <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono leading-tight">
                        {formatOrigCost(totalCostOrigSummary, purchaseCurrency)}
                      </span>
                      <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block font-medium">
                        costo mercadería
                      </span>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Envío e Imp.</span>
                      <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400 font-mono leading-tight">${fmt(totalShippingAndTaxARS)}</span>
                      <span className="text-[10px] text-slate-400 block font-medium">flete e imp. total</span>
                    </div>
                  )}

                  {/* 3. Costo Total en Pesos */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {purchaseCurrency !== 'ARS' ? 'Costo en Pesos' : 'Costo Mercadería'}
                    </span>
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
                <button type="button" onClick={handleConfirmSave} disabled={saving} className={`w-full sm:w-auto px-7 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${editingBatchId ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25' : 'bg-primary hover:bg-primary/90 shadow-primary/25'}`}>
                  {saving ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">{editingBatchId ? 'save' : 'check_circle'}</span>}
                  {saving ? 'Guardando...' : editingBatchId ? 'Guardar Cambios del Lote' : 'Confirmar Ingreso'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: CONFLICTO DE PRECIO */}
      {conflictModal && (() => {
        const totalConflicts = summaryRows.filter(r => isRowConflict(r)).length;
        const currentConflictIdx = summaryRows.filter((r, i) => i <= conflictModal.rowIdx && isRowConflict(r)).length;

        const prevCost = conflictModal.row.existingVariant?.unitPurchasePrice ?? (conflictModal.row.existingProd?.variants?.length === 1 ? conflictModal.row.existingProd.purchasePrice : 0) ?? 0;
        const prevSalePrice = conflictModal.row.existingVariant?.manualSalePrice ?? (conflictModal.row.existingProd?.variants?.length === 1 ? conflictModal.row.existingProd.salePrice : 0) ?? conflictModal.row.salePrice;
        const existingStock = conflictModal.row.existingVariant?.stock ?? 0;
        const stockUnitsText = `${existingStock} unidades`;

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
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Anterior ({conflictModal.row.variantLabel})</span>
                    <p className="text-slate-700 dark:text-slate-300 font-bold">{stockUnitsText}</p>
                    <p className="text-slate-500">Costo: <span className="font-bold text-red-500">${fmt(prevCost)}</span></p>
                    <p className="text-slate-500">Precio de Venta actual: <span className="font-bold text-slate-900 dark:text-white">${fmt(prevSalePrice)}</span></p>
                  </div>
                  <div className="space-y-1 bg-amber-100/50 dark:bg-amber-950/40 p-2 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Nuevo Ingreso</span>
                    <p className="text-slate-700 dark:text-slate-300 font-bold">+{conflictModal.row.quantity} unidades</p>
                    <p className="text-slate-500">Costo c/envío: <span className="font-bold text-red-600">${fmt(conflictModal.row.totalCostPerUnitARS)}</span></p>
                    <p className="text-slate-500">Precio de Venta sugerido: <span className="font-bold text-emerald-600">${fmt(conflictModal.row.suggestedSalePrice)}</span></p>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs">
                  El costo de esta variante cambió. ¿Cómo querés actualizar su precio de venta?
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
                    <p className="font-black text-slate-900 dark:text-white text-xs">Actualizar al nuevo Precio de Venta (${fmt(conflictModal.row.suggestedSalePrice)})</p>
                    <p className="text-[11px] text-slate-500">Tanto las {stockUnitsText} viejas como las nuevas de esta variante se venderán al nuevo Precio de Venta.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => resolveConflict(conflictModal.rowIdx, 'keep', prevSalePrice || conflictModal.row.salePrice)}
                  className="w-full flex items-center gap-3 p-3.5 border-2 border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 rounded-2xl transition text-left group"
                >
                  <span className="size-8 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-sm shrink-0">2</span>
                  <div className="flex-1">
                    <p className="font-black text-slate-900 dark:text-white text-xs">Mantener el Precio de Venta anterior (${fmt(prevSalePrice)})</p>
                    <p className="text-[11px] text-slate-500">Se mantiene el Precio de Venta anterior para esta variante. Solo se suma el stock.</p>
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
                    <PriceInput
                      currencySymbol="$"
                      allowDecimals={false}
                      placeholder="Ej: $ 35.000"
                      className="flex-1 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-200"
                      value={conflictModal.row.customSalePrice || ''}
                      onChange={val => {
                        const num = typeof val === 'number' ? val : 0;
                        setConflictModal(cm => cm ? { ...cm, row: { ...cm.row, customSalePrice: num } } : null);
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
              const totalCostFinal = items.reduce((s: number, it: any) => s + Math.round(Number(it.total_cost_per_unit_ars) || 0) * (Number(it.quantity) || 0), 0);
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
                                ? `${CURRENCY_SYMBOLS[detailBatch.currency as Currency] || ''} ${fmtUSD(Number(it.unit_cost_original))}`
                                : `$ ${fmt(it.unit_cost_original)}`}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(it.unit_cost_ars)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-green-600 font-bold">${fmt(it.shipping_per_unit_ars)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-slate-700 dark:text-slate-300">${fmt(it.total_cost_per_unit_ars)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt(Math.round(it.total_cost_per_unit_ars) * it.quantity)}</td>
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
                              ? `${CURRENCY_SYMBOLS[detailBatch.currency as Currency] || ''} ${fmtUSD(totalCostOrig)}`
                              : `$ ${fmt(totalCostOrig)}`}
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
                            <span className="text-[10px] font-mono font-black text-primary">${fmt(Math.round(it.total_cost_per_unit_ars) * it.quantity)}</span>
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

                      {/* 2. Moneda original o Costo Envío si es ARS */}
                      {detailBatch.currency !== 'ARS' ? (
                        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 text-center flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                            {detailBatch.currency === 'USD' ? 'Costo en USD' : detailBatch.currency === 'PYG' ? 'Costo en Guaraníes' : detailBatch.currency === 'BRL' ? 'Costo en Reales' : `Costo en ${detailBatch.currency}`}
                          </span>
                          <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono leading-tight">
                            {formatOrigCost(totalCostOrig, detailBatch.currency)}
                          </span>
                          <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block font-medium">
                            costo mercadería
                          </span>
                        </div>
                      ) : (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo Envío</span>
                          <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400 font-mono leading-tight">${fmt(totalShippingARS)}</span>
                          <span className="text-[10px] text-slate-400 block font-medium">flete total</span>
                        </div>
                      )}

                      {/* 3. Costo Total en Pesos */}
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {detailBatch.currency !== 'ARS' ? 'Costo en Pesos' : 'Costo Mercadería'}
                        </span>
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

      {/* Overlay de carga mientras se popula el formulario */}
      {loadingEditBatch && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
            <span className="material-symbols-outlined animate-spin text-4xl text-amber-500">progress_activity</span>
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">Cargando datos del lote...</p>
            <p className="text-xs text-slate-400">Preparando el formulario para editar</p>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR REEMPLAZAR BORRADOR CON EDICIÓN */}
      {showReplaceWithEditModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-800/60 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">swap_horiz</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    ¿Reemplazar datos en curso?
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    Hay una carga en progreso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowReplaceWithEditModal(false); setPendingEditBatchId(null); }}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 space-y-2 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-base">warning</span>
                Ya tenés datos cargados en el formulario de nueva compra
              </p>
              <p>
                Si continuás, <strong>todos los datos no guardados</strong> del formulario actual serán reemplazados por los datos del lote que querés editar.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowReplaceWithEditModal(false); setPendingEditBatchId(null); }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = pendingEditBatchId;
                  setShowReplaceWithEditModal(false);
                  setPendingEditBatchId(null);
                  if (id) await _loadBatchIntoForm(id);
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                Sí, reemplazar y editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINAR DATOS (BORRADOR / CANCELAR EDICIÓN) */}
      {showClearDraftModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-3">
                <div className={`size-11 rounded-2xl flex items-center justify-center ${editingBatchId ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600' : 'bg-red-100 dark:bg-red-950/50 text-red-600'}`}>
                  <span className="material-symbols-outlined text-2xl">{editingBatchId ? 'tune' : 'delete_sweep'}</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    {editingBatchId ? '¿Qué datos querés eliminar?' : '¿Eliminar todos los datos?'}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    {editingBatchId ? `Editando lote ${editingBatchNumber}` : 'Ingreso de mercadería en curso'}
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

            {editingBatchId ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Estás editando el lote <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{editingBatchNumber}</span>. Elegí cómo querés proceder:
                </p>

                {/* Opción 1: Eliminar productos pero continuar edición */}
                <button
                  type="button"
                  onClick={handleClearProductsOnly}
                  className="w-full text-left p-3.5 rounded-2xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-all flex items-start gap-3.5 group shadow-sm hover:shadow"
                >
                  <div className="size-10 rounded-xl bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-xl">playlist_remove</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                        Eliminar productos y continuar edición
                      </p>
                      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                      Se vacían los productos cargados, pero <strong>se conservan</strong>:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                      <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/50 rounded-md">✓ Proveedor</span>
                      <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/50 rounded-md">✓ Fecha</span>
                      <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/50 rounded-md">✓ Moneda y Cotización</span>
                      <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900/50 rounded-md">✓ Costo de Envío</span>
                    </div>
                  </div>
                </button>

                {/* Opción 2: Cancelar edición y vaciar todo */}
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="w-full text-left p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-900/30 transition-all flex items-start gap-3.5 group shadow-sm hover:shadow"
                >
                  <div className="size-10 rounded-xl bg-rose-200 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-xl">delete_sweep</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-rose-900 dark:text-rose-200">
                        Cancelar edición y vaciar todo
                      </p>
                      <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300/80 mt-1 leading-relaxed">
                      Se cancela la edición del lote y se borran todos los datos. La pantalla quedará lista para registrar una <strong>nueva compra</strong> de cero.
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 space-y-2 text-xs text-red-800 dark:text-red-300">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <span className="material-symbols-outlined text-base">warning</span>
                  ¿Estás seguro de que querés resetear este formulario?
                </p>
                <p>
                  Se borrarán todos los productos, variantes, costos, proveedor y datos ingresados en este borrador. Esta acción no se puede deshacer y el formulario quedará completamente limpio.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowClearDraftModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Volver
              </button>
              {!editingBatchId && (
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">delete_sweep</span>
                  Sí, eliminar todo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GENERADOR DE VARIANTES POR MATRIZ */}
      {matrixModalPIdx !== null && products[matrixModalPIdx] && (
        <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">auto_awesome</span>
                Generador Rápido de Variantes
              </h3>
              <button
                type="button"
                onClick={() => setMatrixModalPIdx(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 material-symbols-outlined text-lg"
              >
                close
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Escribe los colores y {getCategoryAttributeLabel(products[matrixModalPIdx]?.categoryId).toLowerCase()} separados por comas. El sistema creará automáticamente todas las combinaciones con 1 unidad de stock cada una.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Colores (separados por coma)
              </label>
              <input
                type="text"
                placeholder="Ej: Rojo, Verde, Rosa, Negro"
                value={matrixColorsInput}
                onChange={e => setMatrixColorsInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {getCategoryAttributeLabel(products[matrixModalPIdx]?.categoryId)} (opcional, separados por coma)
              </label>
              <input
                type="text"
                placeholder="Ej: Flor, Corazón, Trébol"
                value={matrixShapesInput}
                onChange={e => setMatrixShapesInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMatrixModalPIdx(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  generateMatrixVariants(matrixModalPIdx, matrixColorsInput, matrixShapesInput);
                  setMatrixModalPIdx(null);
                  setMatrixColorsInput('');
                  setMatrixShapesInput('');
                }}
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-600/25 transition"
              >
                Generar Combinaciones
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
                    {mediaLibTargetVIdx !== null && (
                      <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                        Variante: {(products[mediaLibTargetPIdx]?.variants[mediaLibTargetVIdx] as any)?.color || ''} {(products[mediaLibTargetPIdx]?.variants[mediaLibTargetVIdx] as any)?.attributeValue || ''}
                      </span>
                    )}
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
                          onClick={() => {
                            if (mediaLibTargetVIdx !== null && mediaLibTargetPIdx !== null) {
                              updateVariant(mediaLibTargetPIdx, mediaLibTargetVIdx, 'imageUrl', item.url);
                              const cur = products[mediaLibTargetPIdx]?.newProductImageUrls || [];
                              if (!cur.includes(item.url)) {
                                updateProduct(mediaLibTargetPIdx, 'newProductImageUrls', [...cur, item.url]);
                              }
                              setMediaLibTargetVIdx(null);
                              setMediaLibTargetPIdx(null);
                            } else if (mediaLibTargetPIdx !== null) {
                              toggleProductImage(mediaLibTargetPIdx, item.url);
                            }
                          }}
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
