'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export interface EditarCompraData {
  /** 'web' = pedido online | 'mostrador' = venta de caja */
  source: 'web' | 'mostrador';
  reference: string;        // order_number o ticketId
  fecha: string;            // ISO date string
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientType: 'normal' | 'wholesale' | 'special_wholesale';
  isSpecialWholesale?: boolean;
  items: EditarCompraItem[];
  shippingType: 'pickup' | 'delivery' | 'national';
  shippingCost: number;
  total: number;
  paidAmount: number;
  notes?: string;
  customer?: any;
}

export interface EditarCompraItem {
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_info: string;
  quantity: number;
  price: number;
  image_url?: string | null;
}

interface EditarCompraViewProps {
  data: EditarCompraData;
  apiKey?: string;
  showAlert?: (msg: string) => void;
  onSaved: (updatedData?: Partial<EditarCompraData>) => void;
  onCancel: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-AR');

const fmtDate = (iso?: string) => {
  if (!iso) return 'Sin fecha';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function EditarCompraView({
  data,
  apiKey,
  showAlert,
  onSaved,
  onCancel,
}: EditarCompraViewProps) {

  const storeProducts = useStockFlowStore(s => s.products) || [];
  const updateSaleTicketItems = useStockFlowStore(s => s.updateSaleTicketItems);
  const updateMostradorClientType = useStockFlowStore(s => s.updateMostradorClientType);

  const getToken = () =>
    apiKey || (typeof window !== 'undefined' ? localStorage.getItem('lyg_api_key') ?? '' : '');

  // ── Tipo de cliente interactivo ───────────────────────────────────────────
  const initialType: 'normal' | 'wholesale' | 'special_wholesale' =
    data.isSpecialWholesale ||
    data.clientType === 'special_wholesale' ||
    data.customer?.is_special_wholesale ||
    data.customer?.customer_type === 'special_wholesale'
      ? 'special_wholesale'
      : data.clientType === 'wholesale' ||
        data.customer?.is_wholesale ||
        data.customer?.customer_type === 'wholesale'
      ? 'wholesale'
      : 'normal';

  const [clientType, setClientType] = useState<'normal' | 'wholesale' | 'special_wholesale'>(initialType);
  const [dbCustomer, setDbCustomer] = useState<any>(data.customer || null);

  // ── Estado: datos del cliente (editables con botón) ───────────────────────
  const [editingClient, setEditingClient] = useState(false);
  const [clientName, setClientName] = useState(data.clientName);
  const [clientPhone, setClientPhone] = useState(data.clientPhone || '');
  const [clientEmail, setClientEmail] = useState(data.clientEmail || '');

  // Auto-detectar si el cliente está registrado en la base de datos como mayorista
  useEffect(() => {
    const cleanDigits = (p?: string) => (p || '').replace(/\D/g, '');
    const lookup = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/admin/users`, {
          headers: { 'X-API-KEY': token },
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const targetPhone = cleanDigits(clientPhone);
            const targetEmail = (clientEmail || '').trim().toLowerCase();
            const found = list.find((c: any) => {
              if (targetPhone && c.phone) {
                const cp = cleanDigits(c.phone);
                if (cp === targetPhone || (targetPhone.length >= 8 && cp.length >= 8 && targetPhone.slice(-8) === cp.slice(-8))) return true;
              }
              if (targetEmail && c.email && c.email.toLowerCase() === targetEmail) return true;
              return false;
            });

            if (found) {
              setDbCustomer(found);
              const isSpec = Boolean(found.is_special_wholesale || found.customer_type === 'special_wholesale');
              const isWhol = Boolean(found.is_wholesale || found.customer_type === 'wholesale');
              if (isSpec) {
                setClientType('special_wholesale');
              } else if (isWhol && clientType === 'normal') {
                setClientType('wholesale');
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching customers in EditarCompraView:', err);
      }
    };
    lookup();
  }, [clientPhone, clientEmail]);

  // ── Reglas de precios dinámicas ────────────────────────────────────────────
  const isSpecialWholesale = clientType === 'special_wholesale';
  const isWholesale = clientType === 'wholesale';
  const canEditPrices = isSpecialWholesale;

  const handleClientTypeChange = (newType: 'normal' | 'wholesale' | 'special_wholesale') => {
    setClientType(newType);
    if (newType !== 'special_wholesale') {
      // Si cambia a normal o mayorista, ajustar los precios a los de lista
      setItems(prevItems => prevItems.map(item => {
        const prod = storeProducts.find(p => p.id === item.product_id);
        const variant = prod?.variants.find(v => v.id === item.variant_id);
        const listPrice = newType === 'wholesale'
          ? (variant?.manualWholesalePrice || prod?.wholesalePrice || variant?.manualSalePrice || prod?.salePrice || item.price)
          : (variant?.manualSalePrice || prod?.salePrice || item.price);
        return {
          ...item,
          price: Number(listPrice || item.price),
        };
      }));
    }
  };

  // ── Estado: items del carrito ─────────────────────────────────────────────
  const [items, setItems] = useState<EditarCompraItem[]>(() =>
    (data.items || []).map(it => ({
      product_id: it.product_id,
      variant_id: it.variant_id,
      product_name: it.product_name || 'Producto',
      variant_info: it.variant_info || '',
      quantity: Math.max(1, Number(it.quantity) || 1),
      price: Math.max(0, Number(it.price) || 0),
      image_url: it.image_url || null,
    }))
  );

  // ── Estado: envío ─────────────────────────────────────────────────────────
  const [shippingType, setShippingType] = useState<'pickup' | 'delivery' | 'national'>(
    (data.shippingType as any) || 'pickup'
  );
  const [shippingCostInput, setShippingCostInput] = useState(
    String(Number(data.shippingCost || 0))
  );

  // ── Estado: notas ─────────────────────────────────────────────────────────
  const [notes, setNotes] = useState(data.notes || '');

  // ── Estado: añadir producto ───────────────────────────────────────────────
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState('');

  // ── Estado: guardado ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Totales calculados
  // ─────────────────────────────────────────────────────────────────────────
  const effShippingCost = shippingType === 'pickup'
    ? 0
    : Math.max(0, parseFloat(shippingCostInput) || 0);

  const subtotal = useMemo(() =>
    items.reduce((s, it) => s + it.price * it.quantity, 0),
    [items]
  );

  const newTotal = subtotal + effShippingCost;
  const paidSoFar = Number(data.paidAmount || 0);
  const newBalance = Math.max(0, newTotal - paidSoFar);

  // ─────────────────────────────────────────────────────────────────────────
  // Búsqueda de productos para añadir
  // ─────────────────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return storeProducts.slice(0, 15);
    const q = productSearch.toLowerCase();
    return storeProducts
      .filter((p: any) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.categoryId || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [storeProducts, productSearch]);

  const getDefaultPrice = useCallback((p: any, v: any) => {
    if (isSpecialWholesale)
      return v?.manualWholesalePrice || p?.wholesalePrice || v?.manualSalePrice || p?.salePrice || 0;
    if (isWholesale)
      return v?.manualWholesalePrice || p?.wholesalePrice || p?.salePrice || 0;
    return v?.manualSalePrice || p?.salePrice || 0;
  }, [isSpecialWholesale, isWholesale]);

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setSelectedVariantIdx(0);
    setAddQty(1);
    const v = p.variants?.[0] || {};
    setAddPrice(String(getDefaultPrice(p, v)));
  };

  const handleVariantChange = (idx: number) => {
    setSelectedVariantIdx(idx);
    if (!selectedProduct) return;
    const v = selectedProduct.variants?.[idx] || {};
    setAddPrice(String(getDefaultPrice(selectedProduct, v)));
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    const p = selectedProduct;
    const v = p.variants?.[selectedVariantIdx] || p.variants?.[0] || {};
    const qty = Math.max(1, Number(addQty) || 1);
    const price = Math.max(0, parseFloat(addPrice) || 0);

    const parts = [v.color, v.size, v.attributeValue].filter(Boolean);
    const variantLabel = parts.length > 0 ? parts.join(' - ') : (v.description || 'Único / Estándar');

    setItems(prev => [...prev, {
      product_id: String(p.id),
      variant_id: String(v.id || 'unico'),
      product_name: p.name,
      variant_info: variantLabel,
      image_url: p.imageUrls?.[0] || v.imageUrl || null,
      quantity: qty,
      price,
    }]);

    setSelectedProduct(null);
    setProductSearch('');
    setAddQty(1);
    setAddPrice('');
    setShowAddPanel(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Editar items existentes
  // ─────────────────────────────────────────────────────────────────────────
  const handleQtyChange = (idx: number, delta: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: Math.max(1, updated[idx].quantity + delta) };
      return updated;
    });
  };

  const handleQtyDirect = (idx: number, val: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: Math.max(1, parseInt(val) || 1) };
      return updated;
    });
  };

  const handlePriceChange = (idx: number, val: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], price: Math.max(0, parseFloat(val) || 0) };
      return updated;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Guardar
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (items.length === 0) {
      showAlert?.('La compra debe tener al menos un producto.');
      return;
    }
    setSaving(true);
    try {
      if (data.source === 'web') {
        const token = getToken();
        const res = await fetch(`${API_URL}/api/orders/admin/${data.reference}`, {
          method: 'PUT',
          headers: { 'X-API-KEY': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            shipping_type: shippingType,
            shipping_cost: effShippingCost,
            admin_notes: notes,
          }),
        });
        if (res.ok) {
          showAlert?.(`✓ Pedido Web #${data.reference} actualizado correctamente.`);
          if (dbCustomer?.id && token) {
            const isWhol = clientType === 'wholesale' || clientType === 'special_wholesale';
            const isSpec = clientType === 'special_wholesale';
            fetch(`${API_URL}/api/admin/users/${dbCustomer.id}/wholesale`, {
              method: 'PATCH',
              headers: { 'X-API-KEY': token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ customer_type: clientType, is_wholesale: isWhol, is_special_wholesale: isSpec }),
            }).catch(() => null);
          }
          // Sync POS store if exists
          updateSaleTicketItems(data.reference, items.map(it => ({
            productId: it.product_id,
            variantId: it.variant_id,
            productName: it.product_name,
            variantInfo: it.variant_info,
            quantity: it.quantity,
            price: it.price,
            imageUrl: it.image_url ?? undefined,
          })), { shippingType, shippingCost: effShippingCost, adminNotes: notes });
          onSaved({ items, shippingType, shippingCost: effShippingCost, notes, total: newTotal });
        } else {
          const err = await res.json().catch(() => ({}));
          showAlert?.(err.detail || 'Error al actualizar el pedido.');
        }
      } else {
        // Mostrador → Zustand store
        const token = getToken();
        if (dbCustomer?.id && token) {
          const isWhol = clientType === 'wholesale' || clientType === 'special_wholesale';
          const isSpec = clientType === 'special_wholesale';
          fetch(`${API_URL}/api/admin/users/${dbCustomer.id}/wholesale`, {
            method: 'PATCH',
            headers: { 'X-API-KEY': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_type: clientType, is_wholesale: isWhol, is_special_wholesale: isSpec }),
          }).catch(() => null);
        }
        updateMostradorClientType(clientPhone, clientName, clientType);
        updateSaleTicketItems(data.reference, items.map(it => ({
          productId: it.product_id,
          variantId: it.variant_id,
          productName: it.product_name,
          variantInfo: it.variant_info,
          quantity: it.quantity,
          price: it.price,
          imageUrl: it.image_url ?? undefined,
        })), { shippingType, shippingCost: effShippingCost, adminNotes: notes });
        showAlert?.(`✓ Venta #${data.reference} modificada correctamente.`);
        onSaved({ items, shippingType, shippingCost: effShippingCost, notes, total: newTotal });
      }
    } catch (err: any) {
      console.error('Error al guardar edición de compra:', err);
      showAlert?.('Error al conectar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Badge de tipo de cliente
  // ─────────────────────────────────────────────────────────────────────────
  const clientTypeBadge = isSpecialWholesale
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">👑 Mayorista Especial</span>
    : isWholesale
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">🏷️ Mayorista</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">👤 Normal</span>;

  const sourceLabel = data.source === 'web'
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">🌐 Pedido Online</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">🏪 Venta de Caja</span>;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Barra superior ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium shrink-0"
            >
              ← Cancelar
            </button>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-bold text-gray-900 text-base">{data.reference}</span>
              {sourceLabel}
              {clientTypeBadge}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all"
          >
            {saving ? '⏳ Guardando...' : '✅ Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* ── Layout de dos columnas ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">

        {/* ── Columna izquierda: datos + productos ─────────────────────── */}
        <div className="flex-1 space-y-5">

          {/* Cabecera de la compra */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Compra</p>
                <h2 className="text-xl font-bold text-gray-900">{data.reference}</h2>
                <p className="text-sm text-gray-500 mt-0.5">📅 {fmtDate(data.fecha)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {sourceLabel}
                {clientTypeBadge}
                {isSpecialWholesale && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                    ✏️ Podés editar precios unitarios
                  </p>
                )}
                {!canEditPrices && (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                    🔒 Los precios no son editables para este tipo de cliente
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Datos del cliente */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">👤 Datos del Cliente</h3>
              <button
                onClick={() => setEditingClient(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all ${
                  editingClient
                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                    : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                }`}
              >
                {editingClient ? '🔒 Bloquear' : '✏️ Editar'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Nombre</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  disabled={!editingClient}
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Nombre del cliente"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Teléfono</label>
                <input
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  disabled={!editingClient}
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Teléfono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Email</label>
                <input
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  disabled={!editingClient}
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Email"
                />
              </div>
            </div>

            {/* Selector interactivo de tipo de cliente (Estilo Vender Caja) */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo de Cliente:</span>
                {dbCustomer && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    ✓ Registrado Web
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl flex-wrap">
                <button
                  type="button"
                  onClick={() => handleClientTypeChange('normal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    clientType === 'normal'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👤 Normal
                </button>
                <button
                  type="button"
                  onClick={() => handleClientTypeChange('wholesale')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    clientType === 'wholesale'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  🏷️ Mayorista
                </button>
                <button
                  type="button"
                  onClick={() => handleClientTypeChange('special_wholesale')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    clientType === 'special_wholesale'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👑 Mayorista Especial (Precios Manuales)
                </button>
              </div>
            </div>

            {editingClient && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                ⚠️ Al guardar, los datos del cliente se actualizarán en esta compra.
              </p>
            )}
          </div>

          {/* Envío */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">🚚 Método de Envío</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { value: 'pickup', label: '🏪 Retiro en Local', desc: 'Sin costo' },
                { value: 'delivery', label: '📦 Envío Local Formosa', desc: 'Costo editable' },
                { value: 'national', label: '🚛 Envío Nacional', desc: 'Costo editable' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setShippingType(opt.value as any);
                    if (opt.value === 'pickup') setShippingCostInput('0');
                  }}
                  className={`flex flex-col items-start px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    shippingType === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className={`text-xs mt-0.5 ${shippingType === opt.value ? 'text-indigo-200' : 'text-gray-400'}`}>{opt.desc}</span>
                </button>
              ))}
            </div>

            {shippingType !== 'pickup' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 font-medium shrink-0">Costo de Envío ($):</label>
                <input
                  type="number"
                  min="0"
                  value={shippingCostInput}
                  onChange={e => setShippingCostInput(e.target.value)}
                  className="w-36 text-sm rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}
            {shippingType === 'pickup' && (
              <p className="text-sm text-green-700 font-medium">✓ Retiro en local — sin costo de envío</p>
            )}
          </div>

          {/* Lista de productos */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">🛒 Productos ({items.length})</h3>
              <button
                onClick={() => setShowAddPanel(v => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all"
              >
                {showAddPanel ? '✕ Cancelar' : '＋ Añadir Producto'}
              </button>
            </div>

            {/* Panel añadir producto */}
            {showAddPanel && (
              <div className="p-5 bg-blue-50 border-b border-blue-100">
                <p className="text-sm font-semibold text-blue-800 mb-3">Buscar y añadir producto al catálogo</p>

                <input
                  type="text"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setSelectedProduct(null);
                  }}
                  placeholder="Escribe para buscar un producto..."
                  className="w-full text-sm rounded-xl border border-blue-300 px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />

                {/* Lista de productos */}
                {!selectedProduct && (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-blue-200 bg-white divide-y divide-gray-100">
                    {filteredProducts.length === 0 ? (
                      <p className="text-sm text-gray-500 p-3">Sin resultados.</p>
                    ) : filteredProducts.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-800">{p.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{p.categoryId}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Detalle del producto seleccionado */}
                {selectedProduct && (
                  <div className="bg-white rounded-xl border border-blue-300 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800">{selectedProduct.name}</p>
                      <button onClick={() => setSelectedProduct(null)} className="text-xs text-gray-500 hover:text-gray-800">✕ Cambiar</button>
                    </div>

                    {/* Selector de variante */}
                    {(selectedProduct.variants || []).length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">Variante</label>
                        <select
                          value={selectedVariantIdx}
                          onChange={e => handleVariantChange(Number(e.target.value))}
                          className="w-full text-sm rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          {(selectedProduct.variants || []).map((v: any, idx: number) => {
                            const parts = [v.color, v.size, v.attributeValue].filter(Boolean);
                            const label = parts.length > 0 ? parts.join(' - ') : (v.description || 'Único / Estándar');
                            return (
                              <option key={v.id || idx} value={idx}>
                                {label} — Stock: {v.stock || 0}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">Cantidad</label>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAddQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold">-</button>
                          <input
                            type="number"
                            min="1"
                            value={addQty}
                            onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 text-center text-sm rounded-xl border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button onClick={() => setAddQty(q => q + 1)} className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">
                          Precio Unitario ($) {!canEditPrices && <span className="text-gray-400">(fijo)</span>}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={addPrice}
                          onChange={e => canEditPrices && setAddPrice(e.target.value)}
                          disabled={!canEditPrices}
                          className={`w-full text-sm rounded-xl border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                            canEditPrices
                              ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'
                              : 'border-gray-200 bg-gray-50 text-gray-700'
                          } ${!canEditPrices ? 'cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddProduct}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all"
                    >
                      🛒 Añadir al Carrito
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tabla de items */}
            {items.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <p className="text-4xl mb-2">🛒</p>
                <p className="text-sm">No hay productos. Añadí al menos uno.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                    {/* Imagen */}
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.product_name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400 text-xl">📦</div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{it.product_name}</p>
                      {it.variant_info && <p className="text-xs text-gray-500 truncate">{it.variant_info}</p>}
                    </div>

                    {/* Cantidad */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleQtyChange(idx, -1)}
                        className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-sm text-gray-700 hover:bg-gray-100 font-bold"
                      >-</button>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={e => handleQtyDirect(idx, e.target.value)}
                        className="w-12 text-center text-sm rounded-lg border border-gray-300 px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        onClick={() => handleQtyChange(idx, 1)}
                        className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-sm text-gray-700 hover:bg-gray-100 font-bold"
                      >+</button>
                    </div>

                    {/* Precio unitario */}
                    <div className="shrink-0 w-28">
                      <label className="text-xs text-gray-400 block mb-0.5">P. Unitario</label>
                      {canEditPrices ? (
                        <input
                          type="number"
                          min="0"
                          value={it.price}
                          onChange={e => handlePriceChange(idx, e.target.value)}
                          className="w-full text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-semibold px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-gray-800">{fmt(it.price)}</p>
                      )}
                    </div>

                    {/* Subtotal */}
                    <div className="shrink-0 w-24 text-right">
                      <label className="text-xs text-gray-400 block mb-0.5">Subtotal</label>
                      <p className="text-sm font-bold text-gray-800">{fmt(it.price * it.quantity)}</p>
                    </div>

                    {/* Eliminar */}
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                      title="Eliminar producto"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">📝 Notas del Administrador</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Escribí notas internas sobre esta compra..."
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>

        {/* ── Columna derecha: resumen ──────────────────────────────────── */}
        <div className="lg:w-80 xl:w-96 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-24 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">📋 Resumen</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal productos</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Envío ({shippingType === 'pickup' ? 'Retiro' : shippingType === 'delivery' ? 'Local' : 'Nacional'})</span>
                <span className="font-medium">{fmt(effShippingCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-2">
                <span>Nuevo Total</span>
                <span>{fmt(newTotal)}</span>
              </div>
            </div>

            {/* Estado de pago */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Ya abonado</span>
                <span className="font-medium text-green-700">{fmt(paidSoFar)}</span>
              </div>
              <div className={`flex justify-between font-bold text-base ${newBalance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                <span>{newBalance > 0 ? 'Saldo pendiente' : '✅ Cancelado'}</span>
                <span>{fmt(newBalance)}</span>
              </div>
            </div>

            {/* Info de tipo de cliente */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
              <p className="font-medium text-gray-700">Tipo de cliente</p>
              <div className="flex items-center gap-2 mt-1">
                {clientTypeBadge}
              </div>
              {canEditPrices && (
                <p className="text-amber-700 mt-1">✏️ Podés modificar los precios unitarios individualmente para este cliente.</p>
              )}
              {!canEditPrices && (
                <p className="text-gray-500 mt-1">🔒 Los precios son los de lista. Solo podés agregar/quitar productos y cambiar el envío.</p>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-all"
            >
              {saving ? '⏳ Guardando...' : '✅ Guardar Cambios'}
            </button>

            <button
              onClick={onCancel}
              className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

