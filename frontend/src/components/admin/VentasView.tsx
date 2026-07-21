'use client';
import { useState } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';
import { generateTicketPDF } from '@/utils/generateTicket';

export default function VentasView({ showAlert }: { showAlert: (msg: string) => void }) {
  const products = useStockFlowStore(s => s.products);
  const registerSale = useStockFlowStore(s => s.registerSale);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  
  const [selectedProductName, setSelectedProductName] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [cart, setCart] = useState<{productId: string, variantId: string, name: string, quantity: number, salePrice: number}[]>([]);

  const selectedProduct = products.find(p => p.name.toLowerCase() === selectedProductName.toLowerCase());
  
  const availableVariants = selectedProduct 
    ? selectedProduct.variants.filter(v => v.stock > 0)
    : [];

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

    setCart([...cart, {
        productId: selectedProduct.id,
        variantId: variantItem.id,
        name: displayName,
        quantity: quantityToAdd,
        salePrice: selectedProduct.salePrice
    }]);
    
    // reset selection for next item
    setSelectedVariantId('');
    setQuantityToAdd(1);
  };

  const handleCheckout = () => {
    if(cart.length === 0) return;
    if(!clientName.trim()) {
      showAlert('El nombre del cliente es obligatorio.');
      return;
    }
    if(!clientPhone.trim()) {
      showAlert('El teléfono del cliente es obligatorio.');
      return;
    }
    const ticketId = registerSale(clientName, clientPhone, cart);
    
    // Generar PDF y abrir para impresión
    generateTicketPDF(ticketId, useStockFlowStore.getState().sales, true);

    showAlert('Venta procesada con éxito. Stock descontado y finanzas actualizadas.');
    setCart([]);
    setClientName('');
    setClientPhone('');
    setSelectedProductName('');
  };

  const total = cart.reduce((acc, item) => acc + (item.quantity * item.salePrice), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Columna Izquierda: Punto de Venta */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="mb-6 border-b border-slate-100 dark:border-slate-700 pb-6">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">point_of_sale</span>
            Punto de Venta
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Vende seleccionando productos y luego sus variantes. El stock se descuenta exacto por talle y color.
          </p>
        </div>

        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cliente (Obligatorio)</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                        <input 
                            type="text" placeholder="Ej. Ana Pérez"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white font-medium"
                            value={clientName} onChange={e => setClientName(e.target.value)}
                        />
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
            </div>

            <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                
                {/* 1. Seleccionar Producto */}
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">1. Buscar Producto</label>
                    <input 
                        list="ventas-product-names"
                        placeholder="Escribe para buscar un producto..."
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-primary"
                        value={selectedProductName}
                        onChange={e => {
                            setSelectedProductName(e.target.value);
                            setSelectedVariantId('');
                        }}
                    />
                    <datalist id="ventas-product-names">
                        {products.map(p => <option key={p.id} value={p.name} />)}
                    </datalist>
                </div>

                {/* 2. Seleccionar Variante y Cantidad */}
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">2. Variante</label>
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
                        <div className="flex justify-between items-center mt-auto">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">{item.quantity} x ${item.salePrice}</span>
                            <span className="font-black text-slate-900 dark:text-white">${item.quantity * item.salePrice}</span>
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
                onClick={handleCheckout} 
                disabled={cart.length === 0}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-green-500/20 transition-all flex justify-center items-center gap-2"
            >
                <span className="material-symbols-outlined text-2xl">check_circle</span> 
                TICKET Y COBRAR
            </button>
        </div>
      </div>

    </div>
  );
}
