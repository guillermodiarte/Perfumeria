'use client';
import { useState } from 'react';
import { useStockFlowStore, CATEGORIAS_PERFUMERIA, TABLA_PRESENTACION_PERFUMES, TABLA_TALLES_ACCESORIOS } from '@/store/useStockStore';

export default function ComprasView({ showAlert, apiKey, apiUrl }: { showAlert: (msg: string) => void; apiKey: string; apiUrl: string }) {
    const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
    const registerPurchases = useStockFlowStore(s => s.registerPurchases);
    const productsStore = useStockFlowStore(s => s.products);

    const createEmptyVariant = () => ({
        size: 'M', description: '',
        quantity: 1, unitPurchasePrice: 0, manualSalePrice: 0, autoCalculated: true,
        perfumeMetric: 'ML', perfumeSizeIndex: 1,
        accessoryMetric: 'TALLE', accessorySizeIndex: 0,
    });

    const createEmptyProduct = () => ({
        productId: 'NEW', newProductName: '', newProductSku: '', categoryId: 'Perfumes de Mujer',
        newProductImageUrls: [] as string[],
        _uploading: false,
        variants: [createEmptyVariant()]
    });

    const [products, setProducts] = useState([createEmptyProduct()]);

    const addProductLine = () => setProducts([...products, createEmptyProduct()]);

    const addVariant = (pIdx: number) => {
        const newProducts = [...products];
        newProducts[pIdx].variants.push(createEmptyVariant());
        setProducts(newProducts);
    };

    const updateProduct = (pIdx: number, field: keyof typeof products[0], value: any) => {
        const newProducts = [...products];
        (newProducts[pIdx] as any)[field] = value;
        setProducts(newProducts);
    };

    const updateVariant = (pIdx: number, vIdx: number, field: string, value: any) => {
        const newProducts = [...products];
        const variant = newProducts[pIdx].variants[vIdx] as any;
        variant[field] = value;

        if (field === 'unitPurchasePrice' && variant.autoCalculated) {
            variant.manualSalePrice = Number((value * (1 + (globalMarkupPrc / 100))).toFixed(2));
        }

        if (field === 'manualSalePrice') {
            variant.autoCalculated = false;
        }

        setProducts(newProducts);
    };

    const removeProduct = (pIdx: number) => {
        if (products.length > 1) {
            setProducts(products.filter((_, i) => i !== pIdx));
        }
    };

    const removeVariant = (pIdx: number, vIdx: number) => {
        const newProducts = [...products];
        if (newProducts[pIdx].variants.length > 1) {
            newProducts[pIdx].variants.splice(vIdx, 1);
            setProducts(newProducts);
        }
    };

    const handleSave = () => {
        if (products.some(p => p.productId === 'NEW' && !p.newProductName)) {
            showAlert("Asegúrate de rellenar el Nombre para los productos.");
            return;
        }
        
        const flattenedItems: any[] = [];

        products.forEach(p => {
            p.variants.forEach(v => {
                flattenedItems.push({
                    productId: p.productId,
                    newProductName: p.newProductName,
                    newProductSku: p.newProductSku,
                    categoryId: p.categoryId,
                    newProductImageUrls: p.newProductImageUrls,
                    color: (v as any).description || '',
                    ...v
                });
            });
        });

        const formattedItems = flattenedItems.map(item => {
            const group = CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(item.categoryId));
            const isPerfume = group?.grupo === 'Perfumería' || group?.grupo === 'Cuidado de la Piel' || group?.grupo === 'Cuidado Personal';
            const isAccesorios = group?.grupo === 'Accesorios' || group?.grupo === 'Maquillaje';

            let finalSize = item.size;
            if (isPerfume) {
                const row = TABLA_PRESENTACION_PERFUMES[item.perfumeSizeIndex];
                if (row) {
                    finalSize = `${row.ML} (${row.TIPO})`;
                }
            } else if (isAccesorios) {
                const row = TABLA_TALLES_ACCESORIOS[item.accessorySizeIndex];
                if (row) {
                    finalSize = `${row.TALLE} - ${row.DESC}`;
                }
            }

            return { ...item, size: finalSize };
        });

        registerPurchases(formattedItems);
        showAlert("Compras registradas con éxito. Las variantes y el stock fueron actualizados.");
        setProducts([createEmptyProduct()]);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
                        Ingreso de Mercadería
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Ingresa stock seleccionando variantes específicas. PV calculado al {globalMarkupPrc}%.
                    </p>
                </div>
                <button onClick={handleSave} className="w-full md:w-auto bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark transition shadow-lg shadow-primary/20 shrink-0">
                    <span className="material-symbols-outlined">save</span> Finalizar Ingreso
                </button>
            </div>

            <div className="space-y-6">
                {products.map((prod, pIdx) => (
                    <div key={pIdx} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl relative flex flex-col gap-4">

                        <button onClick={() => removeProduct(pIdx)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 rounded-full size-8 flex items-center justify-center border border-red-200 hover:bg-red-200 z-10 transition-colors" title="Quitar producto">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>

                        {/* PRODUCT SELECTOR */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="col-span-1 md:col-span-5 space-y-2">
                                <label className="block text-xs font-bold text-slate-500">1. Producto Padre</label>
                                <select
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold h-10"
                                    value={prod.categoryId} onChange={e => updateProduct(pIdx, 'categoryId', e.target.value)}
                                >
                                    {CATEGORIAS_PERFUMERIA.map(g => (
                                        <optgroup key={g.grupo} label={g.grupo} className="font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900">
                                            {g.opciones.map(opt => (
                                                <option key={opt} value={opt} className="font-medium text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-800">
                                                    {opt}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <input
                                        list={`product-names-${pIdx}`}
                                        placeholder="Nombre de Producto"
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                        value={prod.newProductName}
                                        onChange={e => {
                                            const val = e.target.value;
                                            updateProduct(pIdx, 'newProductName', val);
                                            const existing = productsStore.find(p => p.name.toLowerCase() === val.toLowerCase());
                                            if (existing) {
                                                updateProduct(pIdx, 'categoryId', existing.categoryId);
                                                updateProduct(pIdx, 'newProductSku', existing.sku);
                                                if (prod.variants.length > 0) {
                                                    updateVariant(pIdx, 0, 'unitPurchasePrice', existing.purchasePrice);
                                                    updateVariant(pIdx, 0, 'manualSalePrice', existing.salePrice);
                                                }
                                                updateProduct(pIdx, 'newProductImageUrls', existing.imageUrls || []);
                                            }
                                        }}
                                    />
                                    <datalist id={`product-names-${pIdx}`}>
                                        {productsStore.map(p => <option key={p.id} value={p.name} />)}
                                    </datalist>

                                    <input placeholder="SKU (Opcional)" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={prod.newProductSku} onChange={e => updateProduct(pIdx, 'newProductSku', e.target.value)} />
                                </div>
                            </div>
                            
                            {/* PHOTOS — moved into product level */}
                            <div className="col-span-1 md:col-span-7 flex flex-col gap-2">
                                <label className="block text-xs font-bold text-slate-500">Imágenes del Producto</label>
                                <div className="flex items-center gap-3 w-full border border-slate-200 dark:border-slate-700/60 p-2 rounded-lg bg-white dark:bg-slate-800">
                                    <label className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-colors text-xs font-bold whitespace-nowrap ${prod._uploading
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 text-blue-600 cursor-wait'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer'
                                        }`}>
                                        <span className="material-symbols-outlined text-[16px]">
                                            {prod._uploading ? 'sync' : 'add_photo_alternate'}
                                        </span>
                                        {prod._uploading ? 'Subiendo...' : 'Subir'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            disabled={prod._uploading}
                                            className="hidden"
                                            onChange={async e => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length === 0) return;
                                                if (!apiKey) { showAlert('Sin conexión con el servidor. Intenta de nuevo.'); return; }

                                                updateProduct(pIdx, '_uploading', true);
                                                const uploadedUrls: string[] = [];

                                                for (const file of files) {
                                                    const formData = new FormData();
                                                    formData.append('file', file);
                                                    try {
                                                        const res = await fetch(
                                                            `${apiUrl}/api/admin/product-image?subcategory=${encodeURIComponent(prod.categoryId)}`,
                                                            { method: 'POST', headers: { 'X-API-KEY': apiKey }, body: formData }
                                                        );
                                                        if (res.ok) {
                                                            const data = await res.json();
                                                            uploadedUrls.push(data.url);
                                                        } else {
                                                            showAlert(`Error subiendo ${file.name}`);
                                                        }
                                                    } catch {
                                                        showAlert(`Error de red subiendo ${file.name}`);
                                                    }
                                                }

                                                const current = prod.newProductImageUrls || [];
                                                updateProduct(pIdx, 'newProductImageUrls', [...current, ...uploadedUrls]);
                                                updateProduct(pIdx, '_uploading', false);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>

                                    {/* thumbnails flow to the right */}
                                    <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
                                        {(prod.newProductImageUrls || []).map((imgUrl, imgIdx) => (
                                            <div
                                                key={imgIdx}
                                                className="size-8 rounded-md flex-shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden relative group/img cursor-pointer"
                                                onClick={() => {
                                                    const arr = [...prod.newProductImageUrls];
                                                    arr.splice(imgIdx, 1);
                                                    updateProduct(pIdx, 'newProductImageUrls', arr);
                                                }}
                                                title="Quitar"
                                            >
                                                <img src={imgUrl} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-white text-[12px]">close</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(prod.newProductImageUrls || []).length === 0 && (
                                            <p className="text-xs text-slate-400 italic self-center">Sin fotos aún</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* VARIANTS SECTION */}
                        <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-500">2. Variantes (Ítem Físico)</label>
                            </div>
                            
                            <div className="space-y-2">
                                {prod.variants.map((variant, vIdx) => (
                                    <div key={vIdx} className="flex flex-wrap md:flex-nowrap items-end gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600">
                                        {/* Size Selectors */}
                                        <div className="flex-1 min-w-[200px]">
                                            {CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(prod.categoryId))?.grupo === 'Perfumería' || CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(prod.categoryId))?.grupo === 'Cuidado de la Piel' || CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(prod.categoryId))?.grupo === 'Cuidado Personal' ? (
                                                <div className="flex gap-2">
                                                    <select className="w-1/3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-2 py-2 text-xs text-purple-900 dark:text-purple-300 font-bold h-10" value={variant.perfumeMetric} onChange={e => updateVariant(pIdx, vIdx, 'perfumeMetric', e.target.value)}>
                                                        <option value="ML">ML / Vol</option>
                                                    </select>
                                                    <select className="w-2/3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-900 dark:text-purple-300 font-bold h-10" value={variant.perfumeSizeIndex} onChange={e => updateVariant(pIdx, vIdx, 'perfumeSizeIndex', Number(e.target.value))}>
                                                        {TABLA_PRESENTACION_PERFUMES.map((row, rIdx) => (
                                                            <option key={rIdx} value={rIdx}>{row.ML} ({row.TIPO})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(prod.categoryId))?.grupo === 'Accesorios' || CATEGORIAS_PERFUMERIA.find(g => g.opciones.includes(prod.categoryId))?.grupo === 'Maquillaje' ? (
                                                <div className="flex gap-2">
                                                    <select className="w-1/3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-2 py-2 text-xs text-purple-900 dark:text-purple-300 font-bold h-10" value={variant.accessoryMetric} onChange={e => updateVariant(pIdx, vIdx, 'accessoryMetric', e.target.value)}>
                                                        <option value="TALLE">TALLE</option>
                                                    </select>
                                                    <select className="w-2/3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-900 dark:text-purple-300 font-bold h-10" value={variant.accessorySizeIndex} onChange={e => updateVariant(pIdx, vIdx, 'accessorySizeIndex', Number(e.target.value))}>
                                                        {TABLA_TALLES_ACCESORIOS.map((row, rIdx) => (
                                                            <option key={rIdx} value={rIdx}>{row.TALLE}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <select className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 font-bold h-10 opacity-60 pointer-events-none cursor-not-allowed text-center" value="Unico" onChange={() => { }}>
                                                    <option value="Unico">Sin Talle (Estándar)</option>
                                                </select>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-[140px]">
                                            <input
                                                type="text"
                                                placeholder="Descripción (ej: Negro/Rosa)"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white h-10"
                                                value={(variant as any).description}
                                                onChange={e => updateVariant(pIdx, vIdx, 'description', e.target.value)}
                                            />
                                        </div>

                                        <div className="w-[80px]">
                                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Stock</label>
                                            <input type="number" step="1" className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm text-slate-900 dark:text-white font-bold h-9" value={variant.quantity} onChange={e => updateVariant(pIdx, vIdx, 'quantity', Number(e.target.value))} />
                                        </div>

                                        <div className="w-[100px]">
                                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none">Costo</label>
                                            <input type="number" className="w-full text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm text-red-600 font-bold h-9" value={variant.unitPurchasePrice} onChange={e => updateVariant(pIdx, vIdx, 'unitPurchasePrice', Number(e.target.value))} />
                                        </div>

                                        <div className="w-[100px]">
                                            <label className="block text-[10px] text-center font-bold text-slate-500 mb-1 leading-none truncate" title="P. Venta sugerido">PV ({globalMarkupPrc}%)</label>
                                            <input type="number" className={`w-full text-center bg-white dark:bg-slate-800 border rounded-lg px-1 py-1 text-sm font-black h-9 transition-colors ${!variant.autoCalculated ? 'border-yellow-400 text-yellow-600' : 'border-green-300 dark:border-green-800 text-green-600 dark:text-green-400'}`} value={variant.manualSalePrice} onChange={e => updateVariant(pIdx, vIdx, 'manualSalePrice', Number(e.target.value))} />
                                        </div>

                                        <button onClick={() => removeVariant(pIdx, vIdx)} className={`h-9 px-2 rounded-lg transition-colors flex items-center justify-center border border-transparent ${prod.variants.length > 1 ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-300 opacity-50 cursor-not-allowed'}`} disabled={prod.variants.length <= 1} title={prod.variants.length > 1 ? "Quitar variante" : "No se puede quitar la última variante"}>
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button onClick={() => addVariant(pIdx)} className="text-sm font-bold text-primary flex items-center gap-1 hover:bg-primary/10 px-3 py-2 rounded-lg w-max transition-colors">
                                <span className="material-symbols-outlined text-[18px]">add_circle</span> Añadir Variante
                            </button>
                        </div>
                    </div>
                ))}

                <button onClick={addProductLine} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-xl">add_circle</span> Añadir nuevo producto a este ingreso
                </button>

            </div>
        </div>
    );
}
