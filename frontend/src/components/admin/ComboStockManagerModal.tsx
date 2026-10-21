'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useStockFlowStore, Product } from '@/store/useStockStore';

interface ComboStockManagerModalProps {
  product: Product | null;
  initialMode?: 'produce' | 'disassemble';
  isOpen: boolean;
  onClose: () => void;
  showAlert: (msg: string) => void;
}

export default function ComboStockManagerModal({
  product,
  initialMode = 'produce',
  isOpen,
  onClose,
  showAlert,
}: ComboStockManagerModalProps) {
  const [mode, setMode] = useState<'produce' | 'disassemble'>(initialMode);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const products = useStockFlowStore((s) => s.products);
  const produceMoreBundles = useStockFlowStore((s) => s.produceMoreBundles);
  const disassembleBundle = useStockFlowStore((s) => s.disassembleBundle);

  // Sync mode when initialMode changes
  React.useEffect(() => {
    setMode(initialMode);
    setQuantity(1);
  }, [initialMode, isOpen]);

  if (!isOpen || !product || !product.isBundle || !product.bundleComponents) {
    return null;
  }

  const currentComboStock = product.variants?.[0]?.stock || 0;

  // Max combos that can be produced based on current components stock
  const maxCanProduce = () => {
    let min = Infinity;
    for (const comp of product.bundleComponents!) {
      const prod = products.find((p) => p.id === comp.productId);
      const variant = prod?.variants.find((v) => v.id === comp.variantId);
      const stock = variant?.stock || 0;
      const possible = Math.floor(stock / (comp.quantityPerBundle || 1));
      if (possible < min) min = possible;
    }
    return min === Infinity ? 0 : Math.max(0, min);
  };

  const maxProduce = maxCanProduce();

  const handleConfirm = async () => {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));

    if (mode === 'produce') {
      if (qty > maxProduce) {
        showAlert(`No alcanza el stock de los componentes para armar ${qty} combos.`);
        return;
      }
      setLoading(true);
      try {
        const res = produceMoreBundles(product.id, qty);
        if (!res.success) {
          showAlert(res.error || 'Error al armar más combos.');
          return;
        }
        // Sync
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
          console.warn('Error sincronizando al producir combos:', e);
        }
        showAlert(`✅ Se armaron con éxito +${qty} unidades de "${product.name}".`);
        onClose();
      } finally {
        setLoading(false);
      }
    } else {
      // Disassemble
      if (qty > currentComboStock) {
        showAlert(`No puedes desarmar más unidades de las que tienes en stock (${currentComboStock}).`);
        return;
      }
      setLoading(true);
      try {
        const res = disassembleBundle(product.id, qty);
        if (!res.success) {
          showAlert(res.error || 'Error al desarmar el combo.');
          return;
        }
        // Sync
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
          console.warn('Error sincronizando al desarmar combos:', e);
        }
        showAlert(`✅ Se desarmaron ${qty} unidades de "${product.name}". Los componentes volvieron al inventario.`);
        onClose();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <span className="material-symbols-outlined text-xl">
                {mode === 'produce' ? 'precision_manufacturing' : 'unarchive'}
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {mode === 'produce' ? 'Armar Más Unidades' : 'Desarmar Combo'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                {product.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 p-1.5 m-5 mb-0 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('produce');
              setQuantity(1);
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'produce'
                ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Armar Más (Producir)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('disassemble');
              setQuantity(1);
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'disassemble'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">remove_circle</span>
            Desarmar Combo (Restaurar)
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stock info badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Stock actual armado del combo:
            </span>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300">
              {currentComboStock} {currentComboStock === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>

          {/* Mode-specific content */}
          {mode === 'produce' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>¿Cuántos combos deseas armar físicamente?</span>
                  <span className="text-[11px] font-black text-slate-500">
                    Máx posible: {maxProduce}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={maxProduce || 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-pink-400 rounded-xl text-base font-black text-center text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(maxProduce)}
                    disabled={maxProduce <= 0}
                    className="px-4 py-2.5 bg-pink-100 hover:bg-pink-200 dark:bg-pink-950 text-pink-700 dark:text-pink-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    Máx ({maxProduce})
                  </button>
                </div>
              </div>

              {/* Component breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Componentes necesarios para armar {quantity} {quantity === 1 ? 'combo' : 'combos'}:
                </span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                  {product.bundleComponents.map((comp, idx) => {
                    const prod = products.find((p) => p.id === comp.productId);
                    const variant = prod?.variants.find((v) => v.id === comp.variantId);
                    const currentStock = variant?.stock || 0;
                    const needed = (comp.quantityPerBundle || 1) * quantity;
                    const hasEnough = currentStock >= needed;

                    return (
                      <div
                        key={idx}
                        className="p-2.5 flex items-center justify-between bg-white dark:bg-slate-900"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {comp.productName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {comp.variantInfo} ({comp.quantityPerBundle} por combo)
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`font-black ${
                              hasEnough ? 'text-slate-800 dark:text-slate-200' : 'text-red-500'
                            }`}
                          >
                            Necesario: {needed} un.
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Disp. en stock: {currentStock} un.
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>¿Cuántos combos deseas desarmar?</span>
                  <span className="text-[11px] font-black text-slate-500">
                    En stock: {currentComboStock}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={currentComboStock || 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-rose-400 rounded-xl text-base font-black text-center text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(currentComboStock)}
                    disabled={currentComboStock <= 0}
                    className="px-4 py-2.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    Todos ({currentComboStock})
                  </button>
                </div>
              </div>

              {/* What will be returned */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1.5 text-xs">
                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">assignment_return</span>
                  Se restaurarán al inventario individual:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300">
                  {product.bundleComponents.map((comp, idx) => (
                    <li key={idx}>
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        +{(comp.quantityPerBundle || 1) * quantity} un.
                      </span>{' '}
                      de {comp.productName} ({comp.variantInfo})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              loading ||
              (mode === 'produce' && (quantity <= 0 || quantity > maxProduce)) ||
              (mode === 'disassemble' && (quantity <= 0 || quantity > currentComboStock))
            }
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === 'produce'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-pink-500/20'
                : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/20'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {loading ? 'progress_activity' : 'check'}
            </span>
            {loading
              ? 'Procesando...'
              : mode === 'produce'
              ? `Confirmar Armado (+${quantity})`
              : `Confirmar Desarme (-${quantity})`}
          </button>
        </div>
      </div>
    </div>
  );
}
