export const PRODUCT_METADATA_MAP: Record<string, { cat: string; gender: 'Mujer' | 'Hombre' | 'Unisex'; size: string }> = {
  "Lattafa Yara Moi EDP 100ml Blanco": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Lattafa Yara Elixir EDP 100ml New": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Lattafa Yara Tous EDP 100ml Naranja": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Lattafa Khamrah Dukhan EDP 100ml": { cat: "Unisex", gender: "Unisex", size: "100ml" },
  "Lattafa Khamrah Qahwa EDP 100ml": { cat: "Unisex", gender: "Unisex", size: "100ml" },
  "Ard Al Za. Ajmal Ehsaas EDP 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Ard Al Za. Shams Al Emarat K.Pink Blush 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Mega Collection Drive for Man 100ml": { cat: "Perfumes de Hombre", gender: "Hombre", size: "100ml" },
  "Mega Collection Evento 100ml": { cat: "Unisex", gender: "Unisex", size: "100ml" },
  "Maison A. Body Mist Bad Pour Femme 250ml": { cat: "Body Splash / Body Mist", gender: "Mujer", size: "250ml" },
  "Maison A. Body Mist Intrude 250ml": { cat: "Body Splash / Body Mist", gender: "Unisex", size: "250ml" },
  "Lattafa Asad EDP 100ml Negro": { cat: "Perfumes de Hombre", gender: "Hombre", size: "100ml" },
  "Lattafa Deo 200ml Khamrah Qahwa Deodorante": { cat: "Desodorantes", gender: "Unisex", size: "200ml" },
  "Mega Collection True Dreams 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Mega Collection Very Intense Pour Homme 100ml": { cat: "Perfumes de Hombre", gender: "Hombre", size: "100ml" },
  "Maison A. Victoria Flower Rosa Lilium 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Maison A. Vogue Night EDP 100ml": { cat: "Perfumes de Hombre", gender: "Hombre", size: "100ml" },
  "Maison A. Vogue Party 100ml": { cat: "Unisex", gender: "Unisex", size: "100ml" },
  "Maison A. Philos Shine 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Maison A. So Glam Rouge Intense 100ml New": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Ard Al Za. Layalina EDP 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Maison A. Pink Shimmer Secret Intense 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Maison A. Queenstown P.Femme Intense 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
  "Lattafa Yara Rosa EDP 100ml": { cat: "Perfumes de Mujer", gender: "Mujer", size: "100ml" },
};

export function syncBatchItemsToStore(batch: any, registerPurchaseBatch: (batchData: any) => void, globalMarkupPrc: number = 50) {
  if (!batch || !Array.isArray(batch.items) || batch.items.length === 0) {
    throw new Error('El lote no contiene productos');
  }

  const items = batch.items.map((it: any) => {
    const meta = PRODUCT_METADATA_MAP[it.product_name] || {
      cat: 'Perfumes de Mujer',
      gender: 'Unisex',
      size: it.variant_label || '100ml',
    };

    const unitCostARS = Number(it.unit_cost_ars) || 0;
    const shippingARS = Number(it.shipping_per_unit_ars) || 0;
    const totalCostARS = Number(it.total_cost_per_unit_ars) || (unitCostARS + shippingARS);
    const salePrice = (Number(it.sale_price) > 0)
      ? Number(it.sale_price)
      : Math.round(totalCostARS * (1 + (globalMarkupPrc || 50) / 100));

    return {
      productId: (it.product_id && !it.product_id.startsWith('NEW')) ? it.product_id : undefined,
      variantId: (it.variant_id && !it.variant_id.startsWith('v-')) ? it.variant_id : undefined,
      productName: it.product_name,
      newProductName: it.product_name,
      variantLabel: it.variant_label || meta.size,
      size: it.variant_label || meta.size,
      color: '',
      quantity: Number(it.quantity) || 1,
      unitCostOriginal: Number(it.unit_cost_original) || 0,
      unitCostARS: unitCostARS,
      shippingPerUnitARS: shippingARS,
      totalCostPerUnitARS: totalCostARS,
      salePrice: salePrice,
      categoryId: meta.cat,
      targetGender: meta.gender,
      newProductImageUrls: [],
    };
  });

  registerPurchaseBatch({
    batchNumber: batch.batch_number,
    supplierName: batch.supplier_name || batch.supplier?.name || 'Serena.G CDE',
    purchaseCurrency: batch.currency || 'USD',
    exchangeRate: Number(batch.exchange_rate) || 1700,
    items,
  });

  return items.length;
}
