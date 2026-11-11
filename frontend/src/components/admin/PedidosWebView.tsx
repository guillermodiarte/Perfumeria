'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_URL } from '@/utils/api';
import { generateTicketPDF } from '@/utils/generateTicket';
import { useStockFlowStore } from '@/store/useStockStore';

interface PedidosWebViewProps {
  apiKey?: string;
  showAlert?: (msg: string) => void;
  currentAdminRole?: string;
}

export default function PedidosWebView({ apiKey, showAlert, currentAdminRole }: PedidosWebViewProps) {
  const isSuperAdmin = currentAdminRole === 'super_admin';
  const isAdmin = currentAdminRole === 'admin';
  const isEmpleado = currentAdminRole === 'empleado' || currentAdminRole === 'editor';
  const isViewer = currentAdminRole === 'viewer';
  const canManagePayments = isSuperAdmin || isAdmin;
  const canManageShipping = isSuperAdmin || isAdmin || isEmpleado;

  const storeProducts = useStockFlowStore(s => s.products) || [];

  const [webOrders, setWebOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'to_ship' | 'pickup_pending' | 'shipped' | 'delivered' | 'rejected' | 'all'>('pending');

  // Modal Aprobar Pedido
  const [orderToApprove, setOrderToApprove] = useState<any | null>(null);
  const [approvalItems, setApprovalItems] = useState<any[]>([]);
  const [approvalPaymentType, setApprovalPaymentType] = useState<'total' | 'partial' | 'cuotas'>('total');
  const [approvalPaidAmount, setApprovalPaidAmount] = useState<string>('');
  const [approvalInstallments, setApprovalInstallments] = useState<number>(3);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // Modal Edición Completa de Pedido (Productos, Precios, Cantidades y Envío)
  const [orderToEditProducts, setOrderToEditProducts] = useState<any | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<any[]>([]);
  const [editOrderShippingType, setEditOrderShippingType] = useState<'pickup' | 'delivery' | 'national'>('delivery');
  const [editOrderShippingCost, setEditOrderShippingCost] = useState<string>('0');
  const [editOrderNotes, setEditOrderNotes] = useState<string>('');
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);

  // Buscador y selector para añadir producto a un pedido
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<any | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addCustomPrice, setAddCustomPrice] = useState<string>('');

  // Modal Despachar / Enviar Pedido
  const [orderToShip, setOrderToShip] = useState<any | null>(null);
  const [shippingTracking, setShippingTracking] = useState('');
  const [shippingInvoiceFile, setShippingInvoiceFile] = useState<File | null>(null);
  const [shippingSubmitting, setShippingSubmitting] = useState(false);

  // Modal Rechazar
  const [orderToReject, setOrderToReject] = useState<any | null>(null);

  // Modal Detalle
  const [orderDetail, setOrderDetail] = useState<any | null>(null);

  // Modal Editar Cobro / Entrega
  const [orderToEdit, setOrderToEdit] = useState<any | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('full');
  const [editPaymentType, setEditPaymentType] = useState<'total' | 'partial' | 'cuotas'>('total');
  const [editInstallmentsCount, setEditInstallmentsCount] = useState<number>(1);
  const [editDeliveryStatus, setEditDeliveryStatus] = useState<'pending' | 'shipped' | 'delivered'>('pending');
  const [editNotes, setEditNotes] = useState<string>('');

  // Modal Eliminar
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);

  // Filtro de mes para tabs históricas (Enviados, Entregados, Rechazados, Todos)
  // 'current' = mes en curso | 'YYYY-MM' = mes específico
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('current');

  const getToken = (): string => apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') ?? '' : '');

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/all`, {
        headers: { 'X-API-KEY': token }
      });
      if (res.ok) {
        const data = await res.json();
        setWebOrders(data);
      }
    } catch (e) {
      console.warn('Error al cargar pedidos web:', e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Manejar apertura de modal aprobar
  const openApproveModal = (order: any) => {
    setOrderToApprove(order);
    const items = (order.items || []).map((it: any) => ({
      ...it,
      quantity: Math.max(1, Number(it.quantity) || 1),
      price: Math.max(0, Number(it.price) || 0),
    }));
    setApprovalItems(items);
    setApprovalPaymentType('total');
    setApprovalPaidAmount(order.total?.toString() || '0');
    setApprovalInstallments(3);
    setApprovalNotes(order.admin_notes || '');
  };

  // Confirmar aprobación
  const handleConfirmApproval = async () => {
    if (!orderToApprove) return;
    setProcessing(true);
    const token = getToken();

    const itemsSum = approvalItems.reduce((s: number, it: any) => s + (Number(it.quantity || 1) * Number(it.price || 0)), 0);
    const shippingCost = orderToApprove.shipping_type === 'pickup' ? 0 : Number(orderToApprove.shipping_cost || 0);
    const total = itemsSum + shippingCost;
    let finalPaid = total;
    let paymentStatus = 'full';

    if (approvalPaymentType === 'partial') {
      const parsed = parseFloat(approvalPaidAmount) || 0;
      finalPaid = Math.min(total, Math.max(0, parsed));
      paymentStatus = finalPaid >= total ? 'full' : (finalPaid > 0 ? 'partial' : 'pending');
    } else if (approvalPaymentType === 'cuotas') {
      const parsed = parseFloat(approvalPaidAmount) || 0;
      finalPaid = Math.min(total, Math.max(0, parsed));
      paymentStatus = finalPaid >= total ? 'full' : (finalPaid > 0 ? 'partial' : 'pending');
    }

    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToApprove.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Aprobado',
          payment_status: paymentStatus,
          payment_type: approvalPaymentType,
          installments_count: approvalPaymentType === 'cuotas' ? approvalInstallments : 1,
          paid_amount: finalPaid,
          admin_notes: approvalNotes,
          items: approvalItems,
          total: total,
        })
      });

      if (res.ok) {
        showAlert?.(`✓ Pedido ${orderToApprove.order_number} aprobado exitosamente.`);
        setOrderToApprove(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert?.(err.detail || 'Error al aprobar pedido.');
      }
    } catch {
      showAlert?.('Error de red al conectar con el servidor.');
    } finally {
      setProcessing(false);
    }
  };

  // Abrir modal de edición completa del pedido
  const openOrderEditor = (order: any) => {
    setOrderToEditProducts(order);
    const items = (order.items || []).map((it: any) => ({
      ...it,
      quantity: Math.max(1, Number(it.quantity) || 1),
      price: Math.max(0, Number(it.price) || 0),
    }));
    setEditOrderItems(items);
    setEditOrderShippingType((order.shipping_type || 'delivery') as any);
    setEditOrderShippingCost(Number(order.shipping_cost || 0).toString());
    setEditOrderNotes(order.admin_notes || '');
  };

  // Guardar modificaciones completas del pedido
  const handleSaveOrderEdits = async () => {
    if (!orderToEditProducts) return;
    if (!editOrderItems || editOrderItems.length === 0) {
      showAlert?.('El pedido debe tener al menos un producto.');
      return;
    }

    setSavingOrderEdit(true);
    const token = getToken();
    const effShippingCost = editOrderShippingType === 'pickup' ? 0 : Math.max(0, parseFloat(editOrderShippingCost) || 0);

    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToEditProducts.order_number}`, {
        method: 'PUT',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: editOrderItems,
          shipping_type: editOrderShippingType,
          shipping_cost: effShippingCost,
          admin_notes: editOrderNotes,
        }),
      });

      if (res.ok) {
        showAlert?.(`✓ Pedido #${orderToEditProducts.order_number} actualizado exitosamente.`);
        setOrderToEditProducts(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert?.(err.detail || 'Error al actualizar pedido.');
      }
    } catch {
      showAlert?.('Error de red al actualizar pedido.');
    } finally {
      setSavingOrderEdit(false);
    }
  };

  // Helper de búsqueda de productos para incorporar al pedido
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

  const handleSelectProductToAdd = (p: any) => {
    setSelectedProductToAdd(p);
    setSelectedVariantIndex(0);
    setAddQuantity(1);

    const isSpecial = Boolean(
      orderToEditProducts?.customer?.is_special_wholesale ||
      orderToEditProducts?.customer?.customer_type === 'special_wholesale'
    );
    const isWholesale = Boolean(
      orderToEditProducts?.customer?.is_wholesale ||
      orderToEditProducts?.customer?.customer_type === 'wholesale'
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
      orderToEditProducts?.customer?.is_special_wholesale ||
      orderToEditProducts?.customer?.customer_type === 'special_wholesale'
    );
    const isWholesale = Boolean(
      orderToEditProducts?.customer?.is_wholesale ||
      orderToEditProducts?.customer?.customer_type === 'wholesale'
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

    setEditOrderItems(prev => [...prev, newItem]);
    setSelectedProductToAdd(null);
    setProductSearchQuery('');
    setShowAddProductModal(false);
  };

  const handleApprovalItemPriceChange = (index: number, newPriceStr: string) => {
    const newPrice = Math.max(0, parseFloat(newPriceStr) || 0);
    setApprovalItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price: newPrice };
      if (approvalPaymentType === 'total') {
        const itemsSum = updated.reduce((s: number, it: any) => s + (Number(it.quantity || 1) * Number(it.price || 0)), 0);
        const effShip = orderToApprove?.shipping_type === 'pickup' ? 0 : Number(orderToApprove?.shipping_cost || 0);
        setApprovalPaidAmount((itemsSum + effShip).toString());
      }
      return updated;
    });
  };

  const handleEditItemQty = (index: number, delta: number) => {
    setEditOrderItems(prev => {
      const updated = [...prev];
      const cur = Number(updated[index].quantity) || 1;
      const next = Math.max(1, cur + delta);
      updated[index] = { ...updated[index], quantity: next };
      return updated;
    });
  };

  const handleEditItemQtyDirect = (index: number, valStr: string) => {
    const next = Math.max(1, parseInt(valStr) || 1);
    setEditOrderItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: next };
      return updated;
    });
  };

  const handleEditItemPrice = (index: number, priceStr: string) => {
    const next = Math.max(0, parseFloat(priceStr) || 0);
    setEditOrderItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price: next };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  // Confirmar Rechazo
  const handleConfirmReject = async () => {
    if (!orderToReject) return;
    setProcessing(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToReject.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Rechazado',
          delivery_status: 'cancelled'
        })
      });
      if (res.ok) {
        showAlert?.(`Pedido ${orderToReject.order_number} de "${orderToReject.customer?.name || 'el cliente'}" fue rechazado y pasó a la pestaña Rechazados.`);
        setOrderToReject(null);
        fetchOrders();
      } else {
        showAlert?.('Error al rechazar el pedido.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Confirmar despacho / envío con tracking y factura adjunta
  const handleConfirmShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToShip) return;
    setShippingSubmitting(true);
    const token = getToken();

    try {
      const formData = new FormData();
      if (shippingTracking.trim()) {
        formData.append('tracking_number', shippingTracking.trim());
      }
      if (shippingInvoiceFile) {
        formData.append('invoice_file', shippingInvoiceFile);
      }

      const res = await fetch(`/api/admin/orders/${orderToShip.order_number}/ship`, {
        method: 'POST',
        headers: { 'X-API-KEY': token },
        body: formData,
      });

      if (res.ok) {
        showAlert?.(`✓ Pedido #${orderToShip.order_number} marcado como despachado/enviado.`);
        setOrderToShip(null);
        setShippingTracking('');
        setShippingInvoiceFile(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert?.(err.detail || 'Error al despachar el pedido.');
      }
    } catch {
      showAlert?.('Error de red al registrar el envío.');
    } finally {
      setShippingSubmitting(false);
    }
  };

  // Marcar entregado o retirado
  const handleMarkDelivered = async (order: any) => {
    const isPickup = (order.shipping_type || '').toLowerCase() === 'pickup';
    const actionLabel = isPickup ? 'retirado por el cliente' : 'entregado a domicilio';
    if (!confirm(`¿Confirmar que el pedido #${order.order_number} ya fue ${actionLabel}?`)) return;

    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${order.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ delivery_status: 'delivered' }),
      });
      if (res.ok) {
        showAlert?.(`✓ Pedido #${order.order_number} marcado como entregado.`);
        fetchOrders();
      } else {
        showAlert?.('Error al actualizar estado de entrega.');
      }
    } catch {
      showAlert?.('Error de red.');
    }
  };

  // Guardar edición
  const handleSaveEdit = async () => {
    if (!orderToEdit) return;
    setProcessing(true);
    const token = getToken();
    const paid = parseFloat(editPaidAmount) || 0;
    const total = parseFloat(orderToEdit.total) || 0;
    const pStatus = paid >= total ? 'full' : (paid > 0 ? 'partial' : 'pending');

    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToEdit.order_number}/status`, {
        method: 'PATCH',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          delivery_status: editDeliveryStatus,
          payment_status: pStatus,
          payment_type: editPaymentType,
          installments_count: editInstallmentsCount,
          paid_amount: paid,
          admin_notes: editNotes
        })
      });
      if (res.ok) {
        showAlert?.(`✓ Pedido ${orderToEdit.order_number} actualizado.`);
        setOrderToEdit(null);
        fetchOrders();
      } else {
        showAlert?.('Error al actualizar.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Eliminar pedido
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setProcessing(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${orderToDelete.order_number}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': token }
      });
      if (res.ok) {
        showAlert?.(`✓ Pedido ${orderToDelete.order_number} eliminado correctamente.`);
        setOrderToDelete(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        showAlert?.(err.detail || 'Error al eliminar el pedido.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Restaurar pedido rechazado a "En Revisión"
  const handleRestoreToReview = async (order: any) => {
    setProcessing(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/orders/admin/${order.order_number}/status`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'En revisión', delivery_status: 'pending' })
      });
      if (res.ok) {
        showAlert?.(`✓ Pedido ${order.order_number} restaurado a "En Revisión" correctamente.`);
        fetchOrders();
      } else {
        showAlert?.('Error al restaurar el pedido.');
      }
    } catch {
      showAlert?.('Error de red.');
    } finally {
      setProcessing(false);
    }
  };

  // Meses disponibles para tabs históricas (calculados dinámicamente desde los datos)
  const availableMonths = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthSet = new Set<string>();
    webOrders.forEach(o => {
      try {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key !== currentKey) monthSet.add(key);
      } catch { /* skip */ }
    });
    return Array.from(monthSet).sort().reverse();
  }, [webOrders]);



  // Tabs históricas (aplica filtro de mes)
  const HISTORICAL_TABS = ['shipped', 'delivered', 'rejected', 'all'];
  const isHistoricalTab = HISTORICAL_TABS.includes(activeTab);

  // Filtrado de pedidos
  const filteredOrders = webOrders.filter(o => {
    const term = searchTerm.toLowerCase();
    const name = (o.customer?.name || '').toLowerCase();
    const phone = (o.customer?.phone || '').toLowerCase();
    const num = (o.order_number || '').toLowerCase();
    const matchesTerm = name.includes(term) || phone.includes(term) || num.includes(term);
    if (!matchesTerm) return false;

    const s = (o.status || '').toLowerCase();
    const d = (o.delivery_status || '').toLowerCase();
    const isPickup = (o.shipping_type || '').toLowerCase() === 'pickup';
    const isApproved = s.includes('aprob') || s.includes('pagad');

    // Filtro de tab
    let passesTab = false;
    if (activeTab === 'pending') passesTab = s.includes('revis') || s.includes('pend');
    else if (activeTab === 'to_ship') passesTab = isApproved && !isPickup && d !== 'shipped' && d !== 'delivered';
    else if (activeTab === 'pickup_pending') passesTab = isApproved && isPickup && d !== 'delivered';
    else if (activeTab === 'shipped') passesTab = d === 'shipped';
    else if (activeTab === 'delivered') passesTab = d === 'delivered' || s.includes('entreg');
    else if (activeTab === 'rejected') passesTab = s.includes('rechaz') || s.includes('cancel');
    else passesTab = true; // 'all'

    if (!passesTab) return false;

    // Filtro de mes para tabs históricas
    if (isHistoricalTab && selectedMonthKey !== 'current') {
      try {
        const d2 = new Date(o.created_at);
        const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
        if (key !== selectedMonthKey) return false;
      } catch { return false; }
    } else if (isHistoricalTab && selectedMonthKey === 'current') {
      // Mostrar solo el mes en curso
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        const d2 = new Date(o.created_at);
        const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
        if (key !== currentKey) return false;
      } catch { return false; }
    }

    return true;
  });

  const pendingCount = webOrders.filter(o => (o.status || '').toLowerCase().includes('revis')).length;
  const toShipCount = webOrders.filter(o => {
    const s = (o.status || '').toLowerCase();
    const d = (o.delivery_status || '').toLowerCase();
    const isPickup = (o.shipping_type || '').toLowerCase() === 'pickup';
    return (s.includes('aprob') || s.includes('pagad')) && !isPickup && d !== 'shipped' && d !== 'delivered';
  }).length;
  const pickupPendingCount = webOrders.filter(o => {
    const s = (o.status || '').toLowerCase();
    const d = (o.delivery_status || '').toLowerCase();
    const isPickup = (o.shipping_type || '').toLowerCase() === 'pickup';
    return (s.includes('aprob') || s.includes('pagad')) && isPickup && d !== 'delivered';
  }).length;
  const shippedCount = webOrders.filter(o => (o.delivery_status || '').toLowerCase() === 'shipped').length;

  return (
    <div className="space-y-6">
      
      {/* Header & Métricas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">language</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Pedidos de la Tienda Web</h2>
                <p className="text-xs text-slate-500">Gestión de compras realizadas online por los clientes</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Actualizar
            </button>
          </div>
        </div>

        {/* Buscador y Pestañas */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
          
          {/* Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">hourglass_empty</span>
              En Revisión
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white animate-pulse'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('to_ship')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'to_ship'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              Para Enviar
              {toShipCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'to_ship' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                }`}>
                  {toShipCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pickup_pending')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pickup_pending'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">storefront</span>
              Retiro en Local
              {pickupPendingCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pickup_pending' ? 'bg-white text-cyan-600' : 'bg-cyan-500 text-white'
                }`}>
                  {pickupPendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('shipped')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'shipped'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">outbox</span>
              Enviados
              {shippedCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'shipped' ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                }`}>
                  {shippedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('delivered')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">task_alt</span>
              Entregados
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'rejected'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-base">cancel</span>
              Rechazados
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                activeTab === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Todos ({webOrders.length})
            </button>
          </div>

          {/* Search + Month Selector (históricas) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de mes para tabs históricas */}
            {isHistoricalTab && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-slate-400 text-base">calendar_month</span>
                <select
                  value={selectedMonthKey}
                  onChange={e => setSelectedMonthKey(e.target.value)}
                  className="text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="current">Este Mes</option>
                  {availableMonths.map(key => {
                    const [y, m] = key.split('-');
                    const label = new Date(parseInt(y), parseInt(m) - 1, 1)
                      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                    return <option key={key} value={key}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                  })}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="relative min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Buscar por cliente, tel o #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {loading && webOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
            <p className="text-xs">Cargando pedidos de la tienda online...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">shopping_bag</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron pedidos web</p>
            <p className="text-xs text-slate-500 mt-1">No hay pedidos en la vista seleccionada actualmente.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const tot = parseFloat(order.total) || 0;
            const paid = parseFloat(order.paid_amount) || 0;
            const remaining = maxDebt(tot, paid);
            const statusStr = (order.status || 'En revisión').toLowerCase();
            const isApproved = statusStr.includes('aprob') || statusStr.includes('pagad');
            const isDelivered = (order.delivery_status || '').toLowerCase() === 'delivered';
            const isShipped = (order.delivery_status || '').toLowerCase() === 'shipped';
            const isPickup = (order.shipping_type || '').toLowerCase() === 'pickup';
            const isRejected = statusStr.includes('rechaz') || statusStr.includes('cancel');
            const dateStr = new Date(order.created_at).toLocaleDateString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return (
              <div 
                key={order.id || order.order_number}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Info Principal */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-primary">shopping_bag</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                          #{order.order_number}
                        </span>
                        
                        {/* Status Badge */}
                        {statusStr.includes('revis') && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            En Revisión
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Aprobado
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Rechazado
                          </span>
                        )}

                        {/* Modalidad de Pago Badge */}
                        {isApproved && (
                          order.payment_type === 'cuotas' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                              En {order.installments_count || 1} cuotas
                            </span>
                          ) : remaining > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Pago Parcial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Pago Total
                            </span>
                          )
                        )}

                        {/* Modalidad Entrega & Estado */}
                        {isRejected || (order.delivery_status || '').toLowerCase() === 'cancelled' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
                            <span className="material-symbols-outlined text-xs">block</span>
                            {isPickup ? 'Retiro Cancelado' : 'Envío Cancelado'}
                          </span>
                        ) : isPickup ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            isDelivered 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                              : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300'
                          }`}>
                            <span className="material-symbols-outlined text-xs">storefront</span>
                            {isDelivered ? '✓ Retirado en Local' : 'Espera Retiro en Local'}
                          </span>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            isDelivered 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                              : isShipped
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
                          }`}>
                            <span className="material-symbols-outlined text-xs">local_shipping</span>
                            {isDelivered ? '✓ Entregado a Domicilio' : isShipped ? '✈️ Despachado / Enviado' : '📦 Pendiente de Envío'}
                          </span>
                        )}

                        {order.shipping_tracking_number && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" title="Número de Seguimiento">
                            Guía: {order.shipping_tracking_number}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {order.customer?.name || 'Cliente'}
                        </span>
                        {Boolean(order.customer?.is_special_wholesale || order.customer?.customer_type === 'special_wholesale') ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1 border border-amber-300 dark:border-amber-700/60 shadow-xs">
                            <span>👑</span> Mayorista Especial
                          </span>
                        ) : Boolean(order.customer?.is_wholesale || order.customer?.customer_type === 'wholesale') ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center gap-1">
                            Mayorista
                          </span>
                        ) : null}
                        <span>Tel: {order.customer?.phone || 'S/D'}</span>
                        <span>{dateStr}</span>
                        <span>{order.items?.length || 0} productos</span>
                      </div>

                      {order.admin_notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                          Nota: {order.admin_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Precios y Deuda */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-700">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pedido</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">${tot.toLocaleString('es-AR')}</p>
                      {isRejected ? (
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          Pedido Cancelado
                        </p>
                      ) : remaining > 0 ? (
                        <p className="text-xs font-bold text-red-500 mt-0.5">
                          Adeuda: ${remaining.toLocaleString('es-AR')}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Saldado 100%
                        </p>
                      )}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-1.5">
                      
                      {/* Botón Ver Detalle */}
                      <button
                        onClick={() => setOrderDetail(order)}
                        title="Ver detalle del pedido"
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>

                      {/* Botón Editar Pedido (Productos y Envío) */}
                      {canManagePayments && (
                        <button
                          onClick={() => openOrderEditor(order)}
                          title="Modificar productos, cantidades, precios o método de envío"
                          className="px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">edit_note</span>
                          <span>Editar</span>
                        </button>
                      )}

                      {/* Botones si está En Revisión (solo Super Admin y Admin pueden aprobar/rechazar) */}
                      {statusStr.includes('revis') && canManagePayments && (
                        <>
                          <button
                            onClick={() => openApproveModal(order)}
                            className="px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-green-500/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            Aprobar
                          </button>

                          <button
                            onClick={() => setOrderToReject(order)}
                            className="p-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Rechazar pedido"
                          >
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </>
                      )}

                      {/* Botones de Envío / Entrega si está Aprobado */}
                      {isApproved && (
                        <>
                          {/* Despachar a domicilio si está pendiente (Super Admin, Admin y Empleado) */}
                          {!isPickup && !isShipped && !isDelivered && canManageShipping && (
                            <button
                              onClick={() => {
                                setOrderToShip(order);
                                setShippingTracking(order.shipping_tracking_number || '');
                                setShippingInvoiceFile(null);
                              }}
                              className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-orange-500/20 transition-all"
                              title="Despachar pedido y adjuntar factura"
                            >
                              <span className="material-symbols-outlined text-sm">local_shipping</span>
                              Despachar
                            </button>
                          )}

                          {/* Marcar Retirado si es retiro en local */}
                          {isPickup && !isDelivered && canManageShipping && (
                            <button
                              onClick={() => handleMarkDelivered(order)}
                              className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-cyan-600/20 transition-all"
                              title="Marcar como retirado por el cliente"
                            >
                              <span className="material-symbols-outlined text-sm">storefront</span>
                              Retirado
                            </button>
                          )}

                          {/* Marcar Entregado si ya fue despachado a domicilio */}
                          {!isPickup && isShipped && !isDelivered && canManageShipping && (
                            <button
                              onClick={() => handleMarkDelivered(order)}
                              className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all"
                              title="Marcar como entregado a destino"
                            >
                              <span className="material-symbols-outlined text-sm">task_alt</span>
                              Entregado
                            </button>
                          )}

                          {/* Factura adjunta si existe */}
                          {order.shipping_invoice_url && (
                            <a
                              href={order.shipping_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver Factura o Remito Adjunto"
                              className="p-2 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg">receipt_long</span>
                            </a>
                          )}

                          {/* Botón Editar cobro o entrega (Solo Super Admin y Admin) */}
                          {canManagePayments && (
                            <button
                              onClick={() => {
                                setOrderToEdit(order);
                                setEditPaidAmount(order.paid_amount?.toString() || '0');
                                setEditPaymentStatus(order.payment_status || 'full');
                                setEditPaymentType(order.payment_type || 'total');
                                setEditInstallmentsCount(order.installments_count || 1);
                                setEditDeliveryStatus(order.delivery_status || 'pending');
                                setEditNotes(order.admin_notes || '');
                              }}
                              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Modificar cobro o entrega"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Botón Restaurar a Revisión — solo para pedidos rechazados (Admin / Super Admin) */}
                      {isRejected && canManagePayments && (
                        <button
                          onClick={() => handleRestoreToReview(order)}
                          disabled={processing}
                          className="p-2 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                          title="Volver a poner En Revisión"
                        >
                          <span className="material-symbols-outlined text-lg">undo</span>
                        </button>
                      )}

                      {/* Botón Eliminar — solo visible para super_admin en pedidos NO en revisión */}
                      {!statusStr.includes('revis') && currentAdminRole === 'super_admin' && (
                        <button
                          onClick={() => setOrderToDelete(order)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                          title="Eliminar pedido permanentemente"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}

                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Aprobar Pedido (Total / Parcial / Cuotas) */}
      {orderToApprove && (() => {
        const isSpecialWholesale = Boolean(
          orderToApprove.customer?.is_special_wholesale ||
          orderToApprove.customer?.customer_type === 'special_wholesale'
        );
        const approvalItemsSum = approvalItems.reduce((acc: number, it: any) => acc + ((Number(it.quantity) || 1) * (Number(it.price) || 0)), 0);
        const approvalShippingCost = orderToApprove.shipping_type === 'pickup' ? 0 : (Number(orderToApprove.shipping_cost) || 0);
        const approvalCalculatedTotal = approvalItemsSum + approvalShippingCost;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-500">check_circle</span>
                  Aprobar Pedido #{orderToApprove.order_number}
                </h3>
                <button onClick={() => setOrderToApprove(null)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Datos del comprador */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl mb-4 text-xs space-y-2 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-slate-400">Cliente</p>
                      {isSpecialWholesale && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          👑 Mayorista Especial
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{orderToApprove.customer?.name}</p>
                    <p className="text-slate-500">{orderToApprove.customer?.phone} · {orderToApprove.customer?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 mb-0.5">Entrega</p>
                    <p className="font-bold text-slate-800 dark:text-white">
                      {orderToApprove.shipping_type === 'pickup' ? '🏪 Retiro en Local' : orderToApprove.shipping_type === 'national' ? '🚛 Envío Nacional' : '🚚 Envío Local (Formosa)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner si es Mayorista Especial */}
              {isSpecialWholesale && (
                <div className="flex items-center gap-2.5 p-3 mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200">
                  <span className="text-xl shrink-0">👑</span>
                  <div>
                    <p className="font-extrabold text-amber-900 dark:text-amber-100">Cliente Mayorista Especial</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Podés modificar los precios unitarios directamente en la tabla antes de aprobar para aplicar el descuento correspondiente.
                    </p>
                  </div>
                </div>
              )}

              {/* Detalle y Productos del pedido */}
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Productos del Pedido ({approvalItems.length})
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const ord = orderToApprove;
                    setOrderToApprove(null);
                    openOrderEditor(ord);
                  }}
                  className="text-primary hover:underline font-bold flex items-center gap-1 text-[11px]"
                  title="Sumar o quitar productos, o cambiar método de envío"
                >
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Modificar productos o envío
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 mb-4 max-h-48 overflow-y-auto">
                {approvalItems.map((item: any, i: number) => {
                  const qty = Number(item.quantity) || 1;
                  const price = Number(item.price) || 0;
                  const lineTotal = qty * price;

                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                          <span className="material-symbols-outlined text-sm">inventory_2</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate">{item.product_name}</p>
                        {item.variant_info && <p className="text-slate-400 truncate text-[11px]">{item.variant_info}</p>}
                      </div>

                      {isSpecialWholesale ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-700 dark:text-slate-300">x{qty}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.price}
                              onChange={(e) => handleApprovalItemPriceChange(i, e.target.value)}
                              title="Modificar precio unitario para este cliente especial"
                              className="w-20 px-2 py-1 text-right font-black rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-amber-500 text-xs"
                            />
                          </div>
                          <span className="font-black text-slate-800 dark:text-white min-w-[65px] text-right">
                            ${lineTotal.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right shrink-0">
                          <p className="font-bold text-slate-700 dark:text-slate-200">x{qty}</p>
                          <p className="text-slate-500 font-bold">${price.toLocaleString('es-AR')}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 rounded-xl px-4 py-2.5 mb-4">
                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">Total a Cobrar</span>
                  {orderToApprove.shipping_type !== 'pickup' && Number(orderToApprove.shipping_cost) > 0 && (
                    <span className="text-[10px] text-slate-400">
                      (Incluye envío: ${Number(orderToApprove.shipping_cost).toLocaleString('es-AR')})
                    </span>
                  )}
                </div>
                <span className="font-black text-primary text-xl">${approvalCalculatedTotal.toLocaleString('es-AR')}</span>
              </div>

              {/* Modalidad de Cobro */}
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Modalidad de Cobro</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setApprovalPaymentType('total');
                    setApprovalPaidAmount(approvalCalculatedTotal.toString());
                  }}
                  className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                    approvalPaymentType === 'total'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Pago Total
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApprovalPaymentType('partial');
                    setApprovalPaidAmount('');
                  }}
                  className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                    approvalPaymentType === 'partial'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Pago Parcial
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApprovalPaymentType('cuotas');
                    setApprovalPaidAmount('0');
                  }}
                  className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                    approvalPaymentType === 'cuotas'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  En Cuotas
                </button>
              </div>

              {approvalPaymentType === 'partial' && (
                <div className="space-y-2 mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40 text-xs">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">¿Cuánto abonó el cliente hoy? ($):</label>
                  <input
                    type="number"
                    value={approvalPaidAmount}
                    onChange={(e) => setApprovalPaidAmount(e.target.value)}
                    placeholder="Monto abonado"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold"
                  />
                  <div className="flex justify-between text-xs pt-1 font-bold">
                    <span>Resta por cobrar:</span>
                    <span className="text-red-500 font-black">
                      ${Math.max(0, approvalCalculatedTotal - (parseFloat(approvalPaidAmount) || 0)).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              )}

              {approvalPaymentType === 'cuotas' && (
                <div className="space-y-3 mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800/40 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad de Cuotas:</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[2, 3, 6, 12].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setApprovalInstallments(n)}
                          className={`py-1.5 font-bold rounded-lg border ${
                            approvalInstallments === n ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {n} cuotas
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Entrega inicial hoy ($):</label>
                    <input
                      type="number"
                      value={approvalPaidAmount}
                      onChange={(e) => setApprovalPaidAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold"
                    />
                  </div>

                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-indigo-200">
                    <span>Adeuda a financiar:</span>
                    <span className="text-indigo-700 dark:text-indigo-300">
                      ${Math.max(0, approvalCalculatedTotal - (parseFloat(approvalPaidAmount) || 0)).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notas administrativas (opcional):</label>
                <input
                  type="text"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Observación interna..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderToApprove(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={processing}
                  className="flex-[2] py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-black flex items-center justify-center gap-1 shadow-md shadow-green-500/20"
                >
                  <span className="material-symbols-outlined text-base">verified</span>
                  Confirmar Aprobación
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: Rechazar Pedido — con detalle completo */}
      {orderToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            {/* Encabezado */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-500">
                  <span className="material-symbols-outlined text-xl">cancel</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Rechazar Pedido #{orderToReject.order_number}</h3>
                  <p className="text-xs text-slate-500">El pedido pasará a estado Rechazado</p>
                </div>
              </div>
              <button onClick={() => setOrderToReject(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Datos del comprador */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl mb-4 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-slate-800 dark:text-white text-sm">{orderToReject.customer?.name || 'Cliente'}</p>
              <p className="text-slate-500">
                📞 {orderToReject.customer?.phone || 'Sin teléfono'}
                {orderToReject.customer?.email && ` · ${orderToReject.customer.email}`}
              </p>
              <p className="text-slate-500">
                {orderToReject.shipping_type === 'pickup' ? '🏪 Retiro en Local' : orderToReject.shipping_type === 'national' ? '🚛 Envío Nacional' : '🚚 Envío Local (Formosa)'}
              </p>
            </div>

            {/* Productos */}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Productos del Pedido</p>
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 mb-4 max-h-36 overflow-y-auto">
              {orderToReject.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.product_name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white truncate">{item.product_name}</p>
                    {item.variant_info && <p className="text-slate-400 truncate">{item.variant_info}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200">x{item.quantity}</p>
                    <p className="text-slate-500">${(parseFloat(item.price) || 0).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total + Nota informativa */}
            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-4 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">Total del Pedido</span>
              <span className="font-black text-slate-900 dark:text-white text-base">${parseFloat(orderToReject.total || 0).toLocaleString('es-AR')}</span>
            </div>

            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 mb-5 text-xs">
              <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">info</span>
              <p className="text-amber-700 dark:text-amber-300">
                El pedido quedará visible en la pestaña <strong>Rechazados</strong>. El cliente podrá ver el estado desde su perfil.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderToReject(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={processing}
                className="flex-[2] py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 disabled:opacity-60"
              >
                {processing ? <span className="material-symbols-outlined text-base animate-spin">refresh</span> : <span className="material-symbols-outlined text-base">cancel</span>}
                Rechazar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Eliminar Pedido — con detalle completo + advertencia fuerte */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 dark:border-red-900/60 max-h-[90vh] overflow-y-auto">
            {/* Encabezado */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600">
                  <span className="material-symbols-outlined text-xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Eliminar Pedido #{orderToDelete.order_number}</h3>
                  <p className="text-xs text-red-500 font-bold">⚠ Acción permanente e irreversible</p>
                </div>
              </div>
              <button onClick={() => setOrderToDelete(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Datos del comprador */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl mb-4 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-slate-800 dark:text-white text-sm">{orderToDelete.customer?.name || 'Cliente'}</p>
              <p className="text-slate-500">
                📞 {orderToDelete.customer?.phone || 'Sin teléfono'}
                {orderToDelete.customer?.email && ` · ${orderToDelete.customer.email}`}
              </p>
            </div>

            {/* Productos */}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Productos incluidos</p>
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 mb-4 max-h-36 overflow-y-auto">
              {orderToDelete.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.product_name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white truncate">{item.product_name}</p>
                    {item.variant_info && <p className="text-slate-400 truncate">{item.variant_info}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200">x{item.quantity}</p>
                    <p className="text-slate-500">${(parseFloat(item.price) || 0).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-4 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">Total del Pedido</span>
              <span className="font-black text-slate-900 dark:text-white text-base">${parseFloat(orderToDelete.total || 0).toLocaleString('es-AR')}</span>
            </div>

            {/* Advertencia */}
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-3 mb-5 text-xs">
              <span className="material-symbols-outlined text-red-500 text-base shrink-0 mt-0.5">warning</span>
              <p className="text-red-700 dark:text-red-300">
                Este pedido será <strong>borrado definitivamente</strong> de la base de datos. No quedará registro alguno y el cliente no podrá verlo desde su cuenta. Esta acción <strong>no se puede deshacer</strong>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={processing}
                className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 disabled:opacity-60"
              >
                {processing ? <span className="material-symbols-outlined text-base animate-spin">refresh</span> : <span className="material-symbols-outlined text-base">delete_forever</span>}
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Despachar / Enviar Pedido */}
      {orderToShip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <span className="material-symbols-outlined text-xl">local_shipping</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Despachar Pedido #{orderToShip.order_number}
                  </h3>
                  <p className="text-xs text-slate-500">Registrar número de seguimiento y factura/remito</p>
                </div>
              </div>
              <button onClick={() => setOrderToShip(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Datos del Comprador */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl mb-5 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
              <p className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[10px] text-primary">
                Datos de Entrega del Comprador
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-400">Cliente:</p>
                  <p className="font-bold text-slate-800 dark:text-white">{orderToShip.customer?.name || 'Cliente'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Teléfono:</p>
                  <p className="font-bold text-slate-800 dark:text-white">{orderToShip.customer?.phone || 'Sin teléfono'}</p>
                </div>
              </div>
              <div>
                <p className="text-slate-400">Dirección de Destino:</p>
                <p className="font-bold text-slate-800 dark:text-white">
                  {orderToShip.customer?.address
                    ? `${orderToShip.customer.address}, ${orderToShip.customer.city || ''}, ${orderToShip.customer.province || ''} (CP: ${orderToShip.customer.postal_code || '-'})`
                    : 'Sin dirección registrada en el perfil del cliente.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmShip} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Número de Seguimiento / Guía de Transporte (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: OCA-987654321, Correo Argentino..."
                  value={shippingTracking}
                  onChange={(e) => setShippingTracking(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Adjuntar Factura o Remito (PDF o Imagen, Opcional):
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setShippingInvoiceFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
                />
                {orderToShip.shipping_invoice_url && !shippingInvoiceFile && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ya tiene una factura adjunta:{' '}
                    <a href={orderToShip.shipping_invoice_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      Ver archivo actual
                    </a>
                  </p>
                )}
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderToShip(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={shippingSubmitting}
                  className="flex-[2] py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    {shippingSubmitting ? 'sync' : 'local_shipping'}
                  </span>
                  {shippingSubmitting ? 'Guardando despacho...' : 'Confirmar Envío'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detalle del Pedido */}
      {orderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Pedido #{orderDetail.order_number}</h3>
                  {Boolean(orderDetail.customer?.is_special_wholesale || orderDetail.customer?.customer_type === 'special_wholesale') ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                      👑 Mayorista Especial
                    </span>
                  ) : Boolean(orderDetail.customer?.is_wholesale || orderDetail.customer?.customer_type === 'wholesale') ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                      Mayorista
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">{orderDetail.customer?.name} ({orderDetail.customer?.phone})</p>
              </div>
              <div className="flex items-center gap-2">
                {canManagePayments && (
                  <button
                    onClick={() => {
                      const ord = orderDetail;
                      setOrderDetail(null);
                      openOrderEditor(ord);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Modificar productos, cantidades, precios o método de envío"
                  >
                    <span className="material-symbols-outlined text-base">edit_note</span>
                    Editar Pedido
                  </button>
                )}
                <button onClick={() => setOrderDetail(null)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Datos de Entrega */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl mb-4 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Modalidad:</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {orderDetail.shipping_type === 'pickup' ? '🏪 Retiro en Local' : orderDetail.shipping_type === 'national' ? '🚛 Envío Nacional (a cotizar)' : '🚚 Envío Local (Formosa Capital)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Estado de Entrega:</span>
                <span className={`font-bold ${
                  (orderDetail.status || '').toLowerCase().includes('rechaz') || (orderDetail.delivery_status || '').toLowerCase() === 'cancelled'
                    ? 'text-slate-500'
                    : orderDetail.delivery_status === 'delivered'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : orderDetail.delivery_status === 'shipped'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {(orderDetail.status || '').toLowerCase().includes('rechaz') || (orderDetail.delivery_status || '').toLowerCase() === 'cancelled'
                    ? 'Cancelado'
                    : orderDetail.delivery_status === 'delivered'
                    ? (orderDetail.shipping_type === 'pickup' ? '✓ Retirado' : '✓ Entregado')
                    : orderDetail.delivery_status === 'shipped'
                    ? '✈️ Despachado / Enviado'
                    : (orderDetail.shipping_type === 'pickup' ? '📦 Espera Retiro' : orderDetail.shipping_type === 'national' ? '🚛 Pendiente Env. Nacional' : '📦 Pendiente de Despacho')}
                </span>
              </div>
              {orderDetail.customer?.address && (
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-500">Dirección:</span>
                  <span className="text-right text-slate-800 dark:text-white">
                    {orderDetail.customer.address}, {orderDetail.customer.city}, {orderDetail.customer.province} (CP: {orderDetail.customer.postal_code})
                  </span>
                </div>
              )}
              {orderDetail.shipping_tracking_number && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Guía / Seguimiento:</span>
                  <span className="font-mono font-bold text-primary">{orderDetail.shipping_tracking_number}</span>
                </div>
              )}
              {orderDetail.shipping_invoice_url && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-500">Factura Adjunta:</span>
                  <a
                    href={orderDetail.shipping_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-bold underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">receipt_long</span>
                    Ver documento
                  </a>
                </div>
              )}
            </div>

            {/* Lista de Items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 mb-5">
              {orderDetail.items?.map((item: any, i: number) => (
                <div key={i} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{item.product_name || 'Producto'}</p>
                    <p className="text-slate-500">{item.variant_info || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-white">{item.quantity} x ${parseFloat(item.price || 0).toLocaleString('es-AR')}</p>
                    <p className="text-slate-500 font-black">${(item.quantity * parseFloat(item.price || 0)).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl flex justify-between items-center text-sm font-bold mb-4">
              <span>Total:</span>
              <span className="text-xl font-black text-primary">${parseFloat(orderDetail.total || 0).toLocaleString('es-AR')}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderDetail(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
              {canManagePayments && (
                <button
                  onClick={() => {
                    const ord = orderDetail;
                    setOrderDetail(null);
                    openOrderEditor(ord);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <span className="material-symbols-outlined text-base">edit_note</span>
                  Modificar Productos / Envío
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Estado de Cobro y Entrega */}
      {orderToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Modificar Pedido #{orderToEdit.order_number}</h3>
              <button onClick={() => setOrderToEdit(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs mb-5">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estado de Entrega:</label>
                <select
                  value={editDeliveryStatus}
                  onChange={(e: any) => setEditDeliveryStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="pending">Pendiente de entrega</option>
                  <option value="delivered">Entregado al cliente</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Modalidad de Pago:</label>
                <select
                  value={editPaymentType}
                  onChange={(e: any) => setEditPaymentType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="total">Pago Total (100%)</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="cuotas">En Cuotas</option>
                </select>
              </div>

              {editPaymentType === 'cuotas' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad de Cuotas:</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={editInstallmentsCount}
                    onChange={(e) => setEditInstallmentsCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Cobrado Hasta Hoy ($):</label>
                <input
                  type="number"
                  value={editPaidAmount}
                  onChange={(e) => setEditPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Total del pedido: ${parseFloat(orderToEdit.total || 0).toLocaleString('es-AR')}. 
                  Adeuda: ${Math.max(0, parseFloat(orderToEdit.total || 0) - (parseFloat(editPaidAmount) || 0)).toLocaleString('es-AR')}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notas Administrativas:</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOrderToEdit(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Modificar Pedido Completo (Productos, Precios, Cantidades y Envío) */}
      {orderToEditProducts && (() => {
        const isSpecialWholesale = Boolean(
          orderToEditProducts.customer?.is_special_wholesale ||
          orderToEditProducts.customer?.customer_type === 'special_wholesale'
        );
        const isWholesale = Boolean(
          orderToEditProducts.customer?.is_wholesale ||
          orderToEditProducts.customer?.customer_type === 'wholesale'
        );

        const itemsTotal = editOrderItems.reduce((sum: number, it: any) => {
          return sum + ((Number(it.quantity) || 1) * (Number(it.price) || 0));
        }, 0);
        const effShippingCost = editOrderShippingType === 'pickup' ? 0 : Math.max(0, parseFloat(editOrderShippingCost) || 0);
        const grandTotal = itemsTotal + effShippingCost;

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
                        Modificar Pedido #{orderToEditProducts.order_number}
                      </h3>
                      {isSpecialWholesale ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          👑 Mayorista Especial
                        </span>
                      ) : isWholesale ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                          Mayorista
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          Minorista
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Cliente: <strong>{orderToEditProducts.customer?.name}</strong> · Tel: {orderToEditProducts.customer?.phone || 'S/D'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOrderToEditProducts(null)}
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
                      onClick={() => setEditOrderShippingType('pickup')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editOrderShippingType === 'pickup'
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
                      onClick={() => setEditOrderShippingType('delivery')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editOrderShippingType === 'delivery'
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
                      onClick={() => setEditOrderShippingType('national')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editOrderShippingType === 'national'
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

                  {editOrderShippingType !== 'pickup' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <label className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        Costo de Envío a cobrar ($):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editOrderShippingCost}
                        onChange={(e) => setEditOrderShippingCost(e.target.value)}
                        placeholder="0"
                        className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-black text-slate-800 dark:text-white"
                      />
                      <span className="text-[11px] text-slate-400">
                        {editOrderShippingType === 'national' ? 'Costo acordado para despacho nacional' : 'Costo del cadete local'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Productos del Pedido */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        2. Productos del Pedido ({editOrderItems.length})
                      </p>
                      {isSpecialWholesale && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                          <span>👑</span> Precios especiales habilitados para este cliente
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

                  {editOrderItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                      <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">remove_shopping_cart</span>
                      <p>El pedido no tiene productos. Usá el botón de arriba para agregar uno.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {editOrderItems.map((item: any, i: number) => {
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
                                    onChange={(e) => handleEditItemPrice(i, e.target.value)}
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
                                    onClick={() => handleEditItemQty(i, -1)}
                                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 font-bold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleEditItemQtyDirect(i, e.target.value)}
                                    className="w-12 text-center font-bold text-xs bg-transparent outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleEditItemQty(i, 1)}
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
                                onClick={() => handleRemoveItem(i)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                title="Eliminar producto del pedido"
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
                    value={editOrderNotes}
                    onChange={(e) => setEditOrderNotes(e.target.value)}
                    placeholder="Ej: Modificado a pedido del cliente por WhatsApp..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                  />
                </div>

                {/* Resumen de Totales */}
                <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Subtotal Productos ({editOrderItems.length}):</span>
                    <span className="font-bold">${itemsTotal.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Costo de Envío ({editOrderShippingType === 'pickup' ? 'Retiro en local' : editOrderShippingType === 'national' ? 'Envío nacional' : 'Envío local'}):</span>
                    <span className="font-bold">${effShippingCost.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                    <span className="font-extrabold text-slate-900 dark:text-white">Total del Pedido Actualizado:</span>
                    <span className="font-black text-primary text-lg">${grandTotal.toLocaleString('es-AR')}</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setOrderToEditProducts(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrderEdits}
                  disabled={savingOrderEdit || editOrderItems.length === 0}
                  className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">
                    {savingOrderEdit ? 'sync' : 'save'}
                  </span>
                  {savingOrderEdit ? 'Guardando cambios...' : 'Guardar Modificaciones del Pedido'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: Seleccionar e Incorporar Producto al Pedido */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_shopping_cart</span>
                Agregar Producto al Pedido
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
                          orderToEditProducts?.customer?.is_special_wholesale ||
                          orderToEditProducts?.customer?.customer_type === 'special_wholesale'
                        );
                        const isWholesale = Boolean(
                          orderToEditProducts?.customer?.is_wholesale ||
                          orderToEditProducts?.customer?.customer_type === 'wholesale'
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
                          Boolean(orderToEditProducts?.customer?.is_special_wholesale || orderToEditProducts?.customer?.customer_type === 'special_wholesale')
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  {Boolean(orderToEditProducts?.customer?.is_special_wholesale || orderToEditProducts?.customer?.customer_type === 'special_wholesale') && (
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
                      Incorporar al Pedido
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

function maxDebt(total: number, paid: number): number {
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}
