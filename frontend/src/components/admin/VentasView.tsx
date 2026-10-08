'use client';
import { useState, useEffect } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';

interface VentasViewProps {
  showAlert: (msg: string) => void;
  apiKey?: string;
  apiUrl?: string;
}

export default function VentasView({ showAlert, apiKey, apiUrl }: VentasViewProps) {
  const products = useStockFlowStore(s => s.products);
  const registerSale = useStockFlowStore(s => s.registerSale);
  const categoriesConfig = useStockFlowStore(s => s.categoriesConfig);
  const allCategories = categoriesConfig.flatMap(g => g.opciones);

  const [customers, setCustomers] = useState<any[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientType, setClientType] = useState<'normal' | 'wholesale' | 'special_wholesale'>('normal');
  const [customUnitPriceInput, setCustomUnitPriceInput] = useState<string>('');
  
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [cart, setCart] = useState<{productId: string, variantId: string, name: string, quantity: number, salePrice: number}[]>([]);

  // Modal de pago / cuotas
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'total' | 'partial' | 'cuotas'>('total');
  const [partialPaidInput, setPartialPaidInput] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [initialDownPayment, setInitialDownPayment] = useState<string>('0');
  const [saleNotes, setSaleNotes] = useState('');

  // Modal Eliminar Datos / Borrador
  const [showClearSaleModal, setShowClearSaleModal] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const DRAFT_VENTAS_KEY = 'lyg_draft_venta';

  // Cargar clientes registrados para autocompletado y detección de tipo de cuenta
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const key = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('admin_api_key') || '' : '');
        const base = apiUrl || '';
        const res = await fetch(`${base}/api/admin/users`, {
          headers: key ? { 'X-API-KEY': key } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCustomers(data);
          }
        }
      } catch (err) {
        console.error('Error al cargar clientes en VentasView:', err);
      }
    };
    fetchCustomers();
  }, [apiKey, apiUrl]);

  // Verifica si hay algún dato cargado
  const hasDraftData = Boolean(
    clientName.trim() !== '' ||
    clientPhone.trim() !== '' ||
    clientEmail.trim() !== '' ||
    cart.length > 0 ||
    selectedParentCategory !== '' ||
    selectedCategory !== '' ||
    selectedProductId !== '' ||
    productSearchText.trim() !== '' ||
    clientType !== 'normal'
  );

  // Cargar borrador persistido al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_VENTAS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.clientName !== undefined) setClientName(parsed.clientName);
        if (parsed.clientPhone !== undefined) setClientPhone(parsed.clientPhone);
        if (parsed.clientEmail !== undefined) setClientEmail(parsed.clientEmail);
        if (parsed.clientType !== undefined) setClientType(parsed.clientType);
        if (parsed.customUnitPriceInput !== undefined) setCustomUnitPriceInput(parsed.customUnitPriceInput);
        if (Array.isArray(parsed.cart)) setCart(parsed.cart);
        if (parsed.selectedParentCategory !== undefined) setSelectedParentCategory(parsed.selectedParentCategory);
        if (parsed.selectedCategory !== undefined) setSelectedCategory(parsed.selectedCategory);
        if (parsed.selectedProductId !== undefined) setSelectedProductId(parsed.selectedProductId);
        if (parsed.productSearchText !== undefined) setProductSearchText(parsed.productSearchText);
      }
    } catch (e) {
      console.error('Error al cargar borrador de venta:', e);
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
          clientName,
          clientPhone,
          clientEmail,
          clientType,
          customUnitPriceInput,
          cart,
          selectedParentCategory,
          selectedCategory,
          selectedProductId,
          productSearchText,
        };
        localStorage.setItem(DRAFT_VENTAS_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(DRAFT_VENTAS_KEY);
      }
    } catch (e) {
      console.error('Error al guardar borrador de venta:', e);
    }
  }, [isDraftLoaded, hasDraftData, clientName, clientPhone, clientEmail, clientType, customUnitPriceInput, cart, selectedParentCategory, selectedCategory, selectedProductId, productSearchText]);

  // Limpiar y resetear venta
  const handleClearSale = () => {
    setCart([]);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientType('normal');
    setCustomUnitPriceInput('');
    setSelectedParentCategory('');
    setSelectedCategory('');
    setSelectedProductId('');
    setProductSearchText('');
    setSelectedVariantId('');
    setQuantityToAdd(1);
    try {
      localStorage.removeItem(DRAFT_VENTAS_KEY);
    } catch {}
    setShowClearSaleModal(false);
    showAlert('🗑️ Datos de la venta eliminados.');
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Sincronizar precio manual sugerido cuando cambia el producto seleccionado
  useEffect(() => {
    if (selectedProduct) {
      setCustomUnitPriceInput(String(selectedProduct.salePrice));
    } else {
      setCustomUnitPriceInput('');
    }
  }, [selectedProductId, selectedProduct]);
  
  const availableVariants = selectedProduct 
    ? selectedProduct.variants.filter(v => v.stock > 0)
    : [];

  const availableProductsInCategory = products.filter(p => 
    p.categoryId === selectedCategory && p.variants.some(v => v.stock > 0)
  );

  const currentCategoryGroup = categoriesConfig.find(g => g.grupo === selectedParentCategory);
  const availableSubcategories = currentCategoryGroup ? currentCategoryGroup.opciones : [];

  const total = cart.reduce((acc, item) => acc + (item.quantity * item.salePrice), 0);

  // Autocompletar datos si el nombre seleccionado coincide con un cliente registrado
  const handleClientNameChange = (val: string) => {
    setClientName(val);
    const matched = customers.find(c => 
      c.name?.trim().toLowerCase() === val.trim().toLowerCase() ||
      c.email?.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      if (matched.phone) setClientPhone(matched.phone);
      if (matched.email) setClientEmail(matched.email);
      const cType = matched.customer_type || (matched.is_special_wholesale ? 'special_wholesale' : matched.is_wholesale ? 'wholesale' : 'normal');
      setClientType(cType as any);
    }
  };

  const addToCart = () => {
    if (!selectedProduct) {
        showAlert("Selecciona un producto primero.");
        return;
    }
    const variantItem = availableVariants.find(v => v.id === selectedVariantId);
    if (!variantItem) {
        showAlert("Selecciona una variante.");
        return;
    }
    if (variantItem.stock < quantityToAdd) {
        showAlert("Stock insuficiente para agregar al carrito.");
        return;
    }
    
    const displayName = `${selectedProduct.name} - ${variantItem.color} - Talle ${variantItem.size}`;

    // Si es mayorista especial, usar el precio unitario manual si está definido
    const effectivePrice = (clientType === 'special_wholesale' && customUnitPriceInput.trim() !== '')
      ? Math.max(0, parseFloat(customUnitPriceInput) || 0)
      : selectedProduct.salePrice;

    setCart([...cart, {
        productId: selectedProduct.id,
        variantId: variantItem.id,
        name: displayName,
        quantity: quantityToAdd,
        salePrice: effectivePrice
    }]);
    
    // reset selection for next item
    setSelectedVariantId('');
    setQuantityToAdd(1);
    if (selectedProduct) {
      setCustomUnitPriceInput(String(selectedProduct.salePrice));
    }
  };

  const handleOpenPaymentModal = () => {
    if(cart.length === 0) return;
    if(!clientName.trim()) {
      showAlert('El nombre del cliente es obligatorio.');
      return;
    }
    if(!clientPhone.trim()) {
      showAlert('El teléfono del cliente es obligatorio.');
      return;
    }
    setPaymentType('total');
    setPartialPaidInput('');
    setInitialDownPayment('0');
    setSaleNotes('');
    setShowPaymentModal(true);
  };

  const handleConfirmSale = () => {
    let finalPaid = total;
    let finalPending = 0;

    if (paymentType === 'partial') {
      const parsed = parseFloat(partialPaidInput) || 0;
      if (parsed < 0 || parsed > total) {
        showAlert('El monto abonado no puede ser negativo ni superar el total.');
        return;
      }
      finalPaid = parsed;
      finalPending = Math.max(0, total - parsed);
    } else if (paymentType === 'cuotas') {
      const down = parseFloat(initialDownPayment) || 0;
      if (down < 0 || down > total) {
        showAlert('El pago inicial no puede ser negativo ni mayor al total.');
        return;
      }
      finalPaid = down;
      finalPending = Math.max(0, total - down);
    }

    const ticketId = registerSale(clientName, clientPhone, cart, {
      paymentType,
      paidAmount: finalPaid,
      pendingAmount: finalPending,
      installmentsCount: paymentType === 'cuotas' ? installmentsCount : 1,
      notes: saleNotes.trim(),
      clientEmail: clientEmail.trim(),
      isSpecialWholesale: clientType === 'special_wholesale',
      clientType: clientType,
    });

    // Generar PDF y abrir para impresión
    generateTicketPDF(ticketId, useStockFlowStore.getState().sales, true);

    const msgSuccess = finalPending > 0
      ? `Venta en mostrador registrada. Saldo pendiente: $${finalPending.toLocaleString('es-AR')} (guardado en Cobros Pendientes).`
      : 'Venta procesada con éxito. Cobro total registrado.';
    
    showAlert(msgSuccess);
    setShowPaymentModal(false);
    try {
      localStorage.removeItem(DRAFT_VENTAS_KEY);
    } catch {}
    setCart([]);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientType('normal');
    setCustomUnitPriceInput('');
    setSelectedParentCategory('');
    setSelectedCategory('');
    setSelectedProductId('');
    setProductSearchText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Columna Izquierda: Punto de Venta */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="mb-6 border-b border-slate-100 dark:border-slate-700 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl">point_of_sale</span>
              Punto de Venta
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Vende seleccionando productos y luego sus variantes. El stock se descuenta exacto por talle y color.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowClearSaleModal(true)}
              disabled={!hasDraftData}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                hasDraftData
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 shadow-sm cursor-pointer'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
              }`}
              title={hasDraftData ? "Eliminar todos los datos cargados de la venta" : "No hay datos para eliminar"}
            >
              <span className="material-symbols-outlined text-lg">delete_sweep</span>
              Eliminar datos
            </button>
          </div>
        </div>

        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cliente (Obligatorio)</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                        <input 
                            type="text" placeholder="Ej. Ana Pérez"
                            list="ventas-clientes-list"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white font-medium"
                            value={clientName} onChange={e => handleClientNameChange(e.target.value)}
                        />
                        <datalist id="ventas-clientes-list">
                          {customers.map((c: any) => (
                            <option key={c.id} value={c.name}>
                              {c.customer_type === 'special_wholesale' || c.is_special_wholesale ? '👑 Mayorista Especial' : c.is_wholesale ? '📦 Mayorista' : '🛍️ Normal'} {c.phone ? `(${c.phone})` : ''}
                            </option>
                          ))}
                        </datalist>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Teléfono (Obligatorio)</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">phone</span>
                        <input 
                            type="tel" placeholder="Ej. 1123456789"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white font-medium"
                            value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email (Opcional - Web)</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">mail</span>
                        <input 
                            type="email" placeholder="cliente@correo.com"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white font-medium"
                            value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Selector de Tipo de Cliente */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">badge</span>
                Tipo de Cliente:
              </span>
              <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl gap-1 border border-slate-200 dark:border-slate-700 flex-wrap">
                <button
                  type="button"
                  onClick={() => setClientType('normal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    clientType === 'normal'
                      ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">person</span>
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('wholesale')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    clientType === 'wholesale'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                  Mayorista
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('special_wholesale')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    clientType === 'special_wholesale'
                      ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/40'
                      : 'text-slate-500 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">workspace_premium</span>
                  Mayorista Especial (Precios Manuales)
                </button>
              </div>
            </div>

            {/* Banner informativo de Mayorista Especial */}
            {clientType === 'special_wholesale' && (
              <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-transparent border border-amber-300 dark:border-amber-700/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs animate-fadeIn">
                <div className="size-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-lg">workspace_premium</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-amber-950 dark:text-amber-100">Modo Mayorista Especial Activo</p>
                  <p className="opacity-90">Podés fijar manualmente el precio de venta unitario de cada producto antes de agregarlo o editarlo directamente en la lista del carrito.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                
                {/* Row 1: Categoría Padre y Búsqueda por Texto */}
                <div className="flex flex-col md:flex-row gap-4">
                    {/* 1. Categoría Padre */}
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">1. Categoría Padre</label>
                        <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-primary"
                            value={selectedParentCategory}
                            onChange={e => {
                                setSelectedParentCategory(e.target.value);
                                setSelectedCategory('');
                                setSelectedProductId('');
                                setSelectedVariantId('');
                                setProductSearchText('');
                            }}
                        >
                            <option value="">-- Selecciona una categoría padre --</option>
                            {categoriesConfig.map(c => <option key={c.grupo} value={c.grupo}>{c.grupo}</option>)}
                        </select>
                    </div>

                    {/* Buscador de Producto por Texto */}
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">O Buscar Producto por Nombre</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input 
                                list="ventas-product-names"
                                placeholder="Escribe para buscar un producto..."
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl pl-12 pr-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-primary"
                                value={productSearchText}
                                onChange={e => {
                                    const val = e.target.value;
                                    setProductSearchText(val);
                                    const found = products.find(p => p.name.toLowerCase() === val.toLowerCase());
                                    if (found) {
                                        const group = categoriesConfig.find(g => g.opciones.includes(found.categoryId));
                                        if (group) setSelectedParentCategory(group.grupo);
                                        setSelectedCategory(found.categoryId);
                                        setSelectedProductId(found.id);
                                        setSelectedVariantId('');
                                    }
                                }}
                            />
                            <datalist id="ventas-product-names">
                                {products.filter(p => p.variants.some(v => v.stock > 0)).map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                        </div>
                    </div>
                </div>

                {/* Row 2: Subcategoría y Producto */}
                <div className="flex flex-col md:flex-row gap-4 mt-2">
                    {/* 2. Subcategoría */}
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">2. Subcategoría</label>
                        <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            value={selectedCategory}
                            onChange={e => {
                                setSelectedCategory(e.target.value);
                                setSelectedProductId('');
                                setSelectedVariantId('');
                            }}
                            disabled={!selectedParentCategory || availableSubcategories.length === 0}
                        >
                            <option value="">-- Selecciona una subcategoría --</option>
                            {availableSubcategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* 3. Producto en Stock */}
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">3. Producto en Stock</label>
                        <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm disabled:opacity-50"
                            value={selectedProductId}
                            onChange={e => {
                                setSelectedProductId(e.target.value);
                                setSelectedVariantId('');
                            }}
                            disabled={!selectedCategory || availableProductsInCategory.length === 0}
                        >
                            <option value="">-- Selecciona un producto --</option>
                            {availableProductsInCategory.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        {selectedCategory && availableProductsInCategory.length === 0 && (
                            <p className="text-red-500 text-xs mt-1 font-bold">No hay productos con stock en esta categoría.</p>
                        )}
                    </div>
                </div>

                {/* 4. Seleccionar Variante, Cantidad y Precio Manual si aplica */}
                <div className="flex flex-col md:flex-row gap-4 items-end pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-2">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">4. Variante</label>
                        <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm disabled:opacity-50"
                            value={selectedVariantId} 
                            onChange={e => setSelectedVariantId(e.target.value)}
                            disabled={!selectedProduct || availableVariants.length === 0}
                        >
                            <option value="">-- Selecciona una variante --</option>
                            {availableVariants.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.color} - Talle {v.size} (Stock: {v.stock}) - ${selectedProduct?.salePrice}
                                </option>
                            ))}
                        </select>
                        {selectedProduct && availableVariants.length === 0 && (
                            <p className="text-red-500 text-xs mt-1 font-bold">Sin stock disponible para este producto.</p>
                        )}
                    </div>
                    
                    <div className="w-full md:w-28 shrink-0">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 text-center md:text-left">Cant.</label>
                        <input 
                            type="number" min={1}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-black text-center text-slate-800 dark:text-white shadow-sm"
                            value={quantityToAdd} onChange={e => setQuantityToAdd(Number(e.target.value))}
                        />
                    </div>

                    {/* Precio de Venta Unitario Manual (Solo para Mayorista Especial) */}
                    {clientType === 'special_wholesale' && (
                      <div className="w-full md:w-36 shrink-0">
                        <label className="block text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 text-center md:text-left">
                          Precio Unit. ($)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-600 dark:text-amber-400">$</span>
                          <input 
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0"
                            className="w-full pl-7 pr-3 py-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-600 rounded-xl font-black text-amber-950 dark:text-amber-200 text-center shadow-sm outline-none focus:ring-2 focus:ring-amber-500"
                            value={customUnitPriceInput}
                            onChange={e => setCustomUnitPriceInput(e.target.value)}
                            title="Precio unitario asignado manualmente"
                          />
                        </div>
                      </div>
                    )}
                    
                    <button onClick={addToCart} className="w-full md:w-auto bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold px-8 py-3 rounded-xl hover:opacity-80 transition shadow-lg shrink-0 flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span> Añadir
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Columna Derecha: Carrito y Total */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col min-h-[400px]">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700/50">
            <span className="material-symbols-outlined text-primary">shopping_bag</span> Resumen
            <span className="ml-auto bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{cart.length} ítems</span>
        </h3>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 mb-4">
            {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 opacity-20">shopping_basket</span>
                    <p className="text-sm font-medium">Carrito Vacío</p>
                </div>
            ) : (
                cart.map((item, idx) => (
                    <div key={idx} className="flex flex-col bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-2">
                            <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{item.name}</p>
                            <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
                            {clientType === 'special_wholesale' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                  Precio Unit:
                                </span>
                                <div className="relative w-28">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600 dark:text-amber-400">$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={item.salePrice}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setCart(cart.map((c, i) => i === idx ? { ...c, salePrice: val } : c));
                                    }}
                                    className="w-full pl-6 pr-2 py-1 text-xs font-black rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50/60 dark:bg-slate-900 text-amber-950 dark:text-amber-200 text-right outline-none focus:ring-2 focus:ring-amber-500"
                                    title="Modificar precio unitario asignado manualmente"
                                  />
                                </div>
                                <span className="text-xs text-slate-500 font-bold">x {item.quantity}</span>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">
                                {item.quantity} x ${item.salePrice}
                              </span>
                            )}
                            <span className="font-black text-slate-900 dark:text-white ml-auto">
                              ${(item.quantity * item.salePrice).toLocaleString('es-AR')}
                            </span>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="mt-auto border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex justify-between items-center mb-6">
                <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-sm">Total a Cobrar</p>
                <p className="text-4xl font-black text-primary tracking-tight">${total.toLocaleString()}</p>
            </div>
            <button 
                onClick={handleOpenPaymentModal} 
                disabled={cart.length === 0}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-green-500/20 transition-all flex justify-center items-center gap-2"
            >
                <span className="material-symbols-outlined text-2xl">point_of_sale</span> 
                COBRAR / CONFIRMAR VENTA
            </button>
        </div>
      </div>

      {/* Modal de Selección de Pago (Total / Parcial / Cuotas) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Modalidad de Cobro</h3>
                  <p className="text-xs text-slate-500">Define si se abona completo, con seña o en cuotas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Resumen de Venta */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl mb-5 flex items-center justify-between border border-slate-100 dark:border-slate-700/50">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cliente</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{clientName} <span className="font-normal text-xs text-slate-500">({clientPhone})</span></p>
                  {clientType === 'special_wholesale' && (
                    <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                      👑 Mayorista Especial
                    </span>
                  )}
                  {clientType === 'wholesale' && (
                    <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      📦 Mayorista
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{cart.length} artículo(s) en caja</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Venta</p>
                <p className="text-2xl font-black text-primary">${total.toLocaleString('es-AR')}</p>
              </div>
            </div>

            {/* Selector de Modalidad */}
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Selecciona la forma de pago</p>
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              <button
                type="button"
                onClick={() => setPaymentType('total')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentType === 'total'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="material-symbols-outlined text-2xl text-emerald-500">check_circle</span>
                <span className="text-xs font-bold leading-tight">Pago Total</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">100% Saldo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('partial')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentType === 'partial'
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="material-symbols-outlined text-2xl text-amber-500">hourglass_top</span>
                <span className="text-xs font-bold leading-tight">Pago Parcial</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">Seña / Resto</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('cuotas')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  paymentType === 'cuotas'
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="material-symbols-outlined text-2xl text-indigo-500">calendar_month</span>
                <span className="text-xs font-bold leading-tight">En Cuotas</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">Plan mensual</span>
              </button>
            </div>

            {/* Opciones según modalidad */}
            {paymentType === 'total' && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200 text-xs mb-5 flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-500 text-xl shrink-0">verified</span>
                <div>
                  <p className="font-bold">Cobro completo en el momento</p>
                  <p className="text-[11px] opacity-80">Se registra como cobrado el monto total de ${total.toLocaleString('es-AR')}. No genera deuda en Cobros Pendientes.</p>
                </div>
              </div>
            )}

            {paymentType === 'partial' && (
              <div className="space-y-3 mb-5 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monto abonado hoy ($):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    value={partialPaidInput}
                    onChange={(e) => setPartialPaidInput(e.target.value)}
                    placeholder={`Ej: ${Math.round(total / 2)}`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Saldo adeudado:</span>
                  <span className="text-sm font-black text-red-600 dark:text-red-400">
                    ${Math.max(0, total - (parseFloat(partialPaidInput) || 0)).toLocaleString('es-AR')}
                  </span>
                </div>
                <p className="text-[10px] text-amber-800 dark:text-amber-300">
                  * Este saldo quedará registrado en el menú "Cobros Pendientes" para su seguimiento y registro de pagos futuros.
                </p>
              </div>
            )}

            {paymentType === 'cuotas' && (
              <div className="space-y-4 mb-5 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Cantidad de Cuotas:
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[2, 3, 4, 6, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setInstallmentsCount(num)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          installmentsCount === num
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {num} cuotas
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Entrega o pago inicial hoy ($ - opcional):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    value={initialDownPayment}
                    onChange={(e) => setInitialDownPayment(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {(() => {
                  const down = parseFloat(initialDownPayment) || 0;
                  const financed = Math.max(0, total - down);
                  const perInstallment = installmentsCount > 0 ? Math.round(financed / installmentsCount) : 0;
                  return (
                    <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Saldo a financiar en cuotas:</span>
                        <span className="font-bold text-slate-900 dark:text-white">${financed.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 font-bold">
                        <span className="text-indigo-600 dark:text-indigo-400">Valor estimado por cuota:</span>
                        <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                          {installmentsCount} cuotas de ~${perInstallment.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                  * El sistema te recordará a principio de cada mes cobrar las cuotas que sigan pendientes hasta que se completen.
                </p>
              </div>
            )}

            {/* Notas opcionales */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notas u Observaciones (opcional):
              </label>
              <textarea
                rows={2}
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                placeholder="Ej: Cliente paga con transferencia, retira mañana..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmSale}
                className="flex-[2] py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-sm shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Confirmar Venta y Generar Ticket
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINAR DATOS (VENTA) */}
      {showClearSaleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/50 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">delete_sweep</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    ¿Eliminar datos de la venta?
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    Punto de Venta / Caja
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearSaleModal(false)}
                className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 space-y-2 text-xs text-red-800 dark:text-red-300">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-base">warning</span>
                ¿Estás seguro de que querés cancelar esta venta?
              </p>
              <p>
                Se borrarán los datos del cliente ingresados y todos los productos agregados al carrito. Esta acción no se puede deshacer y la caja quedará limpia.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowClearSaleModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearSale}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">delete_sweep</span>
                Sí, eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
