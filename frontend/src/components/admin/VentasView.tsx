'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { generateTicketPDF, createTicketDoc } from '@/utils/generateTicket';

interface CompletedSaleData {
  ticketId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    salePrice: number;
    imageUrl?: string;
  }>;
  total: number;
  paymentType: 'total' | 'partial' | 'cuotas';
  paidAmount: number;
  pendingAmount: number;
  installmentsCount: number;
  notes?: string;
  shippingCost?: number;
  shippingType?: string;
  shippingInvoiceUrl?: string;
  shippingTrackingNumber?: string;
}

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
  const [cart, setCart] = useState<{productId: string, variantId: string, name: string, quantity: number, salePrice: number, imageUrl?: string}[]>([]);

  // Modal de pago / cuotas
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'total' | 'partial' | 'cuotas'>('total');
  const [partialPaidInput, setPartialPaidInput] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [initialDownPayment, setInitialDownPayment] = useState<string>('0');
  const [saleNotes, setSaleNotes] = useState('');

  // Opciones de Envío en Mostrador
  const [hasShipping, setHasShipping] = useState(false);
  const [shippingCostInput, setShippingCostInput] = useState('');
  const [shippingInvoiceFile, setShippingInvoiceFile] = useState<File | null>(null);
  const [shippingInvoiceUrl, setShippingInvoiceUrl] = useState('');
  const [shippingTrackingInput, setShippingTrackingInput] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Modal de Venta Exitosa y Gestión de Ticket
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSaleData | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Modal Eliminar Datos / Borrador
  const [showClearSaleModal, setShowClearSaleModal] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const DRAFT_VENTAS_KEY = 'lyg_draft_venta';

  // Estados para borrador compartido en la nube
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftUpdatedBy, setDraftUpdatedBy] = useState<string | null>(null);
  const [isSyncingServerDraft, setIsSyncingServerDraft] = useState(false);

  // Helper para obtener token de autenticación
  const getAuthToken = useCallback(() => {
    return apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') || localStorage.getItem('admin_api_key') || '' : '');
  }, [apiKey]);

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
    clientType !== 'normal' ||
    hasShipping ||
    shippingCostInput.trim() !== '' ||
    shippingInvoiceUrl.trim() !== '' ||
    shippingTrackingInput.trim() !== ''
  );

  // Consulta el borrador compartido desde el servidor
  const fetchServerDraft = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsSyncingServerDraft(true);
      const token = getAuthToken();
      const endpoint = apiUrl ? `${apiUrl}/api/admin/sales/draft` : '/api/admin/sales/draft';
      const res = await fetch(endpoint, {
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.draft) {
          const parsed = data.draft;
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
          if (parsed.hasShipping !== undefined) setHasShipping(Boolean(parsed.hasShipping));
          if (parsed.shippingCostInput !== undefined) setShippingCostInput(parsed.shippingCostInput);
          if (parsed.shippingInvoiceUrl !== undefined) setShippingInvoiceUrl(parsed.shippingInvoiceUrl);
          if (parsed.shippingTrackingInput !== undefined) setShippingTrackingInput(parsed.shippingTrackingInput);

          try {
            localStorage.setItem(DRAFT_VENTAS_KEY, JSON.stringify(parsed));
          } catch {}
          if (data.updated_at) setDraftUpdatedAt(data.updated_at);
          if (data.updated_by) setDraftUpdatedBy(data.updated_by);
          setCloudSyncStatus('saved');
          if (isManual) showAlert('✅ Borrador compartido de venta sincronizado correctamente.');
          return true;
        } else {
          return false;
        }
      }
    } catch (e) {
      console.error('Error al consultar borrador de venta del servidor:', e);
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
      const endpoint = apiUrl ? `${apiUrl}/api/admin/sales/draft` : '/api/admin/sales/draft';
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
      console.error('Error al guardar borrador de venta en el servidor:', e);
      setCloudSyncStatus('error');
    }
  }, [apiUrl, getAuthToken]);

  // Elimina el borrador del servidor
  const clearServerDraft = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const endpoint = apiUrl ? `${apiUrl}/api/admin/sales/draft` : '/api/admin/sales/draft';
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Error al eliminar borrador de venta del servidor:', e);
    }
  }, [apiUrl, getAuthToken]);

  // Cargar borrador al montar: primero local para respuesta rápida, luego servidor para datos compartidos
  useEffect(() => {
    let isMounted = true;
    const initDraft = async () => {
      let localDraft: any = null;
      try {
        const saved = localStorage.getItem(DRAFT_VENTAS_KEY);
        if (saved) {
          localDraft = JSON.parse(saved);
          if (localDraft.clientName !== undefined) setClientName(localDraft.clientName);
          if (localDraft.clientPhone !== undefined) setClientPhone(localDraft.clientPhone);
          if (localDraft.clientEmail !== undefined) setClientEmail(localDraft.clientEmail);
          if (localDraft.clientType !== undefined) setClientType(localDraft.clientType);
          if (localDraft.customUnitPriceInput !== undefined) setCustomUnitPriceInput(localDraft.customUnitPriceInput);
          if (Array.isArray(localDraft.cart)) setCart(localDraft.cart);
          if (localDraft.selectedParentCategory !== undefined) setSelectedParentCategory(localDraft.selectedParentCategory);
          if (localDraft.selectedCategory !== undefined) setSelectedCategory(localDraft.selectedCategory);
          if (localDraft.selectedProductId !== undefined) setSelectedProductId(localDraft.selectedProductId);
          if (localDraft.productSearchText !== undefined) setProductSearchText(localDraft.productSearchText);
          if (localDraft.hasShipping !== undefined) setHasShipping(Boolean(localDraft.hasShipping));
          if (localDraft.shippingCostInput !== undefined) setShippingCostInput(localDraft.shippingCostInput);
          if (localDraft.shippingInvoiceUrl !== undefined) setShippingInvoiceUrl(localDraft.shippingInvoiceUrl);
          if (localDraft.shippingTrackingInput !== undefined) setShippingTrackingInput(localDraft.shippingTrackingInput);
        }
      } catch (e) {
        console.error('Error al cargar borrador local de venta:', e);
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
    const timer = setTimeout(() => {
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
            hasShipping,
            shippingCostInput,
            shippingInvoiceUrl,
            shippingTrackingInput,
          };
          localStorage.setItem(DRAFT_VENTAS_KEY, JSON.stringify(draft));
          saveServerDraft(draft);
        } else {
          localStorage.removeItem(DRAFT_VENTAS_KEY);
          clearServerDraft();
          setCloudSyncStatus('idle');
          setDraftUpdatedAt(null);
          setDraftUpdatedBy(null);
        }
      } catch (e) {
        console.error('Error al guardar borrador de venta:', e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isDraftLoaded, hasDraftData, clientName, clientPhone, clientEmail, clientType, customUnitPriceInput, cart, selectedParentCategory, selectedCategory, selectedProductId, productSearchText, hasShipping, shippingCostInput, shippingInvoiceUrl, shippingTrackingInput, saveServerDraft, clearServerDraft]);

  // Si el usuario vuelve a enfocar la ventana o navegador, comprobar cambios del servidor
  useEffect(() => {
    const handleWindowFocus = () => {
      if (isDraftLoaded) {
        fetchServerDraft(false);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isDraftLoaded, fetchServerDraft]);

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
    setHasShipping(false);
    setShippingCostInput('');
    setShippingInvoiceFile(null);
    setShippingInvoiceUrl('');
    setShippingTrackingInput('');
    setCloudSyncStatus('idle');
    setDraftUpdatedAt(null);
    setDraftUpdatedBy(null);
    try {
      localStorage.removeItem(DRAFT_VENTAS_KEY);
    } catch {}
    clearServerDraft();
    setShowClearSaleModal(false);
    showAlert('🗑️ Datos de la venta eliminados.');
  };

  // Obtener cantidad de una variante específica que ya está en el carrito
  const getCartQuantityForVariant = useCallback((productId: string, variantId: string) => {
    return cart
      .filter(item => item.productId === productId && item.variantId === variantId)
      .reduce((acc, item) => acc + (item.quantity || 0), 0);
  }, [cart]);

  // Stock restante de una variante específica descontando lo que ya está en el carrito
  const getVariantRemainingStock = useCallback((productId: string, variant: { id: string; stock: number }) => {
    const inCart = getCartQuantityForVariant(productId, variant.id);
    return Math.max(0, (variant.stock || 0) - inCart);
  }, [getCartQuantityForVariant]);

  // Stock total restante de un producto (suma de sus variantes) descontando lo que está en el carrito
  const getProductRemainingStock = useCallback((p: typeof products[number]) => {
    return (p.variants || []).reduce((acc, v) => {
      return acc + getVariantRemainingStock(p.id, v);
    }, 0);
  }, [getVariantRemainingStock]);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  
  // Variantes del producto seleccionado con cálculo de stock restante en tiempo real
  const availableVariants = useMemo(() => {
    if (!selectedProduct) return [];
    return (selectedProduct.variants || [])
      .filter(v => (v.stock || 0) > 0)
      .map(v => {
        const inCart = getCartQuantityForVariant(selectedProduct.id, v.id);
        const remainingStock = Math.max(0, (v.stock || 0) - inCart);
        return {
          ...v,
          inCart,
          remainingStock,
        };
      });
  }, [selectedProduct, getCartQuantityForVariant]);

  const selectedVariant = availableVariants.find(v => v.id === selectedVariantId);

  // Obtener precio sugerido base según producto, variante y tipo de cliente
  const getBasePrice = (prod = selectedProduct, variant: any = selectedVariant, type = clientType) => {
    if (!prod) return 0;
    if (type === 'wholesale') {
      return variant?.manualWholesalePrice || prod.wholesalePrice || variant?.manualSalePrice || prod.salePrice || 0;
    }
    return variant?.manualSalePrice || prod.salePrice || 0;
  };

  // Sincronizar precio sugerido SOLO cuando se selecciona una variante específica
  useEffect(() => {
    if (selectedProduct && selectedVariantId) {
      const v = selectedProduct.variants?.find(item => item.id === selectedVariantId);
      if (v) {
        const pr = getBasePrice(selectedProduct, v, clientType);
        setCustomUnitPriceInput(pr > 0 ? String(pr) : '');
        return;
      }
    }
    // Si no hay producto o aún no se eligió variante, dejar el campo de precio vacío
    setCustomUnitPriceInput('');
  }, [selectedProductId, selectedVariantId, clientType]);

  const currentBasePrice = selectedVariant ? getBasePrice(selectedProduct, selectedVariant, clientType) : 0;
  const currentNumericPrice = parseFloat(customUnitPriceInput);
  const isCustomPrice = Boolean(
    clientType === 'special_wholesale' &&
    selectedProduct &&
    selectedVariant &&
    customUnitPriceInput.trim() !== '' &&
    !isNaN(currentNumericPrice) &&
    currentNumericPrice !== currentBasePrice
  );

  const resetToDefaultPrice = () => {
    if (selectedVariant) {
      setCustomUnitPriceInput(String(currentBasePrice));
    }
  };
  
  // Matches a product to a subcategory using the same gender-aware logic
  // as catalog/page.tsx, so legacy categoryIds (e.g. "Perfumes de Hombre")
  // never cause products to disappear from the dropdown.
  const productMatchesCategory = (p: typeof products[number], cat: string): boolean => {
    const gender = p.targetGender as string | undefined;
    if (cat === 'Perfumes de Mujer') {
      return (gender === 'Mujer' || (!gender && p.categoryId === 'Perfumes de Mujer')) && gender !== 'Hombre';
    }
    if (cat === 'Perfumes de Hombre') {
      return (gender === 'Hombre' || (!gender && p.categoryId === 'Perfumes de Hombre')) && gender !== 'Mujer';
    }
    if (cat === 'Unisex') {
      return gender === 'Unisex' || p.categoryId === 'Unisex';
    }
    // For "Perfumes" subcategory, also include products whose legacy categoryId
    // was one of the old gender-specific values (they still have targetGender set)
    if (cat === 'Perfumes') {
      return p.categoryId === 'Perfumes' ||
        p.categoryId === 'Perfumes de Hombre' ||
        p.categoryId === 'Perfumes de Mujer' ||
        p.categoryId === 'Unisex';
    }
    return p.categoryId === cat;
  };

  const availableProductsInCategory = products
    .filter(p => productMatchesCategory(p, selectedCategory) && p.variants.some(v => v.stock > 0))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));

  const currentCategoryGroup = categoriesConfig.find(g => g.grupo === selectedParentCategory);
  const availableSubcategories = currentCategoryGroup ? currentCategoryGroup.opciones : [];

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity * item.salePrice), 0);
  }, [cart]);

  const parsedShippingCost = useMemo(() => {
    if (!hasShipping) return 0;
    const parsed = parseFloat(shippingCostInput);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [hasShipping, shippingCostInput]);

  const total = useMemo(() => {
    return subtotal + parsedShippingCost;
  }, [subtotal, parsedShippingCost]);

  const handleClientTypeChange = (newType: 'normal' | 'wholesale' | 'special_wholesale') => {
    setClientType(newType);
    if (newType !== 'special_wholesale') {
      // Si cambia a normal o mayorista, actualizar los precios de los ítems existentes en el carrito según la lista
      setCart(prevCart => prevCart.map(item => {
        const prod = products.find(p => p.id === item.productId);
        const variant = prod?.variants.find(v => v.id === item.variantId);
        const updatedPrice = getBasePrice(prod, variant, newType);
        return {
          ...item,
          salePrice: updatedPrice > 0 ? updatedPrice : item.salePrice
        };
      }));
    }
  };

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
      handleClientTypeChange(cType as any);
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
    if (quantityToAdd <= 0) {
        showAlert("Ingresa una cantidad mayor a 0.");
        return;
    }
    if (variantItem.remainingStock < quantityToAdd) {
        if (variantItem.remainingStock <= 0) {
            showAlert(`El producto "${selectedProduct.name} - ${variantItem.color} ${variantItem.size}" ya no tiene stock disponible (ya agregaste ${variantItem.inCart} al carrito).`);
        } else {
            showAlert(`Stock insuficiente. Solo quedan ${variantItem.remainingStock} unidad${variantItem.remainingStock === 1 ? '' : 'es'} disponible${variantItem.remainingStock === 1 ? '' : 's'} (ya agregaste ${variantItem.inCart} al carrito).`);
        }
        return;
    }
    
    const displayName = `${selectedProduct.name} - ${variantItem.color} - Talle ${variantItem.size}`;

    // Precio unitario: solo se permite precio personalizado manual si el cliente es Mayorista Especial.
    // Para Normal o Mayorista se usa SIEMPRE el precio de lista configurado.
    const defaultPrice = getBasePrice(selectedProduct, variantItem, clientType);
    const effectivePrice = (clientType === 'special_wholesale' && customUnitPriceInput.trim() !== '' && !isNaN(parseFloat(customUnitPriceInput)))
      ? Math.max(0, parseFloat(customUnitPriceInput))
      : defaultPrice;

    const imageUrl = selectedProduct.imageUrls?.[0] || '';

    // Si ya existe en el carrito con el mismo precio unitario, sumamos cantidad para no duplicar filas
    const existingIndex = cart.findIndex(it => 
      it.productId === selectedProduct.id && 
      it.variantId === variantItem.id && 
      it.salePrice === effectivePrice
    );

    if (existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + quantityToAdd,
      };
      setCart(updated);
    } else {
      setCart([...cart, {
        productId: selectedProduct.id,
        variantId: variantItem.id,
        name: displayName,
        quantity: quantityToAdd,
        salePrice: effectivePrice,
        imageUrl,
      }]);
    }
    
    // Resetear todos los campos de selección de producto para permitir añadir otro producto limpiamente
    setSelectedParentCategory('');
    setSelectedCategory('');
    setSelectedProductId('');
    setProductSearchText('');
    setSelectedVariantId('');
    setQuantityToAdd(1);
    setCustomUnitPriceInput('');
  };

  const handleUpdateCartQuantity = (idx: number, delta: number) => {
    const item = cart[idx];
    if (!item) return;

    if (delta > 0) {
      const prod = products.find(p => p.id === item.productId);
      const variant = prod?.variants.find(v => v.id === item.variantId);
      const totalStock = variant?.stock || 0;
      const totalInCartForVariant = cart
        .filter(c => c.productId === item.productId && c.variantId === item.variantId)
        .reduce((sum, c) => sum + (c.quantity || 0), 0);

      if (totalInCartForVariant + delta > totalStock) {
        showAlert(`No podés agregar más. El stock máximo disponible de esta variante es ${totalStock} unidad${totalStock === 1 ? '' : 'es'}.`);
        return;
      }
    }

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(cart.map((c, i) => i === idx ? { ...c, quantity: newQty } : c));
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

  const formatWhatsAppPhone = (raw: string) => {
    let cleaned = (raw || '').replace(/\D/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (cleaned.length === 10) return `549${cleaned}`;
    if (cleaned.length === 11 && cleaned.startsWith('15')) return `549${cleaned.slice(2)}`;
    if (cleaned.length === 12 && cleaned.startsWith('54') && !cleaned.startsWith('549')) return `549${cleaned.slice(2)}`;
    if (!cleaned.startsWith('54') && cleaned.length <= 11) return `549${cleaned}`;
    return cleaned;
  };

  const handleDownloadTicket = () => {
    if (!completedSale) return;
    const doc = createTicketDoc(completedSale.ticketId, useStockFlowStore.getState().sales);
    if (doc) {
      doc.save(`Ticket-${completedSale.ticketId}.pdf`);
    } else {
      showAlert('No se pudo generar el archivo del ticket.');
    }
  };

  const handleOpenTicket = () => {
    if (!completedSale) return;
    const doc = createTicketDoc(completedSale.ticketId, useStockFlowStore.getState().sales);
    if (doc) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      showAlert('No se pudo abrir el ticket.');
    }
  };

  const handleShareWhatsApp = () => {
    if (!completedSale) return;
    const phone = formatWhatsAppPhone(completedSale.clientPhone);
    const itemsText = completedSale.items
      .map(i => `• ${i.quantity}x ${i.name} — $${(i.salePrice * i.quantity).toLocaleString('es-AR')}`)
      .join('\n');
    
    const shippingText = (completedSale.shippingCost && completedSale.shippingCost > 0)
      ? `\n🚚 *Envío a domicilio:* $${completedSale.shippingCost.toLocaleString('es-AR')}`
      : '';

    const paymentText = completedSale.paymentType === 'total' && completedSale.pendingAmount <= 0
      ? `✅ *Pago Total:* $${completedSale.total.toLocaleString('es-AR')}`
      : completedSale.paymentType === 'cuotas'
      ? `📅 *Modalidad:* En ${completedSale.installmentsCount} cuotas\n💵 *Abonado:* $${completedSale.paidAmount.toLocaleString('es-AR')}\n⚠️ *Saldo Pendiente:* $${completedSale.pendingAmount.toLocaleString('es-AR')}`
      : `💵 *Abonado:* $${completedSale.paidAmount.toLocaleString('es-AR')}\n⚠️ *Saldo Pendiente:* $${completedSale.pendingAmount.toLocaleString('es-AR')}`;

    const message = `¡Hola ${completedSale.clientName || 'Cliente'}! 👋\n` +
      `Te compartimos el comprobante de tu compra en *Ciara Bonita* ✨\n\n` +
      `🧾 *Ticket N°:* #${completedSale.ticketId}\n` +
      `📅 *Fecha:* ${completedSale.date}\n\n` +
      `🛍️ *Detalle del pedido:*\n${itemsText}${shippingText}\n\n` +
      `💰 *Total:* $${completedSale.total.toLocaleString('es-AR')}\n` +
      `${paymentText}\n\n` +
      `¡Muchas gracias por elegirnos! Quedamos a tu entera disposición. 😊`;

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const handleConfirmSale = async () => {
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

    setIsSubmittingSale(true);

    let finalInvoiceUrl = shippingInvoiceUrl;
    if (hasShipping && shippingInvoiceFile) {
      try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('file', shippingInvoiceFile);
        formData.append('folder', 'Facturas');
        const uploadRes = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: token ? { 'X-API-KEY': token, 'Authorization': `Bearer ${token}` } : {},
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            finalInvoiceUrl = uploadData.url;
          }
        } else {
          console.warn('No se pudo subir la factura de envío, continuando venta.');
        }
      } catch (err) {
        console.error('Error subiendo factura de envío:', err);
      }
    }

    const savedCart = [...cart];
    const savedClientName = clientName.trim() || 'Consumidor Final';
    const savedClientPhone = clientPhone.trim();
    const savedClientEmail = clientEmail.trim();
    const savedTotal = total;
    const savedNotes = saleNotes.trim();
    const finalShippingCost = hasShipping ? parsedShippingCost : 0;
    const finalShippingTracking = hasShipping ? shippingTrackingInput.trim() : '';

    const ticketId = registerSale(clientName, clientPhone, cart, {
      paymentType,
      paidAmount: finalPaid,
      pendingAmount: finalPending,
      installmentsCount: paymentType === 'cuotas' ? installmentsCount : 1,
      notes: saleNotes.trim(),
      clientEmail: clientEmail.trim(),
      isSpecialWholesale: clientType === 'special_wholesale',
      clientType: clientType,
      shippingCost: finalShippingCost,
      shippingType: hasShipping ? 'delivery' : 'pickup',
      shippingInvoiceUrl: finalInvoiceUrl || undefined,
      shippingTrackingNumber: finalShippingTracking || undefined,
    });

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    setCompletedSale({
      ticketId,
      clientName: savedClientName,
      clientPhone: savedClientPhone,
      clientEmail: savedClientEmail,
      date: dateFormatted,
      items: savedCart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        salePrice: item.salePrice,
        imageUrl: item.imageUrl,
      })),
      total: savedTotal,
      paymentType,
      paidAmount: finalPaid,
      pendingAmount: finalPending,
      installmentsCount: paymentType === 'cuotas' ? installmentsCount : 1,
      notes: savedNotes,
      shippingCost: finalShippingCost,
      shippingType: hasShipping ? 'delivery' : 'pickup',
      shippingInvoiceUrl: finalInvoiceUrl || undefined,
      shippingTrackingNumber: finalShippingTracking || undefined,
    });

    setIsSubmittingSale(false);
    setShowPaymentModal(false);
    setShowSuccessModal(true);

    try {
      localStorage.removeItem(DRAFT_VENTAS_KEY);
    } catch {}
    clearServerDraft();
    setCloudSyncStatus('idle');
    setDraftUpdatedAt(null);
    setDraftUpdatedBy(null);
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
    setHasShipping(false);
    setShippingCostInput('');
    setShippingInvoiceFile(null);
    setShippingInvoiceUrl('');
    setShippingTrackingInput('');
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
          <div className="flex flex-wrap items-center gap-2">
            {cloudSyncStatus === 'saving' && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                <span className="material-symbols-outlined text-sm animate-spin">sync</span> Guardando en la nube...
              </span>
            )}
            {hasDraftData && cloudSyncStatus === 'saved' && (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5" title="Este borrador de venta está sincronizado en la base de datos y visible para todos los administradores en cualquier dispositivo">
                <span className="material-symbols-outlined text-sm">cloud_done</span> Borrador compartido {draftUpdatedBy ? `(${draftUpdatedBy})` : ''}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchServerDraft(true)}
              disabled={isSyncingServerDraft}
              title="Consultar si otro administrador actualizó esta venta en otro dispositivo"
              className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/80 hover:bg-blue-200/80 dark:bg-blue-900/50 dark:hover:bg-blue-800/60 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm ${isSyncingServerDraft ? 'animate-spin' : ''}`}>sync</span>
              {isSyncingServerDraft ? 'Sincronizando...' : 'Sincronizar'}
            </button>

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
                  onClick={() => handleClientTypeChange('normal')}
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
                  onClick={() => handleClientTypeChange('wholesale')}
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
                  onClick={() => handleClientTypeChange('special_wholesale')}
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

                {/* Búsqueda por nombre — PRIMERO */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Buscar Producto por Nombre</label>
                    <div className="flex gap-2 items-start">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input 
                                list="ventas-product-names"
                                placeholder="Escribe para buscar un producto..."
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl pl-12 pr-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-primary"
                                value={productSearchText}
                                onChange={e => {
                                    const val = e.target.value;
                                    setProductSearchText(val);
                                    const found = products
                                        .filter(p => p.variants.some(v => v.stock > 0))
                                        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
                                        .find(p => p.name.toLowerCase() === val.toLowerCase());
                                    if (found) {
                                        // find the group that owns this categoryId (direct match or legacy mapping)
                                        const normalizedCat = (['Perfumes de Hombre','Perfumes de Mujer','Unisex'].includes(found.categoryId))
                                            ? 'Perfumes'
                                            : found.categoryId;
                                        const group = categoriesConfig.find(g => g.opciones.includes(normalizedCat) || g.opciones.includes(found.categoryId));
                                        if (group) setSelectedParentCategory(group.grupo);
                                        setSelectedCategory(normalizedCat || found.categoryId);
                                        setSelectedProductId(found.id);
                                        setSelectedVariantId('');
                                    }
                                }}
                            />
                            <datalist id="ventas-product-names">
                                {products
                                    .filter(p => p.variants.some(v => v.stock > 0))
                                    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
                                    .map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                        </div>
                        {/* Botón para limpiar búsqueda y selección */}
                        {(productSearchText || selectedProductId) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setProductSearchText('');
                                    setSelectedParentCategory('');
                                    setSelectedCategory('');
                                    setSelectedProductId('');
                                    setSelectedVariantId('');
                                    setCustomUnitPriceInput('');
                                }}
                                className="shrink-0 flex items-center gap-1 px-3 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                                title="Limpiar búsqueda y selección"
                            >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                        )}
                    </div>

                    {/* Miniatura del producto seleccionado vía búsqueda */}
                    {selectedProduct && (
                        <div className="flex items-center gap-3 mt-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm animate-fadeIn">
                            {selectedProduct.imageUrls?.[0] ? (
                                <img
                                    src={selectedProduct.imageUrls[0]}
                                    alt={selectedProduct.name}
                                    className="w-14 h-14 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-600"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-400 text-2xl">image_not_supported</span>
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight truncate">{selectedProduct.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    <strong className="text-primary font-bold">{getProductRemainingStock(selectedProduct)}</strong> unidad(es) disponible(s) para venta
                                    {availableVariants.some(v => v.inCart > 0) && (
                                        <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                                            (algunas ya en carrito)
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Row: Categoría Padre + Subcategoría */}
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
                </div>

                {/* 3. Producto en Stock */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">3. Producto en Stock</label>
                    <select 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm disabled:opacity-50"
                        value={selectedProductId}
                        onChange={e => {
                            setSelectedProductId(e.target.value);
                            setSelectedVariantId('');
                            // Also update search text to reflect selected product
                            const p = products.find(x => x.id === e.target.value);
                            if (p) setProductSearchText(p.name);
                        }}
                        disabled={!selectedCategory || availableProductsInCategory.length === 0}
                    >
                        <option value="">-- Selecciona un producto --</option>
                        {availableProductsInCategory.map(p => {
                            const remStock = getProductRemainingStock(p);
                            return (
                                <option key={p.id} value={p.id} disabled={remStock <= 0}>
                                    {p.name} {remStock > 0 ? `(${remStock} disp)` : '(SIN STOCK EN VENTA)'}
                                </option>
                            );
                        })}
                    </select>
                    {selectedCategory && availableProductsInCategory.length === 0 && (
                        <p className="text-red-500 text-xs mt-1 font-bold">No hay productos con stock en esta categoría.</p>
                    )}
                </div>

                {/* 4. Seleccionar Variante, Cantidad y Precio Manual si aplica */}
                <div className="flex flex-col md:flex-row gap-4 items-end pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-2">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">4. Variante</label>
                        <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm disabled:opacity-50"
                            value={selectedVariantId} 
                            onChange={e => {
                                const newVarId = e.target.value;
                                setSelectedVariantId(newVarId);
                                if (selectedProduct) {
                                  const v = selectedProduct.variants?.find(item => item.id === newVarId);
                                  const pr = getBasePrice(selectedProduct, v, clientType);
                                  setCustomUnitPriceInput(pr > 0 ? String(pr) : String(selectedProduct.salePrice || ''));
                                }
                            }}
                            disabled={!selectedProduct || availableVariants.length === 0}
                        >
                            <option value="">-- Selecciona una variante --</option>
                            {availableVariants.map(v => {
                                const vPrice = getBasePrice(selectedProduct, v, clientType);
                                const isOutOfStock = v.remainingStock <= 0;
                                return (
                                    <option key={v.id} value={v.id} disabled={isOutOfStock}>
                                        {v.color} - Talle {v.size} {isOutOfStock ? `(Agotado en venta - ${v.inCart} en carrito)` : `(Stock disp: ${v.remainingStock}${v.inCart > 0 ? ` de ${v.stock}` : ''})`} - ${vPrice.toLocaleString('es-AR')}
                                    </option>
                                );
                            })}
                        </select>
                        {selectedProduct && availableVariants.length > 0 && availableVariants.every(v => v.remainingStock <= 0) && (
                            <p className="text-amber-600 dark:text-amber-400 text-xs mt-1 font-bold">
                                Todo el stock de este producto ya está cargado en la venta.
                            </p>
                        )}
                        {selectedProduct && availableVariants.length === 0 && (
                            <p className="text-red-500 text-xs mt-1 font-bold">Sin stock disponible para este producto.</p>
                        )}
                    </div>
                    
                    <div className="w-full md:w-24 shrink-0">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 text-center md:text-left">Cant.</label>
                        <input 
                            type="number" 
                            min={1}
                            max={selectedVariant ? selectedVariant.remainingStock : undefined}
                            disabled={!selectedVariant || selectedVariant.remainingStock <= 0}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-black text-center text-slate-800 dark:text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            value={quantityToAdd} 
                            onChange={e => setQuantityToAdd(Number(e.target.value))}
                        />
                    </div>

                    {/* Precio de Venta Unitario (Editable solo para Mayorista Especial) */}
                    <div className="w-full md:w-44 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span>Precio Unit. ($)</span>
                            {clientType !== 'special_wholesale' ? (
                              <span 
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600"
                                title="Precio de lista automático. Solo se puede editar manualmente con cliente Mayorista Especial."
                              >
                                <span className="material-symbols-outlined text-[13px]">lock</span>
                                Fijo
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700"
                                title="Modo manual activo: podés ingresar cualquier precio"
                              >
                                <span className="material-symbols-outlined text-[13px]">edit</span>
                                Manual
                              </span>
                            )}
                          </label>
                          {isCustomPrice && clientType === 'special_wholesale' && (
                            <button
                              type="button"
                              onClick={resetToDefaultPrice}
                              className="text-[11px] font-bold text-primary hover:underline"
                              title="Restablecer al precio original de lista"
                            >
                              Restablecer
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${
                            !selectedVariant
                              ? 'text-slate-300 dark:text-slate-600'
                              : isCustomPrice && clientType === 'special_wholesale'
                              ? 'text-amber-600 dark:text-amber-400 font-black'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}>$</span>
                          <input 
                            type="number"
                            min={0}
                            step="any"
                            placeholder={selectedVariant ? "0" : "—"}
                            disabled={!selectedProduct || !selectedVariant}
                            readOnly={clientType !== 'special_wholesale'}
                            className={`w-full pl-7 pr-3 py-3 border rounded-xl font-black text-center shadow-sm outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:dark:bg-slate-800/50 disabled:cursor-not-allowed ${
                              clientType === 'special_wholesale'
                                ? isCustomPrice
                                  ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-200 focus:ring-2 focus:ring-amber-500 cursor-text'
                                  : 'bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-600 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 cursor-text'
                                : 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed select-none'
                            }`}
                            value={customUnitPriceInput}
                            onChange={e => {
                              if (clientType === 'special_wholesale') {
                                setCustomUnitPriceInput(e.target.value);
                              }
                            }}
                            title={
                              clientType === 'special_wholesale'
                                ? "Precio unitario de venta (editable para Mayorista Especial)"
                                : "Precio de lista fijado automáticamente. Para modificar manualmente, seleccioná Mayorista Especial."
                            }
                          />
                        </div>
                    </div>
                    
                    <button 
                      onClick={addToCart} 
                      disabled={!selectedProduct || !selectedVariant || selectedVariant.remainingStock <= 0 || quantityToAdd > selectedVariant.remainingStock}
                      className="w-full md:w-auto bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold px-7 py-3 rounded-xl hover:opacity-80 transition shadow-lg shrink-0 flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                        {selectedVariant && selectedVariant.remainingStock <= 0 ? 'Sin stock' : 'Añadir'}
                    </button>
                </div>

                {isCustomPrice && clientType === 'special_wholesale' && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-200 text-xs animate-fadeIn mt-1">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">price_change</span>
                    <span>
                      <strong>Precio especial personalizado:</strong> Se cobrará <strong>${currentNumericPrice.toLocaleString('es-AR')}</strong> en vez de ${currentBasePrice.toLocaleString('es-AR')}.
                    </span>
                  </div>
                )}
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
                    <div key={idx} className="flex flex-col bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                        {/* Header: thumbnail + name + remove */}
                        <div className="flex items-start gap-2.5 mb-2">
                            {item.imageUrl ? (
                                <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-12 h-12 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-600"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-400 text-xl">image_not_supported</span>
                                </div>
                            )}
                            <p className="flex-1 font-bold text-xs text-slate-800 dark:text-white leading-tight pt-0.5">{item.name}</p>
                            <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(idx, -1)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-bold text-xs shadow-sm cursor-pointer"
                                  title="Disminuir cantidad"
                                >
                                  -
                                </button>
                                <span className="text-xs font-black text-slate-800 dark:text-white px-1.5 min-w-[20px] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(idx, 1)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-bold text-xs shadow-sm cursor-pointer"
                                  title="Aumentar cantidad (respetando stock disponible)"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-xs text-slate-400 font-bold">×</span>
                              {clientType === 'special_wholesale' ? (
                                <div className="relative w-28">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={item.salePrice}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setCart(cart.map((c, i) => i === idx ? { ...c, salePrice: val } : c));
                                    }}
                                    className="w-full pl-6 pr-2 py-1.5 text-xs font-black rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 text-right outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-sm"
                                    title="Editar precio unitario para Mayorista Especial"
                                  />
                                </div>
                              ) : (
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                  ${item.salePrice.toLocaleString('es-AR')}
                                </span>
                              )}
                            </div>
                            <span className="font-black text-slate-900 dark:text-white ml-auto text-sm">
                              ${(item.quantity * item.salePrice).toLocaleString('es-AR')}
                            </span>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Sección Opciones de Envío / Despacho */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${hasShipping ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                <span className="material-symbols-outlined text-lg">local_shipping</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-white">¿Incluir Envío / Flete?</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Sumar el costo al total que abona el cliente</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasShipping}
                onChange={(e) => {
                  setHasShipping(e.target.checked);
                  if (!e.target.checked) {
                    setShippingCostInput('');
                    setShippingInvoiceFile(null);
                    setShippingInvoiceUrl('');
                    setShippingTrackingInput('');
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {hasShipping && (
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3 animate-fadeIn">
              {/* Monto de Envío */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Costo de Envío a cobrar al cliente ($):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={shippingCostInput}
                    onChange={(e) => setShippingCostInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-sm font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
              </div>

              {/* Factura / Remito del Envío */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Factura / Remito del Envío (PDF o Imagen, opcional):
                </label>

                {shippingInvoiceUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs">
                    <a
                      href={shippingInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 hover:underline truncate max-w-[200px]"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      Ver Factura Adjunta
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setShippingInvoiceUrl('');
                        setShippingInvoiceFile(null);
                      }}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-md"
                      title="Quitar factura"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setShippingInvoiceFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-500/10 file:text-orange-600 hover:file:bg-orange-500/20 file:cursor-pointer"
                    />
                    {shippingInvoiceFile && (
                      <div className="flex items-center justify-between p-2 bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
                        <p className="text-[11px] font-medium text-orange-800 dark:text-orange-300 flex items-center gap-1 truncate max-w-[210px]">
                          <span className="material-symbols-outlined text-sm text-orange-600">attach_file</span>
                          {shippingInvoiceFile.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShippingInvoiceFile(null)}
                          className="text-slate-400 hover:text-red-500 p-0.5"
                          title="Quitar archivo"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Guía o Transporte opcional */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Guía / Empresa de Transporte (opcional):
                </label>
                <input
                  type="text"
                  value={shippingTrackingInput}
                  onChange={(e) => setShippingTrackingInput(e.target.value)}
                  placeholder="Ej: Correo Argentino, Andreani, Mensajería..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
            {hasShipping && parsedShippingCost > 0 && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal Artículos:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">${subtotal.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-orange-600 dark:text-orange-400 font-bold">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                    Envío a Domicilio:
                  </span>
                  <span>+${parsedShippingCost.toLocaleString('es-AR')}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-sm">Total a Cobrar</p>
                <p className="text-4xl font-black text-primary tracking-tight">${total.toLocaleString('es-AR')}</p>
            </div>
            <button 
                onClick={handleOpenPaymentModal} 
                disabled={cart.length === 0}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-green-500/20 transition-all flex justify-center items-center gap-2 cursor-pointer"
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
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total a Cobrar</p>
                <p className="text-2xl font-black text-primary">${total.toLocaleString('es-AR')}</p>
                {hasShipping && parsedShippingCost > 0 && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold mt-0.5">
                    (Artículos: ${subtotal.toLocaleString('es-AR')} + Envío: ${parsedShippingCost.toLocaleString('es-AR')})
                  </p>
                )}
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
                disabled={isSubmittingSale}
                className="flex-[2] py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-lg ${isSubmittingSale ? 'animate-spin' : ''}`}>
                  {isSubmittingSale ? 'sync' : 'check_circle'}
                </span>
                {isSubmittingSale ? 'Guardando Venta...' : 'Confirmar Venta y Generar Ticket'}
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

      {/* MODAL: VENTA EXITOSA Y COMPARTIR TICKET */}
      {showSuccessModal && completedSale && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-xl w-full p-6 sm:p-7 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            
            {/* Cabecera Éxito */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="size-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/15 shrink-0">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Venta Registrada
                    </span>
                    <span className="text-xs text-slate-400 font-bold">{completedSale.date}</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    ¡Venta Exitosa!
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      Ticket #{completedSale.ticketId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(completedSale.ticketId);
                        setCopiedTicket(true);
                        setTimeout(() => setCopiedTicket(false), 2000);
                      }}
                      className="text-slate-400 hover:text-primary transition-colors text-xs flex items-center gap-0.5 cursor-pointer"
                      title="Copiar N° de Ticket"
                    >
                      <span className="material-symbols-outlined text-sm">{copiedTicket ? 'done' : 'content_copy'}</span>
                      <span className="text-[10px] font-bold">{copiedTicket ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Cerrar"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* Resumen Financiero y Cliente */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cliente</span>
                  <p className="font-black text-slate-800 dark:text-white text-sm truncate">{completedSale.clientName}</p>
                  {completedSale.clientPhone && (
                    <p className="text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[12px]">phone</span>
                      {completedSale.clientPhone}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Cobrado / Venta</span>
                  <p className="font-black text-primary text-xl leading-tight">
                    ${completedSale.total.toLocaleString('es-AR')}
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mt-0.5 ${
                    completedSale.paymentType === 'total' && completedSale.pendingAmount <= 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {completedSale.paymentType === 'total'
                      ? 'Pago Completo'
                      : completedSale.paymentType === 'cuotas'
                      ? `En ${completedSale.installmentsCount} cuotas`
                      : 'Pago Parcial (Seña)'}
                  </span>
                </div>

                {(completedSale.paymentType !== 'total' || completedSale.pendingAmount > 0) && (
                  <div className="col-span-2 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500 font-bold">Abonado hoy: </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">${completedSale.paidAmount.toLocaleString('es-AR')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Saldo pendiente: </span>
                      <span className="font-black text-red-600 dark:text-red-400">${completedSale.pendingAmount.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detalle de Artículos */}
              <div>
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">shopping_bag</span>
                  Artículos de la Venta ({completedSale.items.reduce((acc, i) => acc + i.quantity, 0)})
                </p>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                  {completedSale.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl.startsWith('http') ? item.imageUrl : `${apiUrl || ''}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`}
                            alt={item.name}
                            className="size-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.webp'; }}
                          />
                        ) : (
                          <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                            <span className="material-symbols-outlined text-base">fragrance</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-white truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {item.quantity} x ${item.salePrice.toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white shrink-0 ml-3">
                        ${(item.quantity * item.salePrice).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detalle de Envío si fue incluido */}
              {Boolean(completedSale.shippingCost && completedSale.shippingCost > 0) && (
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-3 text-xs text-orange-900 dark:text-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">local_shipping</span>
                    </div>
                    <div>
                      <span className="font-bold block">Envío a Domicilio: ${completedSale.shippingCost?.toLocaleString('es-AR')}</span>
                      {completedSale.shippingTrackingNumber && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Guía / Transp: {completedSale.shippingTrackingNumber}</span>
                      )}
                    </div>
                  </div>
                  {completedSale.shippingInvoiceUrl && (
                    <a
                      href={completedSale.shippingInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shadow-sm transition-all self-start sm:self-center"
                    >
                      <span className="material-symbols-outlined text-sm">receipt_long</span>
                      Ver Factura Adjunta
                    </a>
                  )}
                </div>
              )}

              {/* Observaciones si las hay */}
              {completedSale.notes && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-bold flex items-center gap-1 mb-0.5">
                    <span className="material-symbols-outlined text-[14px]">comment</span>
                    Notas / Observaciones:
                  </span>
                  <p className="font-medium pl-4">{completedSale.notes}</p>
                </div>
              )}
            </div>

            {/* Botones de acción principales */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-700">
              
              {/* Botón WhatsApp prioritario */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">chat</span>
                Compartir Comprobante por WhatsApp
              </button>

              {/* Botones secundarios: Descargar y Abrir/Imprimir */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadTicket}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  title="Descargar archivo PDF del ticket"
                >
                  <span className="material-symbols-outlined text-base text-primary">download</span>
                  Descargar Ticket PDF
                </button>
                <button
                  type="button"
                  onClick={handleOpenTicket}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  title="Abrir o imprimir el ticket en PDF"
                >
                  <span className="material-symbols-outlined text-base text-slate-500">open_in_new</span>
                  Abrir / Imprimir
                </button>
              </div>

              {/* Botón Nueva Venta */}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                Iniciar Nueva Venta
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
