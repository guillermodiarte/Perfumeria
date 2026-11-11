'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStockFlowStore, SaleRecord } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';
import { API_URL } from '@/utils/api';
import EditarCompraView, { EditarCompraData } from '@/components/admin/EditarCompraView';

interface CobrosPendientesViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
  currentAdminRole?: string;
}

interface PendingDebtRecord {
  id: string;
  source: 'web' | 'mostrador';
  reference: string; // order_number or ticketId
  clientName: string;
  clientPhone: string;
  date: string;
  total: number;
  paidAmount: number;
  pendingAmount: number;
  paymentType: 'total' | 'partial' | 'cuotas';
  installmentsCount: number;
  lastPaidMonth?: string;
  notes?: string;
  customer?: any;
  isSpecialWholesale?: boolean;
  items: Array<{
    productId?: string;
    variantId?: string;
    productName: string;
    variantInfo: string;
    quantity: number;
    price?: number;
    imageUrl?: string;
  }>;
  rawSaleRecords?: any[];
  shippingCost?: number;
  shippingType?: string;
  shippingInvoiceUrl?: string;
  shippingTrackingNumber?: string;
}

export default function CobrosPendientesView({ apiKey, showAlert, currentAdminRole }: CobrosPendientesViewProps) {
  const isSuperAdmin = currentAdminRole === 'super_admin';
  const canManageCobros = currentAdminRole === 'super_admin' || currentAdminRole === 'admin';

  // Store de Mostrador
  const posSales = useStockFlowStore(s => s.sales);
  const recordSalePayment = useStockFlowStore(s => s.recordSalePayment);
  const markSaleMonthPaid = useStockFlowStore(s => s.markSaleMonthPaid);
  const deleteSaleAndRestoreStock = useStockFlowStore(s => s.deleteSaleAndRestoreStock);
  const updateSaleTicketItems = useStockFlowStore(s => s.updateSaleTicketItems);
  const storeProducts = useStockFlowStore(s => s.products) || [];

  // Backend Web Orders
  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [loadingWeb, setLoadingWeb] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  const [filterSource, setFilterSource] = useState<'all' | 'web' | 'mostrador' | 'month_due'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Registrar Pago
  const [selectedRecord, setSelectedRecord] = useState<PendingDebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Modal Eliminar Deuda (Super Admin)
  const [debtToDelete, setDebtToDelete] = useState<PendingDebtRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Ver Detalle de Venta
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<PendingDebtRecord | null>(null);

  // Modal Edición Completa de la Compra (Cobros Pendientes)
  const [debtToEdit, setDebtToEdit] = useState<PendingDebtRecord | null>(null);
  const [editDebtItems, setEditDebtItems] = useState<any[]>([]);
  const [editDebtShippingType, setEditDebtShippingType] = useState<'pickup' | 'delivery' | 'national'>('delivery');
  const [editDebtShippingCost, setEditDebtShippingCost] = useState<string>('0');
  const [editDebtNotes, setEditDebtNotes] = useState<string>('');
  const [savingDebtEdit, setSavingDebtEdit] = useState(false);

  // Modal Selector de Producto para agregar a la compra
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<any | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addCustomPrice, setAddCustomPrice] = useState<string>('');

  const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  const getToken = (): string => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') ?? '' : '');

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Sin fecha';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Cargar pedidos web y clientes
  const fetchWebOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoadingWeb(true);
    try {
      const [ordersRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/orders/admin/all`, { headers: { 'X-API-KEY': token } }),
        fetch(`${API_URL}/api/admin/users`, { headers: { 'X-API-KEY': token } }).catch(() => null)
      ]);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setWebOrders(data);
      }
      if (usersRes && usersRes.ok) {
        const usersData = await usersRes.json();
        if (Array.isArray(usersData)) {
          setCustomers(usersData);
        }
      }
    } catch (e) {
      console.warn('Error fetching web orders or users:', e);
    } finally {
      setLoadingWeb(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchWebOrders();
  }, [fetchWebOrders]);

  // Helper de teléfonos
  const cleanDigits = (p?: string) => (p || '').replace(/\D/g, '');
  const isPhoneMatch = (p1?: string, p2?: string): boolean => {
    const c1 = cleanDigits(p1);
    const c2 = cleanDigits(p2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.length >= 8 && c2.length >= 8) {
      return c1.slice(-8) === c2.slice(-8);
    }
    return false;
  };

  // 1. Procesar deudas de Mostrador (Zustand)
  const posTicketsMap = new Map<string, PendingDebtRecord>();
  const webOrderNumbers = new Set(webOrders.map(o => o.order_number));

  posSales
    .filter(s => !s.ticketId.startsWith('WEB-') && !s.ticketId.startsWith('ORD-') && !webOrderNumbers.has(s.ticketId))
    .forEach(s => {
      const pending = s.pendingAmount ?? s.remainingAmount ?? 0;
      if (!posTicketsMap.has(s.ticketId)) {
        // Buscar cliente registrado coincidente por teléfono o email
        const matchedCustomer = customers.find(c => {
          if (s.clientPhone && c.phone && isPhoneMatch(s.clientPhone, c.phone)) return true;
          if (s.clientEmail && c.email && c.email.toLowerCase() === s.clientEmail.toLowerCase()) return true;
          return false;
        });

        const isSpec = Boolean(
          s.isSpecialWholesale ||
          s.clientType === 'special_wholesale' ||
          matchedCustomer?.is_special_wholesale ||
          matchedCustomer?.customer_type === 'special_wholesale'
        );

        posTicketsMap.set(s.ticketId, {
          id: s.ticketId,
          source: 'mostrador',
          reference: s.ticketId,
          clientName: s.clientName || matchedCustomer?.name || 'Consumidor Final',
          clientPhone: s.clientPhone || matchedCustomer?.phone || 'S/D',
          date: s.date,
          total: s.shippingCost || 0,
          paidAmount: s.paidAmount ?? 0,
          pendingAmount: pending,
          paymentType: s.paymentType || 'cuotas',
          installmentsCount: s.installmentsCount || 1,
          lastPaidMonth: s.lastNotifiedMonth,
          notes: s.notes || s.adminNotes,
          isSpecialWholesale: isSpec,
          customer: matchedCustomer,
          items: [],
          rawSaleRecords: [],
          shippingCost: s.shippingCost || 0,
          shippingType: s.shippingType,
          shippingInvoiceUrl: s.shippingInvoiceUrl,
          shippingTrackingNumber: s.shippingTrackingNumber,
        });
      }
      const r = posTicketsMap.get(s.ticketId)!;
      r.total += s.revenue;
      r.rawSaleRecords?.push(s);
      r.items.push({
        productId: s.productId,
        variantId: s.variantId,
        productName: s.productName,
        variantInfo: `${s.color || ''} ${s.size ? `Talle ${s.size}` : ''}`.trim(),
        quantity: s.quantity || 1,
        price: s.unitSalePrice || 0,
        imageUrl: s.productImageUrl || undefined,
      });
    });

  const posDebts: PendingDebtRecord[] = Array.from(posTicketsMap.values()).filter(r => r.pendingAmount > 0);

  // 2. Procesar deudas Web (Backend)
  const webDebts: PendingDebtRecord[] = webOrders
    .filter(o => {
      const s = (o.status || '').toLowerCase();
      if (s.includes('rechaz') || s.includes('cancel')) return false;
      const tot = parseFloat(o.total || 0);
      const paid = parseFloat(o.paid_amount || 0);
      const rem = Math.max(0, tot - paid);
      return rem > 0;
    })
    .map(o => {
      const tot = parseFloat(o.total || 0);
      const paid = parseFloat(o.paid_amount || 0);
      return {
        id: `web-${o.order_number}`,
        source: 'web' as const,
        reference: o.order_number,
        clientName: o.customer?.name || 'Cliente Web',
        clientPhone: o.customer?.phone || 'S/D',
        date: o.created_at,
        total: tot,
        paidAmount: paid,
        pendingAmount: Math.max(0, tot - paid),
        paymentType: (o.payment_type as any) || 'cuotas',
        installmentsCount: o.installments_count || 1,
        lastPaidMonth: o.last_installment_paid_month,
        notes: o.admin_notes,
        customer: o.customer,
        isSpecialWholesale: Boolean(o.customer?.is_special_wholesale || o.customer?.customer_type === 'special_wholesale'),
        items: (o.items || []).map((i: any) => ({
          productId: i.product_id,
          variantId: i.variant_id,
          productName: i.product_name || 'Producto',
          variantInfo: i.variant_info || '',
          quantity: i.quantity || 1,
          price: Number(i.price || 0),
          imageUrl: i.image_url || undefined,
        })),
        shippingCost: parseFloat(o.shipping_cost || 0),
        shippingType: o.shipping_type,
        shippingInvoiceUrl: o.shipping_invoice_url,
        shippingTrackingNumber: o.shipping_tracking_number,
      };
    });

  // 3. Unificar todas las deudas
  const allDebts = [...webDebts, ...posDebts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Helper de búsqueda de catálogo para incorporar productos
  const filteredStoreProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return storeProducts.slice(0, 15);
    const q = productSearchQuery.toLowerCase();
    return storeProducts
      .filter((p: any) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.categoryId || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [storeProducts, productSearchQuery]);

  // Abrir editor de compra para un cobro pendiente
  const openDebtEditor = (debt: PendingDebtRecord) => {
    setDebtToEdit(debt);
    const items = (debt.items || []).map((it: any) => ({
      ...it,
      product_id: it.productId || it.product_id,
      variant_id: it.variantId || it.variant_id,
      product_name: it.productName || it.product_name,
      variant_info: it.variantInfo || it.variant_info,
      quantity: Math.max(1, Number(it.quantity) || 1),
      price: Math.max(0, Number(it.price) || 0),
      image_url: it.imageUrl || it.image_url || null,
    }));
    setEditDebtItems(items);
    setEditDebtShippingType((debt.shippingType || 'pickup') as any);
    setEditDebtShippingCost(Number(debt.shippingCost || 0).toString());
    setEditDebtNotes(debt.notes || '');
  };

  const handleSelectProductToAdd = (p: any) => {
    setSelectedProductToAdd(p);
    setSelectedVariantIndex(0);
    setAddQuantity(1);

    const isSpecial = Boolean(
      debtToEdit?.isSpecialWholesale ||
      debtToEdit?.customer?.is_special_wholesale ||
      debtToEdit?.customer?.customer_type === 'special_wholesale'
    );
    const isWholesale = Boolean(
      debtToEdit?.customer?.is_wholesale ||
      debtToEdit?.customer?.customer_type === 'wholesale'
    );

    const firstVar = p.variants?.[0] || {};
    const defaultPrice = isSpecial
      ? (firstVar.manualWholesalePrice || p.wholesalePrice || firstVar.manualSalePrice || p.salePrice || 0)
      : isWholesale
      ? (firstVar.manualWholesalePrice || p.wholesalePrice || p.salePrice || 0)
      : (firstVar.manualSalePrice || p.salePrice || 0);

    setAddCustomPrice(Number(defaultPrice || 0).toString());
  };

  const handleVariantChangeForAdd = (idx: number) => {
    setSelectedVariantIndex(idx);
    if (!selectedProductToAdd) return;
    const p = selectedProductToAdd;
    const v = p.variants?.[idx] || {};
    const isSpecial = Boolean(
      debtToEdit?.isSpecialWholesale ||
      debtToEdit?.customer?.is_special_wholesale ||
      debtToEdit?.customer?.customer_type === 'special_wholesale'
    );
    const isWholesale = Boolean(
      debtToEdit?.customer?.is_wholesale ||
      debtToEdit?.customer?.customer_type === 'wholesale'
    );
    const defaultPrice = isSpecial
      ? (v.manualWholesalePrice || p.wholesalePrice || v.manualSalePrice || p.salePrice || 0)
      : isWholesale
      ? (v.manualWholesalePrice || p.wholesalePrice || p.salePrice || 0)
      : (v.manualSalePrice || p.salePrice || 0);

    setAddCustomPrice(Number(defaultPrice || 0).toString());
  };

  const handleConfirmAddProduct = () => {
    if (!selectedProductToAdd) return;
    const p = selectedProductToAdd;
    const v = p.variants?.[selectedVariantIndex] || p.variants?.[0] || {};
    const price = Math.max(0, parseFloat(addCustomPrice) || 0);
    const qty = Math.max(1, Number(addQuantity) || 1);

    const parts = [v.color, v.size, v.attributeValue].filter(Boolean);
    const vLabel = parts.length > 0 ? parts.join(' - ') : (v.description || 'Único / Estándar');

    const newItem = {
      product_id: String(p.id),
      variant_id: String(v.id || 'unico'),
      product_name: p.name,
      variant_info: vLabel,
      image_url: p.imageUrls?.[0] || v.imageUrl || null,
      quantity: qty,
      price: price,
    };

    setEditDebtItems(prev => [...prev, newItem]);
    setSelectedProductToAdd(null);
    setProductSearchQuery('');
    setShowAddProductModal(false);
  };

  const handleEditDebtItemQty = (index: number, delta: number) => {
    setEditDebtItems(prev => {
      const updated = [...prev];
      const cur = Number(updated[index].quantity) || 1;
      const next = Math.max(1, cur + delta);
      updated[index] = { ...updated[index], quantity: next };
      return updated;
    });
  };

  const handleEditDebtItemQtyDirect = (index: number, valStr: string) => {
    const next = Math.max(1, parseInt(valStr) || 1);
    setEditDebtItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: next };
      return updated;
    });
  };

  const handleEditDebtItemPrice = (index: number, priceStr: string) => {
    const next = Math.max(0, parseFloat(priceStr) || 0);
    setEditDebtItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price: next };
      return updated;
    });
  };

  const handleRemoveDebtItem = (index: number) => {
    setEditDebtItems(prev => prev.filter((_, i) => i !== index));
  };

  // Guardar modificaciones completas de la compra
  const handleSaveDebtEdits = async () => {
    if (!debtToEdit) return;
    if (!editDebtItems || editDebtItems.length === 0) {
      showAlert?.('La compra debe tener al menos un producto.');
      return;
    }

    setSavingDebtEdit(true);
    const effShippingCost = editDebtShippingType === 'pickup' ? 0 : Math.max(0, parseFloat(editDebtShippingCost) || 0);

    try {
      if (debtToEdit.source === 'web') {
        const token = getToken();
        const res = await fetch(`${API_URL}/api/orders/admin/${debtToEdit.reference}`, {
          method: 'PUT',
          headers: {
            'X-API-KEY': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: editDebtItems,
            shipping_type: editDebtShippingType,
            shipping_cost: effShippingCost,
            admin_notes: editDebtNotes,
          }),
        });

        if (res.ok) {
          showAlert?.(`✓ Pedido Web #${debtToEdit.reference} actualizado exitosamente.`);
          // Sincronizar también registro de mostrador si estuviera en estado local
          updateSaleTicketItems(debtToEdit.reference, editDebtItems.map(it => ({
            productId: it.product_id || it.productId,
            variantId: it.variant_id || it.variantId,
            productName: it.product_name || it.productName,
            variantInfo: it.variant_info || it.variantInfo,
            quantity: it.quantity,
            price: it.price,
            imageUrl: it.image_url || it.imageUrl,
          })), {
            shippingType: editDebtShippingType,
            shippingCost: effShippingCost,
            adminNotes: editDebtNotes,
          });
          setDebtToEdit(null);
          await fetchWebOrders();
        } else {
          const err = await res.json().catch(() => ({}));
          showAlert?.(err.detail || 'Error al actualizar pedido web.');
        }
      } else {
        // Venta de mostrador en Zustand
        updateSaleTicketItems(debtToEdit.reference, editDebtItems.map(it => ({
          productId: it.product_id || it.productId,
          variantId: it.variant_id || it.variantId,
          productName: it.product_name || it.productName,
          variantInfo: it.variant_info || it.variantInfo,
          quantity: it.quantity,
          price: it.price,
          imageUrl: it.image_url || it.imageUrl,
        })), {
          shippingType: editDebtShippingType,
          shippingCost: effShippingCost,
          adminNotes: editDebtNotes,
        });
        showAlert?.(`✓ Venta Mostrador #${debtToEdit.reference} modificada exitosamente.`);
        setDebtToEdit(null);
      }
    } catch (err: any) {
      console.error('Error al guardar edición de compra:', err);
      showAlert?.('Error al conectar con el servidor.');
    } finally {
      setSavingDebtEdit(false);
    }
  };

  // Filtros
  const filteredDebts = allDebts.filter(d => {
    const term = searchTerm.toLowerCase();
    const matchesTerm =
      d.clientName.toLowerCase().includes(term) ||
      d.clientPhone.toLowerCase().includes(term) ||
      d.reference.toLowerCase().includes(term);

    if (!matchesTerm) return false;

    if (filterSource === 'web') return d.source === 'web';
    if (filterSource === 'mostrador') return d.source === 'mostrador';
    if (filterSource === 'month_due') return d.lastPaidMonth !== currentMonth;
    return true;
  });

  const totalDeudaGlobal = allDebts.reduce((acc, d) => acc + d.pendingAmount, 0);
  const cuotasPendientesEsteMes = allDebts.filter(d => d.lastPaidMonth !== currentMonth).length;

  // Acción: Registrar cobro
  const handleConfirmRecordPayment = async () => {
    if (!selectedRecord) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) {
      showAlert?.('Ingresa un monto válido mayor a 0.');
      return;
    }
    if (amount > selectedRecord.pendingAmount) {
      showAlert?.(`El monto no puede ser mayor a la deuda ($${selectedRecord.pendingAmount.toLocaleString('es-AR')}).`);
      return;
    }

    setProcessing(true);

    if (selectedRecord.source === 'mostrador') {
      // Registrar en store de Zustand
      recordSalePayment(selectedRecord.reference, amount, paymentNote);
      markSaleMonthPaid(selectedRecord.reference, currentMonth);
      showAlert?.(`✓ Cobro de $${amount.toLocaleString('es-AR')} registrado en ${selectedRecord.reference}.`);
      setSelectedRecord(null);
      setPaymentAmount('');
      setPaymentNote('');
      setProcessing(false);
    } else {
      // Registrar en backend para Pedido Web
      const token = getToken();
      const newPaid = selectedRecord.paidAmount + amount;
      const isFullyPaid = (selectedRecord.total - newPaid) <= 0;

      try {
        const res = await fetch(`${API_URL}/api/orders/admin/${selectedRecord.reference}/status`, {
          method: 'PATCH',
          headers: {
            'X-API-KEY': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paid_amount: newPaid,
            payment_status: isFullyPaid ? 'full' : 'partial',
            last_installment_paid_month: currentMonth,
            admin_notes: paymentNote ? `${selectedRecord.notes || ''} | ${paymentNote}`.trim() : selectedRecord.notes
          })
        });

        if (res.ok) {
          showAlert?.(`✓ Cobro de $${amount.toLocaleString('es-AR')} guardado en ${selectedRecord.reference}.`);
          setSelectedRecord(null);
          setPaymentAmount('');
          setPaymentNote('');
          fetchWebOrders();
        } else {
          showAlert?.('Error al registrar cobro en el backend.');
        }
      } catch {
        showAlert?.('Error de conexión.');
      } finally {
        setProcessing(false);
      }
    }
  };


  // Acción: Eliminar cobro pendiente y devolver productos al stock (Super Admin)
  const handleConfirmDeleteDebt = async () => {
    if (!debtToDelete) return;
    setIsDeleting(true);
    try {
      if (debtToDelete.source === 'web') {
        const token = getToken();
        if (token) {
          try {
            await fetch(`${API_URL}/api/orders/admin/${debtToDelete.reference}`, {
              method: 'DELETE',
              headers: { 'X-API-KEY': token },
            });
          } catch (err) {
            console.warn('Error al eliminar pedido web en backend:', err);
          }
        }
      }

      // Restituir productos al stock y eliminar la venta del registro
      deleteSaleAndRestoreStock(debtToDelete.reference, debtToDelete.items);

      if (debtToDelete.source === 'web') {
        await fetchWebOrders();
      }

      if (showAlert) {
        showAlert(`✓ Cobro pendiente #${debtToDelete.reference} eliminado correctamente. Los productos han vuelto al stock.`);
      }
      setDebtToDelete(null);
    } catch (e: any) {
      console.error('Error al eliminar cobro pendiente:', e);
      if (showAlert) {
        showAlert('Error al eliminar el cobro pendiente. Inténtalo nuevamente.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Pantalla de edición completa (reemplaza el modal anterior) ──────────────
  if (debtToEdit) {
    const debt = debtToEdit;
    // Resolver cliente registrado más reciente si existe
    const matchedCustomer = debt.customer || customers.find(c => {
      if (debt.clientPhone && c.phone && isPhoneMatch(debt.clientPhone, c.phone)) return true;
      if (c.email && (debt as any).clientEmail && c.email.toLowerCase() === (debt as any).clientEmail.toLowerCase()) return true;
      return false;
    });

    const isSpec = Boolean(
      debt.isSpecialWholesale ||
      matchedCustomer?.is_special_wholesale ||
      matchedCustomer?.customer_type === 'special_wholesale'
    );
    const isWholesale = Boolean(
      matchedCustomer?.is_wholesale ||
      matchedCustomer?.customer_type === 'wholesale'
    );

    const customerType: 'normal' | 'wholesale' | 'special_wholesale' =
      isSpec
        ? 'special_wholesale'
        : isWholesale
        ? 'wholesale'
        : 'normal';

    const editarData: EditarCompraData = {
      source: debt.source,
      reference: debt.reference,
      fecha: debt.date,
      clientName: debt.clientName,
      clientPhone: debt.clientPhone,
      clientEmail: matchedCustomer?.email || debt.customer?.email || '',
      clientType: customerType,
      isSpecialWholesale: isSpec,
      items: (debt.items || []).map((it: any) => ({
        product_id: it.productId || it.product_id || '',
        variant_id: it.variantId || it.variant_id || '',
        product_name: it.productName || it.product_name || 'Producto',
        variant_info: it.variantInfo || it.variant_info || '',
        quantity: Math.max(1, Number(it.quantity) || 1),
        price: Math.max(0, Number(it.price) || 0),
        image_url: it.imageUrl || it.image_url || null,
      })),
      shippingType: (debt.shippingType || 'pickup') as any,
      shippingCost: Number(debt.shippingCost || 0),
      total: Number(debt.total || 0),
      paidAmount: Number(debt.paidAmount || 0),
      notes: debt.notes || '',
      customer: matchedCustomer || debt.customer,
    };

    return (
      <EditarCompraView
        data={editarData}
        apiKey={apiKey}
        showAlert={showAlert}
        onSaved={async () => {
          setDebtToEdit(null);
          if (debt.source === 'web') await fetchWebOrders();
        }}
        onCancel={() => setDebtToEdit(null)}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Cobros Pendientes y Cuotas</h2>
              <p className="text-xs text-slate-500">Gestión de saldos adeudados de compras web y mostrador</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Adeudado Global</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">${totalDeudaGlobal.toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* Banner de Recordatorio Mensual */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3.5 mb-6">
          <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">calendar_month</span>
          <div className="flex-1 text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Recordatorio mensual de cobros ({currentMonth})
            </p>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              Tenés <strong className="text-amber-700 dark:text-amber-300">{cuotasPendientesEsteMes} cliente(s)</strong> con saldos pendientes de cobrar este mes. Al registrar el cobro correspondiente, la notificación se apagará hasta el mes que viene en caso de que continúe quedando deuda.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
            <button
              onClick={() => setFilterSource('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Todos ({allDebts.length})
            </button>

            <button
              onClick={() => setFilterSource('month_due')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'month_due'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-sm hidden sm:inline">notifications_active</span>
              <span className="truncate">A Cobrar Este Mes ({cuotasPendientesEsteMes})</span>
            </button>

            <button
              onClick={() => setFilterSource('web')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'web'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              🌐 Web ({webDebts.length})
            </button>

            <button
              onClick={() => setFilterSource('mostrador')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                filterSource === 'mostrador'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              🏪 Mostrador ({posDebts.length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Buscar cliente, tel o ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Lista de Cobros Pendientes */}
      <div className="space-y-3.5">
        {filteredDebts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">task_alt</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay cobros pendientes</p>
            <p className="text-xs text-slate-500 mt-1">Todos los clientes tienen sus cuentas saldadas.</p>
          </div>
        ) : (
          filteredDebts.map((d) => {
            const isPaidThisMonth = d.lastPaidMonth === currentMonth;
            const approxCuota = d.installmentsCount > 0 ? Math.round(d.pendingAmount / d.installmentsCount) : d.pendingAmount;

            return (
              <div
                key={d.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  
                  {/* Izquierda: Info de Cliente y Venta */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      d.source === 'web' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">
                        {d.source === 'web' ? 'language' : 'point_of_sale'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {d.clientName}
                        </span>
                        
                        <span className="font-mono text-xs text-slate-500">
                          #{d.reference}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.source === 'web' 
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {d.source === 'web' ? 'Pedido Online' : 'Venta Mostrador'}
                        </span>

                        {Boolean(d.customer?.is_special_wholesale || d.isSpecialWholesale || d.customer?.customer_type === 'special_wholesale') ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1 shadow-xs">
                            <span>👑</span> Mayorista Especial
                          </span>
                        ) : Boolean(d.customer?.is_wholesale || d.customer?.customer_type === 'wholesale') ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center gap-1">
                            Mayorista
                          </span>
                        ) : null}

                        {Boolean(d.shippingCost && d.shippingCost > 0) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">local_shipping</span>
                            Envío (${d.shippingCost?.toLocaleString('es-AR')})
                          </span>
                        )}

                        {d.shippingInvoiceUrl && (
                          <a
                            href={d.shippingInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-200 border border-orange-200 dark:border-orange-800 flex items-center gap-1 transition-all"
                            title="Ver Factura de Envío"
                          >
                            <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                            Factura
                          </a>
                        )}

                        {/* Estado del Mes */}
                        {isPaidThisMonth ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">done_all</span>
                            Cobrado este mes
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            Pendiente cobrar este mes
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Tel: <strong className="text-slate-700 dark:text-slate-300">{d.clientPhone}</strong></span>
                        {d.installmentsCount > 1 && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg text-[11px]">
                            {d.installmentsCount} cuotas (~${approxCuota.toLocaleString('es-AR')} c/u)
                          </span>
                        )}
                      </div>

                      {d.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1">Nota: {d.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Derecha: Desglose financiero (Total Venta, Abonado, Adeuda) y Botones */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-end gap-3 sm:gap-4 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100 dark:border-slate-700">
                    
                    {/* Grid de los 3 montos claramente destacados */}
                    <div className="grid grid-cols-3 gap-2 shrink-0">
                      
                      {/* 1. Total Venta */}
                      <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200 dark:border-slate-700 text-center min-w-[95px] sm:min-w-[110px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Venta</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white mt-0.5 font-mono">
                          ${d.total.toLocaleString('es-AR')}
                        </p>
                      </div>

                      {/* 2. Cuánto pagó */}
                      <div className="px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center min-w-[95px] sm:min-w-[110px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Abonado</p>
                        <p className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                          ${d.paidAmount.toLocaleString('es-AR')}
                        </p>
                      </div>

                      {/* 3. Cuánto adeuda */}
                      <div className="px-3 py-2 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-center min-w-[95px] sm:min-w-[110px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Adeuda</p>
                        <p className="text-xs sm:text-sm sm:text-base font-black text-red-600 dark:text-red-400 mt-0.5 font-mono">
                          ${d.pendingAmount.toLocaleString('es-AR')}
                        </p>
                      </div>

                    </div>

                    {/* Acciones: Ver Venta, Ticket, Registrar Cobro, Eliminar */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Botón Ver Detalle */}
                      <button
                        onClick={() => setSelectedDetailRecord(d)}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Ver detalle de la venta"
                      >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>

                      {/* Botón Editar Compra (Productos, Precios y Envío) */}
                      {canManageCobros && (
                        <button
                          onClick={() => openDebtEditor(d)}
                          className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-bold text-xs transition-colors shadow-xs"
                          title="Modificar productos, cantidades, precios o método de envío"
                        >
                          <span className="material-symbols-outlined text-base">edit_note</span>
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                      )}

                      {/* Botón Ticket PDF */}
                      {d.source === 'mostrador' && d.rawSaleRecords && d.rawSaleRecords.length > 0 && (
                        <button
                          onClick={() => {
                            try {
                              generateTicketPDF(d.reference, d.rawSaleRecords as SaleRecord[], true);
                              showAlert?.('Ticket enviado a impresión.');
                            } catch (e) {
                              console.error(e);
                              showAlert?.('Error al generar el ticket PDF');
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm"
                          title="Imprimir / Descargar Ticket PDF"
                        >
                          <span className="material-symbols-outlined text-base">print</span>
                          <span className="hidden sm:inline">Ticket</span>
                        </button>
                      )}

                      {/* Botón Registrar Cobro */}
                      {canManageCobros ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedRecord(d);
                              setPaymentAmount('');
                              setPaymentNote('');
                            }}
                            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                          >
                            <span className="material-symbols-outlined text-base">payments</span>
                            Registrar Cobro
                          </button>

                          {/* Botón Eliminar Cobro Pendiente (Super Admin / Admin) */}
                          <button
                            onClick={() => setDebtToDelete(d)}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors tooltip"
                            title="Eliminar cobro pendiente y devolver productos al stock"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">visibility</span> Solo Lectura
                        </span>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Registrar Cobro */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-green-500">payments</span>
                Registrar Cobro
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl mb-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800 dark:text-white">{selectedRecord.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Origen / Ref:</span>
                <span className="font-mono">{selectedRecord.source === 'web' ? 'Web' : 'Mostrador'} #{selectedRecord.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Venta:</span>
                <span className="font-bold">${selectedRecord.total.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ya Abonado:</span>
                <span className="font-bold text-emerald-600">${selectedRecord.paidAmount.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-red-600 font-bold text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Saldo Adeudado:</span>
                <span className="font-black">${selectedRecord.pendingAmount.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Monto a cobrar hoy ($):</label>
                <input
                  type="number"
                  min="1"
                  max={selectedRecord.pendingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Ej: ${selectedRecord.pendingAmount}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-lg text-green-600 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Detalle o comprobante (opcional):</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ej: Cuota 2 pagada por transferencia..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRecordPayment}
                  disabled={processing}
                  className="flex-[2] py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold shadow-md shadow-green-500/20 transition-all"
                >
                  Confirmar Cobro
                </button>
              </div>

              {canManageCobros && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const toDelete = selectedRecord;
                      setSelectedRecord(null);
                      setDebtToDelete(toDelete);
                    }}
                    className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Eliminar este cobro y devolver stock
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE COBRO PENDIENTE (SUPER ADMIN ONLY) */}
      {debtToDelete && canManageCobros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-red-200 dark:border-red-900/40 animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 pb-4 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border-b border-red-100 dark:border-red-950 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  ¿Eliminar cobro pendiente #{debtToDelete.reference}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Acción exclusiva de Super Administrador. Se anulará el registro y los productos volverán automáticamente al inventario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setDebtToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{debtToDelete.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Canal / Fecha:</span>
                  <span>{debtToDelete.source === 'web' ? '🌐 Pedido Web' : '🏪 Mostrador'} · {formatDate(debtToDelete.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Venta:</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    ${debtToDelete.total.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ya Abonado:</span>
                  <span className="font-bold text-emerald-600">${debtToDelete.paidAmount.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400 font-bold text-sm pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <span>Saldo Pendiente (Adeudado):</span>
                  <span className="font-black">${debtToDelete.pendingAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Items to return to stock */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs mb-2.5">
                  <span className="material-symbols-outlined text-base text-emerald-600">inventory_2</span>
                  <span>Productos que volverán al stock:</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {debtToDelete.items && debtToDelete.items.length > 0 ? (
                    debtToDelete.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-xs shadow-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {it.productName}
                          </p>
                          {it.variantInfo && (
                            <p className="text-[10px] text-slate-400 truncate">{it.variantInfo}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-black rounded-lg text-xs">
                          <span className="material-symbols-outlined text-sm">arrow_upward</span>
                          +{it.quantity} {it.quantity === 1 ? 'ud' : 'uds'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic p-2">
                      Los ítems asociados a la venta volverán automáticamente al inventario.
                    </p>
                  )}
                </div>
              </div>

              {/* Warning note */}
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-3.5 text-xs text-red-700 dark:text-red-300">
                <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">warning</span>
                <p className="leading-relaxed">
                  Este cobro pendiente y su venta asociada serán <strong>eliminados permanentemente</strong> del registro y las cantidades arriba detalladas se <strong>reintegrarán automáticamente al inventario</strong>.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setDebtToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDebt}
                disabled={isDeleting}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    <span>Confirmar y Devolver Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Ver Detalle de Venta */}
      {selectedDetailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Detalle de Venta #{selectedDetailRecord.reference}
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    selectedDetailRecord.source === 'mostrador'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                  }`}>
                    {selectedDetailRecord.source === 'mostrador' ? 'Mostrador' : 'Online Web'}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                    ⏳ Deuda pendiente
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDate(selectedDetailRecord.date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailRecord(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Cliente */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Datos del Cliente</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedDetailRecord.clientName}</p>
                {selectedDetailRecord.clientPhone && selectedDetailRecord.clientPhone !== 'S/D' && (
                  <p className="text-xs text-slate-500 mt-0.5">Teléfono: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedDetailRecord.clientPhone}</span></p>
                )}
                {selectedDetailRecord.notes && (
                  <p className="text-xs text-slate-500 italic mt-1">Nota: {selectedDetailRecord.notes}</p>
                )}
              </div>

              {/* Productos */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-3">
                  Productos ({selectedDetailRecord.items.length})
                </span>
                <div className="space-y-2">
                  {selectedDetailRecord.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800 text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {item.quantity}x {item.productName}
                        </p>
                        {item.variantInfo && (
                          <p className="text-[11px] text-slate-400">{item.variantInfo}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 font-mono font-bold text-slate-800 dark:text-white">
                        {item.price != null ? `$${(item.quantity * item.price).toLocaleString('es-AR')}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Envío (si aplica) */}
              {selectedDetailRecord.shippingCost != null && selectedDetailRecord.shippingCost > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-2xl border border-orange-200 dark:border-orange-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">local_shipping</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-orange-800 dark:text-orange-400 uppercase tracking-wider block">Envío / Despacho</span>
                      <p className="font-black text-sm text-slate-900 dark:text-white">
                        ${selectedDetailRecord.shippingCost.toLocaleString('es-AR')}
                      </p>
                      <p className="text-[10px] text-orange-500 mt-0.5">A cargo del comprador — no computable como ganancia</p>
                      {selectedDetailRecord.shippingTrackingNumber && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Guía / Empresa: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedDetailRecord.shippingTrackingNumber}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedDetailRecord.shippingInvoiceUrl && (
                    <a
                      href={selectedDetailRecord.shippingInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all self-start sm:self-center"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      Ver Factura de Envío
                    </a>
                  )}
                </div>
              )}

              {/* Desglose de importes */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Subtotal Mercadería */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Subtotal Mercadería</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                    ${(selectedDetailRecord.total - (selectedDetailRecord.shippingCost || 0)).toLocaleString('es-AR')}
                  </span>
                </div>
                {selectedDetailRecord.shippingCost != null && selectedDetailRecord.shippingCost > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-950/20 border-t border-orange-100 dark:border-orange-900/30">
                    <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                      Envío (a cargo del comprador)
                    </span>
                    <span className="text-sm font-bold text-orange-700 dark:text-orange-400 font-mono">
                      +${selectedDetailRecord.shippingCost.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
                {/* Total cobrado al cliente */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total Venta (cobrado al cliente)</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                    ${selectedDetailRecord.total.toLocaleString('es-AR')}
                  </span>
                </div>
                {/* Abonado */}
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-t border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ya Abonado</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    ${selectedDetailRecord.paidAmount.toLocaleString('es-AR')}
                  </span>
                </div>
                {/* Saldo Adeudado */}
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-800/40">
                  <span className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-400">Saldo Adeudado</span>
                  <span className="text-xl font-black text-red-700 dark:text-red-400 font-mono">
                    ${selectedDetailRecord.pendingAmount.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => setSelectedDetailRecord(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors"
              >
                Cerrar
              </button>
              <div className="flex items-center gap-2">
                {canManageCobros && (
                  <button
                    onClick={() => {
                      const debt = selectedDetailRecord;
                      setSelectedDetailRecord(null);
                      openDebtEditor(debt);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
                    title="Modificar productos, cantidades, precios o método de envío"
                  >
                    <span className="material-symbols-outlined text-base">edit_note</span>
                    Editar Compra
                  </button>
                )}
                {selectedDetailRecord.source === 'mostrador' && selectedDetailRecord.rawSaleRecords && selectedDetailRecord.rawSaleRecords.length > 0 && (
                  <button
                    onClick={() => {
                      try {
                        generateTicketPDF(selectedDetailRecord.reference, selectedDetailRecord.rawSaleRecords as SaleRecord[], true);
                        showAlert?.('Ticket enviado a impresión.');
                      } catch (e) {
                        console.error(e);
                        showAlert?.('Error al generar el ticket PDF');
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    Imprimir Ticket
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedDetailRecord(null);
                    const debt = selectedDetailRecord;
                    setSelectedRecord(debt);
                    setPaymentAmount('');
                    setPaymentNote('');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  Registrar Cobro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Modificar Compra Completa en Cobros Pendientes */}
      {debtToEdit && (() => {
        const isSpecialWholesale = Boolean(
          debtToEdit.isSpecialWholesale ||
          debtToEdit.customer?.is_special_wholesale ||
          debtToEdit.customer?.customer_type === 'special_wholesale'
        );
        const isWholesale = Boolean(
          debtToEdit.customer?.is_wholesale ||
          debtToEdit.customer?.customer_type === 'wholesale'
        );

        const itemsTotal = editDebtItems.reduce((sum: number, it: any) => {
          return sum + ((Number(it.quantity) || 1) * (Number(it.price) || 0));
        }, 0);
        const effShippingCost = editDebtShippingType === 'pickup' ? 0 : Math.max(0, parseFloat(editDebtShippingCost) || 0);
        const grandTotal = itemsTotal + effShippingCost;
        const newPending = Math.max(0, grandTotal - debtToEdit.paidAmount);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600">
                    <span className="material-symbols-outlined text-xl">edit_note</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Modificar Compra #{debtToEdit.reference}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        debtToEdit.source === 'web'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {debtToEdit.source === 'web' ? 'Pedido Online' : 'Venta Mostrador'}
                      </span>
                      {isSpecialWholesale ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          👑 Mayorista Especial
                        </span>
                      ) : isWholesale ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                          Mayorista
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      Cliente: <strong>{debtToEdit.clientName}</strong> · Tel: {debtToEdit.clientPhone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDebtToEdit(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-xs">
                
                {/* 1. Método de Entrega y Envío */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    1. Método de Entrega / Envío
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setEditDebtShippingType('pickup')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editDebtShippingType === 'pickup'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <span className="text-sm">🏪</span> Retiro en Local
                      </div>
                      <p className="text-[11px] text-slate-500">Sin costo de envío ($0)</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditDebtShippingType('delivery')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editDebtShippingType === 'delivery'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <span className="text-sm">🚚</span> Envío Local (Formosa)
                      </div>
                      <p className="text-[11px] text-slate-500">Cadetería dentro de la ciudad</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditDebtShippingType('national')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editDebtShippingType === 'national'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <span className="text-sm">🚛</span> Envío Nacional
                      </div>
                      <p className="text-[11px] text-slate-500">Transporte o Correo a convenir</p>
                    </button>
                  </div>

                  {editDebtShippingType !== 'pickup' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <label className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        Costo de Envío a cobrar ($):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editDebtShippingCost}
                        onChange={(e) => setEditDebtShippingCost(e.target.value)}
                        placeholder="0"
                        className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-black text-slate-800 dark:text-white"
                      />
                      <span className="text-[11px] text-slate-400">
                        {editDebtShippingType === 'national' ? 'Costo acordado para despacho nacional' : 'Costo del cadete local'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Productos de la Compra */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        2. Productos de la Compra ({editDebtItems.length})
                      </p>
                      {isSpecialWholesale && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                          <span>👑</span> Precios especiales habilitados para este cliente mayorista especial
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddProductModal(true);
                        setProductSearchQuery('');
                        setSelectedProductToAdd(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-primary/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                      + Agregar Producto
                    </button>
                  </div>

                  {editDebtItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                      <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">remove_shopping_cart</span>
                      <p>La compra no tiene productos. Usá el botón de arriba para agregar uno.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {editDebtItems.map((item: any, i: number) => {
                        const qty = Number(item.quantity) || 1;
                        const price = Number(item.price) || 0;
                        const lineSubtotal = qty * price;

                        return (
                          <div key={i} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                  <span className="material-symbols-outlined text-lg">inventory_2</span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 dark:text-white truncate text-xs">{item.product_name}</p>
                                <p className="text-[11px] text-slate-400 truncate">{item.variant_info || 'Estándar'}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              {/* Precio Unitario Editable */}
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 font-medium">Precio Unitario ($)</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={item.price}
                                    onChange={(e) => handleEditDebtItemPrice(i, e.target.value)}
                                    className={`w-24 px-2 py-1 text-right font-black rounded-lg border text-xs ${
                                      isSpecialWholesale
                                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Cantidad con botones +/- */}
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-400 font-medium">Cantidad</span>
                                <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900">
                                  <button
                                    type="button"
                                    onClick={() => handleEditDebtItemQty(i, -1)}
                                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 font-bold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleEditDebtItemQtyDirect(i, e.target.value)}
                                    className="w-12 text-center font-bold text-xs bg-transparent outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleEditDebtItemQty(i, 1)}
                                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Subtotal */}
                              <div className="text-right min-w-[75px]">
                                <span className="text-[10px] text-slate-400 block font-medium">Subtotal</span>
                                <span className="font-black text-slate-800 dark:text-white text-xs">
                                  ${lineSubtotal.toLocaleString('es-AR')}
                                </span>
                              </div>

                              {/* Botón Eliminar */}
                              <button
                                type="button"
                                onClick={() => handleRemoveDebtItem(i)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                title="Eliminar producto de la compra"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Notas Administrativas */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    3. Notas Administrativas (Opcional)
                  </label>
                  <input
                    type="text"
                    value={editDebtNotes}
                    onChange={(e) => setEditDebtNotes(e.target.value)}
                    placeholder="Ej: Ajustado a pedido del cliente..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                  />
                </div>

                {/* Resumen Financiero Actualizado */}
                <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Subtotal Mercadería ({editDebtItems.length}):</span>
                    <span className="font-bold">${itemsTotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Costo de Envío ({editDebtShippingType === 'pickup' ? 'Retiro en local' : editDebtShippingType === 'national' ? 'Envío nacional' : 'Envío local'}):</span>
                    <span className="font-bold">${effShippingCost.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Total Venta Actualizado:</span>
                    <span className="font-black text-slate-900 dark:text-white">${grandTotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span>Ya Abonado por el Cliente:</span>
                    <span>${debtToEdit.paidAmount.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                    <span className="font-extrabold text-red-600 dark:text-red-400">Nuevo Saldo Adeudado:</span>
                    <span className="font-black text-red-600 dark:text-red-400 text-lg">${newPending.toLocaleString('es-AR')}</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDebtToEdit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDebtEdits}
                  disabled={savingDebtEdit || editDebtItems.length === 0}
                  className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    {savingDebtEdit ? 'sync' : 'save'}
                  </span>
                  {savingDebtEdit ? 'Guardando cambios...' : 'Guardar Modificaciones de la Compra'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: Seleccionar e Incorporar Producto a la Compra en Cobros Pendientes */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_shopping_cart</span>
                Agregar Producto a la Compra
              </h3>
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  setSelectedProductToAdd(null);
                  setProductSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-xs">
              {!selectedProductToAdd ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Buscar en el Catálogo:
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                        search
                      </span>
                      <input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, SKU o categoría..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    {filteredStoreProducts.length === 0 ? (
                      <p className="p-4 text-center text-slate-400">No se encontraron productos coincidentes.</p>
                    ) : (
                      filteredStoreProducts.map((p: any) => {
                        const img = p.imageUrls?.[0] || p.variants?.[0]?.imageUrl;
                        const isSpecial = Boolean(
                          debtToEdit?.isSpecialWholesale ||
                          debtToEdit?.customer?.is_special_wholesale ||
                          debtToEdit?.customer?.customer_type === 'special_wholesale'
                        );
                        const isWholesale = Boolean(
                          debtToEdit?.customer?.is_wholesale ||
                          debtToEdit?.customer?.customer_type === 'wholesale'
                        );
                        const displayPrice = isSpecial || isWholesale
                          ? (p.wholesalePrice || p.salePrice || 0)
                          : (p.salePrice || 0);

                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProductToAdd(p)}
                            className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {img ? (
                                <img src={img} alt={p.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {p.categoryId || 'Sin categoría'} {p.sku ? `· SKU: ${p.sku}` : ''}
                                  {p.variants?.length ? ` · ${p.variants.length} variantes` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-black text-slate-800 dark:text-white text-xs block">
                                ${Number(displayPrice).toLocaleString('es-AR')}
                              </span>
                              <span className="text-[10px] text-primary font-bold">Seleccionar ›</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Producto Seleccionado */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(selectedProductToAdd.imageUrls?.[0] || selectedProductToAdd.variants?.[0]?.imageUrl) && (
                        <img
                          src={selectedProductToAdd.imageUrls?.[0] || selectedProductToAdd.variants?.[0]?.imageUrl}
                          alt={selectedProductToAdd.name}
                          className="w-12 h-12 rounded-xl object-cover border"
                        />
                      )}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedProductToAdd.name}</p>
                        <p className="text-slate-400 text-[11px]">{selectedProductToAdd.categoryId || ''}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProductToAdd(null)}
                      className="text-xs text-primary hover:underline font-bold"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Selector de Variante */}
                  {selectedProductToAdd.variants && selectedProductToAdd.variants.length > 1 && (
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Seleccionar Variante / Color / Presentación:
                      </label>
                      <select
                        value={selectedVariantIndex}
                        onChange={(e) => handleVariantChangeForAdd(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                      >
                        {selectedProductToAdd.variants.map((v: any, idx: number) => {
                          const parts = [v.color, v.size, v.attributeValue].filter(Boolean);
                          const desc = parts.length > 0 ? parts.join(' - ') : (v.description || `Variante #${idx + 1}`);
                          const st = v.stock !== undefined ? ` (Stock: ${v.stock})` : '';
                          return (
                            <option key={idx} value={idx}>
                              {desc} {st}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Cantidad y Precio */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cantidad:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={addQuantity}
                        onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-center"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Precio Unitario ($):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={addCustomPrice}
                        onChange={(e) => setAddCustomPrice(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border font-black text-right ${
                          Boolean(
                            debtToEdit?.isSpecialWholesale ||
                            debtToEdit?.customer?.is_special_wholesale ||
                            debtToEdit?.customer?.customer_type === 'special_wholesale'
                          )
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  {Boolean(
                    debtToEdit?.isSpecialWholesale ||
                    debtToEdit?.customer?.is_special_wholesale ||
                    debtToEdit?.customer?.customer_type === 'special_wholesale'
                  ) && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-800 dark:text-amber-200 text-[11px] flex items-center gap-1.5">
                      <span>👑</span> Podés colocar el precio unitario pactado para este cliente mayorista especial.
                    </div>
                  )}

                  {/* Subtotal del item a agregar */}
                  <div className="flex justify-between items-center p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold">
                    <span>Subtotal del producto agregado:</span>
                    <span className="font-black text-primary text-sm">
                      ${((addQuantity || 1) * (parseFloat(addCustomPrice) || 0)).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProductToAdd(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Volver a la lista
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAddProduct}
                      className="flex-[2] py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-primary/20"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                      Incorporar a la Compra
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
