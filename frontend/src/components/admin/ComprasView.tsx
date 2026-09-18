'use client';
import { useState } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';

export default function ComprasView({ showAlert, apiKey, apiUrl }: { showAlert: (msg: string) => void; apiKey: string; apiUrl: string }) {
    const globalMarkupPrc = useStockFlowStore(s => s.globalMarkupPrc);
    const registerPurchases = useStockFlowStore(s => s.registerPurchases);
    const productsStore = useStockFlowStore(s => s.products);
    const { categoriesConfig, variantGroupsConfig } = useStockFlowStore();

    const createEmptyVariant = () => ({
        size: 'M', description: '',
        quantity: 1, unitPurchasePrice: 0, manualSalePrice: 0, autoCalculated: true,
        sizeIndex: 0,
    });

    const createEmptyProduct = () => ({
        productId: `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        newProductName: '',
        newProductSku: '',
        categoryId: categoriesConfig[0]?.opciones[0] || 'Perfumes de Mujer',
        targetGender: 'Unisex' as const,
        newProductImageUrls: [] as string[],
        _uploading: false,
        variants: [createEmptyVariant()],
        // Descriptive / marketing fields
        description: '',
        tag: 'Alta Demanda',
        showTag: false,
        // Olfactory / feature attributes
        olfactoryNotes: '',
        duration: '',
        intensity: '',
        family: '',
        showFeatures: false,
        // UI accordion
        _showDetails: false,
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

    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const allVariants = products.flatMap(p => p.variants);
    const zeroCostCount = allVariants.filter(v => Number(v.unitPurchasePrice) <= 0).length;
    const totalQuantity = allVariants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
    const totalInvestment = allVariants.reduce((sum, v) => sum + ((Number(v.quantity) || 0) * (Number(v.unitPurchasePrice) || 0)), 0);

    const handleOpenConfirm = () => {
        if (products.some(p => !p.newProductName || !p.newProductName.trim())) {
            showAlert("Asegúrate de rellenar el Nombre para todos los productos.");
            return;
        }

        const hasInvalidQty = products.some(p => p.variants.some(v => !v.quantity || Number(v.quantity) <= 0));
        if (hasInvalidQty) {
            showAlert("Todas las variantes deben tener una cantidad de stock mayor a 0.");
            return;
        }

        setShowConfirmModal(true);
    };

    const handleConfirmSave = () => {
        const flattenedItems: any[] = [];

        products.forEach(p => {
            p.variants.forEach(v => {
                // Destructure variant.description (variant flavour/colour label) separately to avoid collision with product.description
                const { description: variantDesc, ...variantRest } = v as any;
                flattenedItems.push({
                    ...variantRest,
                    productId: p.productId,
                    newProductName: p.newProductName.trim(),
                    newProductSku: p.newProductSku?.trim() || '',
                    categoryId: p.categoryId,
                    targetGender: p.targetGender || 'Unisex',
                    newProductImageUrls: p.newProductImageUrls || [],
                    color: variantDesc || '',
                    // Product-level descriptive fields (override any same-named variant field)
                    description: p.description || undefined,
                    tag: p.tag || undefined,
                    showTag: p.showTag,
                    olfactoryNotes: p.olfactoryNotes || undefined,
                    duration: p.duration || undefined,
                    intensity: p.intensity || undefined,
                    family: p.family || undefined,
                    showFeatures: p.showFeatures,
                });
            });
        });


        const formattedItems = flattenedItems.map(item => {
            const group = categoriesConfig.find(g => g.opciones.includes(item.categoryId));
            let finalSize = item.size;
            
            if (group && group.variantGroupId !== 'none') {
                const variantGroup = variantGroupsConfig.find(vg => vg.id === group.variantGroupId);
                if (variantGroup) {
                    const row = variantGroup.options[item.sizeIndex || 0];
                    if (row) {
                        finalSize = row.description ? `${row.value} - ${row.description}` : row.value;
                    }
                }
            } else {
                finalSize = 'Único';
            }

            return { ...item, size: finalSize };
        });

        registerPurchases(formattedItems);
        showAlert("Compras registradas con éxito. Las variantes y el stock fueron actualizados.");
        setProducts([createEmptyProduct()]);
        setShowConfirmModal(false);
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
                <button onClick={handleOpenConfirm} className="w-full md:w-auto bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark transition shadow-lg shadow-primary/20 shrink-0">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <select
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold h-10"
                                        value={prod.categoryId} onChange={e => updateProduct(pIdx, 'categoryId', e.target.value)}
                                    >
                                        {categoriesConfig.map(g => (
                                            <optgroup key={g.grupo} label={g.grupo} className="font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900">
                                                {g.opciones.map(opt => (
                                                    <option key={opt} value={opt} className="font-medium text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-800">
                                                        {opt}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <select 
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold h-10"
                                        value={prod.targetGender || 'Unisex'} onChange={e => updateProduct(pIdx, 'targetGender', e.target.value)}
                                    >
                                        <option value="Unisex">Unisex</option>
                                        <option value="Mujer">Mujer</option>
                                        <option value="Hombre">Hombre</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <input
                                        list={`product-names-${pIdx}`}
                                        placeholder="Nombre de Producto"
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                        value={prod.newProductName}
                                        onChange={e => {
                                            const val = e.target.value;
                                            updateProduct(pIdx, 'newProductName', val);
                                            const existing = productsStore.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                                            if (existing) {
                                                updateProduct(pIdx, 'productId', existing.id);
                                                updateProduct(pIdx, 'categoryId', existing.categoryId);
                                                updateProduct(pIdx, 'newProductSku', existing.sku);
                                                if (prod.variants.length > 0) {
                                                    updateVariant(pIdx, 0, 'unitPurchasePrice', existing.purchasePrice);
                                                    updateVariant(pIdx, 0, 'manualSalePrice', existing.salePrice);
                                                }
                                                updateProduct(pIdx, 'newProductImageUrls', existing.imageUrls || []);
                                                if (existing.targetGender) updateProduct(pIdx, 'targetGender', existing.targetGender);
                                                // Auto-fill descriptive / feature fields
                                                if (existing.description !== undefined) updateProduct(pIdx, 'description', existing.description);
                                                if (existing.tag !== undefined) updateProduct(pIdx, 'tag', existing.tag);
                                                if (existing.showTag !== undefined) updateProduct(pIdx, 'showTag', existing.showTag);
                                                if (existing.olfactoryNotes !== undefined) updateProduct(pIdx, 'olfactoryNotes', existing.olfactoryNotes);
                                                if (existing.duration !== undefined) updateProduct(pIdx, 'duration', existing.duration);
                                                if (existing.intensity !== undefined) updateProduct(pIdx, 'intensity', existing.intensity);
                                                if (existing.family !== undefined) updateProduct(pIdx, 'family', existing.family);
                                                if (existing.showFeatures !== undefined) updateProduct(pIdx, 'showFeatures', existing.showFeatures);
                                            } else {
                                                if (!prod.productId || !prod.productId.startsWith('NEW-')) {
                                                    updateProduct(pIdx, 'productId', `NEW-${Date.now()}-${pIdx}`);
                                                }
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
                                {(() => {
                                    const group = categoriesConfig.find(g => g.opciones.includes(prod.categoryId));
                                    const hasVariants = group && group.variantGroupId !== 'none';
                                    return (
                                        <label className="block text-xs font-bold text-slate-500">
                                            {hasVariants ? '2. Variantes (Ítem Físico)' : '2. Detalles de Stock e Ingreso'}
                                        </label>
                                    );
                                })()}
                            </div>
                            
                            <div className="space-y-2">
                                {prod.variants.map((variant, vIdx) => (
                                    <div key={vIdx} className="flex flex-wrap md:flex-nowrap items-end gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600">
                                        {(() => {
                                            const group = categoriesConfig.find(g => g.opciones.includes(prod.categoryId));
                                            if (group && group.variantGroupId !== 'none') {
                                                const variantGroup = variantGroupsConfig.find(vg => vg.id === group.variantGroupId);
                                                if (variantGroup) {
                                                    return (
                                                        <div className="flex-1 min-w-[200px]">
                                                            <div className="flex gap-2">
                                                                <select className="w-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-900 dark:text-purple-300 font-bold h-10" value={variant.sizeIndex || 0} onChange={e => updateVariant(pIdx, vIdx, 'sizeIndex', Number(e.target.value))}>
                                                                    {variantGroup.options.map((row, rIdx) => (
                                                                        <option key={rIdx} value={rIdx}>{row.value} {row.description ? `(${row.description})` : ''}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            }
                                            return null;
                                        })()}

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

                        {/* ── Detalles Adicionales accordion ── */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <button
                                type="button"
                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                                onClick={() => updateProduct(pIdx, '_showDetails', !(prod as any)._showDetails)}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
                                    Descripción Premium & Atributos
                                    {((prod.tag && prod.showTag) || prod.description || prod.showFeatures) && (
                                        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Configurado</span>
                                    )}
                                </span>
                                <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${(prod as any)._showDetails ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>

                            {(prod as any)._showDetails && (
                                <div className="p-4 space-y-5 bg-white dark:bg-slate-800/30">

                                    {/* Badge / Tag section */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insignia del Producto</label>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateProduct(pIdx, 'showTag', !prod.showTag)}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prod.showTag ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${prod.showTag ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Mostrar insignia</span>
                                            </div>
                                            {prod.showTag && (
                                                <select
                                                    className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-medium"
                                                    value={prod.tag || 'Alta Demanda'}
                                                    onChange={e => updateProduct(pIdx, 'tag', e.target.value)}
                                                >
                                                    <option>Alta Demanda</option>
                                                    <option>Recomendado</option>
                                                    <option>Más Vendido</option>
                                                    <option>Nuevo</option>
                                                    <option>Edición Limitada</option>
                                                    <option>Oferta Especial</option>
                                                </select>
                                            )}
                                            {prod.showTag && prod.tag && (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                                                    <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                                                    {prod.tag}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción Premium</label>
                                        <textarea
                                            rows={3}
                                            placeholder="Ej: Creada con las esencias más puras para brindarte una experiencia olfativa inigualable..."
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                                            value={prod.description || ''}
                                            onChange={e => updateProduct(pIdx, 'description', e.target.value)}
                                        />
                                    </div>

                                    {/* Olfactory / Feature attributes */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atributos (Notas Olfativas, Duración, etc.)</label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateProduct(pIdx, 'showFeatures', !prod.showFeatures)}
                                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prod.showFeatures ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${prod.showFeatures ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{prod.showFeatures ? 'Visible en tienda' : 'Oculto en tienda'}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {[
                                                { key: 'olfactoryNotes', label: 'Notas Olfativas', placeholder: 'Ej: Cítricas, Florales, Amaderadas', icon: 'air' },
                                                { key: 'duration', label: 'Duración', placeholder: 'Ej: Alta (+8 horas)', icon: 'schedule' },
                                                { key: 'intensity', label: 'Intensidad', placeholder: 'Ej: Moderada - Fuerte', icon: 'auto_awesome' },
                                                { key: 'family', label: 'Familia Olfativa', placeholder: 'Ej: Amaderada Especiada', icon: 'water_drop' },
                                            ].map(({ key, label, placeholder, icon }) => (
                                                <div key={key} className="flex flex-col gap-1">
                                                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                                        <span className="material-symbols-outlined text-[13px]">{icon}</span>
                                                        {label}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder={placeholder}
                                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                                        value={(prod as any)[key] || ''}
                                                        onChange={e => updateProduct(pIdx, key as any, e.target.value)}
                                                    />
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

            {/* MODAL DE CONFIRMACIÓN Y DETALLE DE INGRESO */}
            {showConfirmModal && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowConfirmModal(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                        Revisar Detalle del Ingreso
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Verifica los productos, variantes y costos antes de finalizar el ingreso al inventario.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                                title="Volver a editar"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        {/* Advertencia de Costo Cero (si aplica) */}
                        {zeroCostCount > 0 && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
                                <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">warning</span>
                                <div className="text-xs space-y-1">
                                    <p className="font-bold text-sm">
                                        {zeroCostCount === 1 
                                            ? 'Atención: Hay 1 variante con costo de compra en $0' 
                                            : `Atención: Hay ${zeroCostCount} variantes con costo de compra en $0`}
                                    </p>
                                    <p className="text-amber-800 dark:text-amber-300">
                                        ¿Es correcto que ingresen con costo $0? Si fue un error u omisión, haz clic en <strong>"Volver a editar"</strong> para corregir el valor antes de finalizar.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Metric cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Productos</span>
                                <span className="text-lg font-black text-slate-900 dark:text-white">{products.length}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Unidades</span>
                                <span className="text-lg font-black text-primary">{totalQuantity} un.</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Inversión Total</span>
                                <span className="text-lg font-black text-slate-900 dark:text-white">${totalInvestment.toLocaleString('es-AR')}</span>
                            </div>
                        </div>

                        {/* Listado de Productos y Variantes con scroll */}
                        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                            {products.map((p, pIdx) => {
                                const group = categoriesConfig.find(g => g.opciones.includes(p.categoryId));
                                const variantGroup = (group && group.variantGroupId !== 'none')
                                    ? variantGroupsConfig.find(vg => vg.id === group.variantGroupId)
                                    : null;

                                const prodTotalQty = p.variants.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
                                const prodTotalCost = p.variants.reduce((acc, v) => acc + ((Number(v.quantity) || 0) * (Number(v.unitPurchasePrice) || 0)), 0);

                                return (
                                    <div key={pIdx} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/60 pb-2.5">
                                            <div className="flex items-center gap-3">
                                                {p.newProductImageUrls && p.newProductImageUrls.length > 0 ? (
                                                    <img src={p.newProductImageUrls[0]} alt="" className="size-11 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                                                ) : (
                                                    <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                                        <span className="material-symbols-outlined text-xl">inventory_2</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                        {p.newProductName || 'Sin Nombre'}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        {p.categoryId} • {p.targetGender || 'Unisex'} {p.newProductSku ? `• SKU: ${p.newProductSku}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {prodTotalQty} un. • ${prodTotalCost.toLocaleString('es-AR')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="text-slate-400 border-b border-slate-200/60 dark:border-slate-700/40">
                                                        <th className="pb-1.5 font-semibold">Talle / Tamaño</th>
                                                        <th className="pb-1.5 font-semibold">Descripción</th>
                                                        <th className="pb-1.5 font-semibold text-center">Cant.</th>
                                                        <th className="pb-1.5 font-semibold text-right">Costo Unit.</th>
                                                        <th className="pb-1.5 font-semibold text-right">P. Venta</th>
                                                        <th className="pb-1.5 font-semibold text-right">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {p.variants.map((v, vIdx) => {
                                                        let sizeLabel = 'Único';
                                                        if (variantGroup) {
                                                            const opt = variantGroup.options[v.sizeIndex || 0];
                                                            if (opt) sizeLabel = opt.description ? `${opt.value} (${opt.description})` : opt.value;
                                                        }
                                                        const isZeroCost = Number(v.unitPurchasePrice) <= 0;
                                                        const subtotal = (Number(v.quantity) || 0) * (Number(v.unitPurchasePrice) || 0);

                                                        return (
                                                            <tr key={vIdx} className={isZeroCost ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                                                                <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{sizeLabel}</td>
                                                                <td className="py-2 text-slate-600 dark:text-slate-400">{(v as any).description || '-'}</td>
                                                                <td className="py-2 text-center font-bold text-slate-900 dark:text-white">{v.quantity}</td>
                                                                <td className="py-2 text-right font-mono">
                                                                    {isZeroCost ? (
                                                                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                                                                            $0 <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 px-1 py-0.2 rounded font-black">Costo $0</span>
                                                                        </span>
                                                                    ) : (
                                                                        `$${Number(v.unitPurchasePrice).toLocaleString('es-AR')}`
                                                                    )}
                                                                </td>
                                                                <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                    ${Number(v.manualSalePrice).toLocaleString('es-AR')}
                                                                </td>
                                                                <td className="py-2 text-right font-bold font-mono text-slate-800 dark:text-slate-200">
                                                                    ${subtotal.toLocaleString('es-AR')}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">arrow_back</span>
                                Volver a editar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSave}
                                className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                Aceptar y Confirmar Ingreso
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
