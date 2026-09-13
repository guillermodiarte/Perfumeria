import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CategoryConfig {
  grupo: string;
  opciones: string[];
  variantGroupId: string; // 'none' or group id
}

export interface VariantOption {
  value: string;
  description: string;
}

export interface VariantGroupConfig {
  id: string;
  name: string;
  options: VariantOption[];
}

export const DEFAULT_VARIANT_GROUPS: VariantGroupConfig[] = [
  {
    id: 'perfumes',
    name: 'Tamaños de Perfumería',
    options: [
      { value: '30ml', description: 'Travel Size' },
      { value: '50ml', description: 'Estándar' },
      { value: '75ml', description: 'Mediano' },
      { value: '100ml', description: 'Grande' },
      { value: '150ml', description: 'Extra Grande' },
      { value: '200ml', description: 'Familiar' }
    ]
  },
  {
    id: 'accesorios',
    name: 'Talles de Accesorios',
    options: [
      { value: 'Único', description: 'Ajustable o Estándar' },
      { value: 'S', description: 'Pequeño' },
      { value: 'M', description: 'Mediano' },
      { value: 'L', description: 'Grande' }
    ]
  }
];

export const CATEGORIAS_PERFUMERIA: CategoryConfig[] = [
  {
    grupo: 'Perfumería',
    variantGroupId: 'perfumes',
    opciones: [
      'Perfumes de Mujer',
      'Unisex',
      'Body Splash / Body Mist',
      'Set de Regalo'
    ]
  },
  {
    grupo: 'Maquillaje',
    variantGroupId: 'accesorios',
    opciones: [
      'Ojos',
      'Labios',
      'Rostro',
      'Paletas',
      'Brochas y Accesorios'
    ]
  },
  {
    grupo: 'Cuidado de la Piel',
    variantGroupId: 'none',
    opciones: [
      'Limpieza Facial',
      'Hidratación',
      'Tratamiento Anti-age',
      'Protectores Solares'
    ]
  },
  {
    grupo: 'Cuidado Personal',
    variantGroupId: 'perfumes',
    opciones: [
      'Cuidado Capilar',
      'Higiene Corporal',
      'Desodorantes'
    ]
  },
  {
    grupo: 'Accesorios',
    variantGroupId: 'accesorios',
    opciones: [
      'Collares y Cadenas',
      'Anillos',
      'Aritos',
      'Pulseras',
      'Relojes'
    ]
  }
];

// Legacy constants (removed in favor of VariantGroupConfig)

export interface ProductVariant {
  id: string; // Unique ID for the variant
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  targetGender?: 'Hombre' | 'Mujer' | 'Unisex';
  purchasePrice: number;
  salePrice: number;
  imageUrls?: string[];
  variants: ProductVariant[];
}

export interface PurchaseRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  quantity: number;
  unitPurchasePrice: number;
  totalCost: number;
}

export interface SaleRecord {
  id: string;
  ticketId: string;
  date: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  clientName: string;
  clientPhone: string;
  quantity: number;
  unitSalePrice: number;
  revenue: number;
  status: 'Pagada' | 'Pendiente' | 'Cancelada';
  paidAmount?: number;
  remainingAmount?: number;
  pendingAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'full';
  paymentType?: 'total' | 'partial' | 'cuotas';
  installmentsCount?: number;
  installmentMonthlyAmount?: number;
  lastNotifiedMonth?: string;
  deliveryStatus?: 'pending' | 'delivered';
  adminNotes?: string;
  notes?: string;
  productImageUrl?: string;
  confirmationDate?: string;
}

export interface StockFlowState {
  globalMarkupPrc: number;
  products: Product[];
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  wholesaleConfig: { minQuantity: number; discountPercentage: number };
  
  categoriesConfig: CategoryConfig[];
  variantGroupsConfig: VariantGroupConfig[];

  setGlobalMarkup: (percentage: number) => void;
  setWholesaleConfig: (config: { minQuantity: number; discountPercentage: number }) => void;
  setCategoriesConfig: (categories: CategoryConfig[]) => void;
  setVariantGroupsConfig: (groups: VariantGroupConfig[]) => void;
  
  registerPurchases: (newPurchases: {
    productId: string | 'NEW';
    newProductName?: string;
    newProductSku?: string;
    newProductImageUrls?: string[];
    categoryId: string;
    targetGender?: 'Hombre' | 'Mujer' | 'Unisex';
    size: string;
    color: string;
    quantity: number;
    unitPurchasePrice: number;
    manualSalePrice: number;
  }[]) => void;

  registerSale: (
    clientName: string, 
    clientPhone: string, 
    items: { 
      productId: string; 
      variantId: string; 
      quantity: number; 
      salePrice: number 
    }[],
    paymentOptions?: {
      paymentType: 'total' | 'partial' | 'cuotas';
      paidAmount: number;
      pendingAmount: number;
      installmentsCount?: number;
      notes?: string;
    }
  ) => string;

  recordSalePayment: (ticketId: string, amount: number, note?: string) => void;
  markSaleMonthPaid: (ticketId: string, monthStr: string) => void;

  registerWebSale: (clientName: string, clientPhone: string, items: { 
    productId: string; 
    variantId: string; 
    quantity: number; 
    salePrice: number;
    productName?: string;
    size?: string;
    color?: string;
    imageUrl?: string;
  }[], customTicketId?: string) => string;

  approveOrderTicket: (ticketId: string, paidAmount: number, paymentStatus: 'partial' | 'full') => void;
  rejectOrderTicket: (ticketId: string) => void;
  updateOrderDeliveryStatus: (ticketId: string, deliveryStatus: 'pending' | 'delivered') => void;
  updateOrderDetailsAdmin: (ticketId: string, updates: { 
    status?: 'Pagada' | 'Pendiente' | 'Cancelada'; 
    paymentStatus?: 'pending' | 'partial' | 'full'; 
    deliveryStatus?: 'pending' | 'delivered'; 
    paidAmount?: number; 
    adminNotes?: string;
  }) => void;
  deleteUserOrder: (ticketId: string) => void;

  confirmSale: (saleId: string) => void;
  cancelSale: (saleId: string) => void;

  deleteProduct: (productId: string) => void;
  deleteVariant: (productId: string, variantId: string) => void;
  updateProduct: (productId: string, data: Partial<Product>, variants?: ProductVariant[]) => void;
  
  importData: (data: any) => void;
}

// Initial Mock Data with Variants
const MOCK_PRODUCTS: Product[] = [
  // Body Spray
  { id: 'b1', name: 'Body Splash Tropical 1', sku: 'BODY-01', categoryId: 'Body Splash', purchasePrice: 6000, salePrice: 12000, imageUrls: ['/uploads/BodySpray/1.jpeg'], variants: [{ id: 'vb1', size: '200ml', color: 'Único', stock: 10 }] },
  { id: 'b2', name: 'Body Splash Floral 2', sku: 'BODY-02', categoryId: 'Body Splash', purchasePrice: 6000, salePrice: 12000, imageUrls: ['/uploads/BodySpray/2.jpeg'], variants: [{ id: 'vb2', size: '200ml', color: 'Único', stock: 15 }] },
  { id: 'b3', name: 'Body Splash Citric 3', sku: 'BODY-03', categoryId: 'Body Splash', purchasePrice: 6000, salePrice: 12000, imageUrls: ['/uploads/BodySpray/3.jpeg'], variants: [{ id: 'vb3', size: '200ml', color: 'Único', stock: 12 }] },
  { id: 'b4', name: 'Body Splash Sweet 4', sku: 'BODY-04', categoryId: 'Body Splash', purchasePrice: 6000, salePrice: 12000, imageUrls: ['/uploads/BodySpray/4.jpeg'], variants: [{ id: 'vb4', size: '200ml', color: 'Único', stock: 20 }] },
  { id: 'b5', name: 'Body Splash Fresh 5', sku: 'BODY-05', categoryId: 'Body Splash', purchasePrice: 6000, salePrice: 12000, imageUrls: ['/uploads/BodySpray/5.jpeg'], variants: [{ id: 'vb5', size: '200ml', color: 'Único', stock: 8 }] },

  // Labiales
  { id: 'l1', name: 'Labial Matte 1', sku: 'LAB-01', categoryId: 'Labios', purchasePrice: 4000, salePrice: 8500, imageUrls: ['/uploads/Labiales/1.jpeg'], variants: [{ id: 'vl1', size: 'Único', color: 'Rojo', stock: 25 }] },
  { id: 'l2', name: 'Labial Matte 2', sku: 'LAB-02', categoryId: 'Labios', purchasePrice: 4000, salePrice: 8500, imageUrls: ['/uploads/Labiales/2.jpeg'], variants: [{ id: 'vl2', size: 'Único', color: 'Rosa', stock: 15 }] },
  { id: 'l3', name: 'Labial Gloss 3', sku: 'LAB-03', categoryId: 'Labios', purchasePrice: 4500, salePrice: 9000, imageUrls: ['/uploads/Labiales/3.jpeg'], variants: [{ id: 'vl3', size: 'Único', color: 'Nude', stock: 30 }] },
  { id: 'l4', name: 'Labial Cream 4', sku: 'LAB-04', categoryId: 'Labios', purchasePrice: 4000, salePrice: 8500, imageUrls: ['/uploads/Labiales/4.jpeg'], variants: [{ id: 'vl4', size: 'Único', color: 'Coral', stock: 10 }] },
  { id: 'l5', name: 'Labial Velvet 5', sku: 'LAB-05', categoryId: 'Labios', purchasePrice: 5000, salePrice: 9500, imageUrls: ['/uploads/Labiales/5.jpeg'], variants: [{ id: 'vl5', size: 'Único', color: 'Vino', stock: 5 }] },

  // Perfumes
  { id: 'p1', name: 'Perfume Elegance 1', sku: 'PERF-01', categoryId: 'Perfumes de Mujer', purchasePrice: 30000, salePrice: 55000, imageUrls: ['/uploads/Perfumes/1.jpeg'], variants: [{ id: 'vp1', size: '100ml', color: 'Único', stock: 10 }] },
  { id: 'p2', name: 'Perfume Classic 2', sku: 'PERF-02', categoryId: 'Perfumes de Hombre', purchasePrice: 32000, salePrice: 60000, imageUrls: ['/uploads/Perfumes/2.jpeg'], variants: [{ id: 'vp2', size: '100ml', color: 'Único', stock: 8 }] },
  { id: 'p3', name: 'Perfume Intense 3', sku: 'PERF-03', categoryId: 'Perfumes de Mujer', purchasePrice: 28000, salePrice: 50000, imageUrls: ['/uploads/Perfumes/3.jpeg'], variants: [{ id: 'vp3', size: '50ml', color: 'Único', stock: 12 }] },
  { id: 'p4', name: 'Perfume Night 4', sku: 'PERF-04', categoryId: 'Perfumes de Hombre', purchasePrice: 35000, salePrice: 65000, imageUrls: ['/uploads/Perfumes/4.jpeg'], variants: [{ id: 'vp4', size: '100ml', color: 'Único', stock: 6 }] },
  { id: 'p5', name: 'Perfume Fresh 5', sku: 'PERF-05', categoryId: 'Unisex', purchasePrice: 25000, salePrice: 48000, imageUrls: ['/uploads/Perfumes/5.jpeg'], variants: [{ id: 'vp5', size: '100ml', color: 'Único', stock: 15 }] },
  { id: 'p6', name: 'Perfume Gold 6', sku: 'PERF-06', categoryId: 'Perfumes de Mujer', purchasePrice: 40000, salePrice: 75000, imageUrls: ['/uploads/Perfumes/6.jpeg'], variants: [{ id: 'vp6', size: '50ml', color: 'Único', stock: 4 }] },
  { id: 'p7', name: 'Perfume Sport 7', sku: 'PERF-07', categoryId: 'Perfumes de Hombre', purchasePrice: 27000, salePrice: 49000, imageUrls: ['/uploads/Perfumes/7.jpeg'], variants: [{ id: 'vp7', size: '100ml', color: 'Único', stock: 20 }] },
];

const MOCK_PURCHASES: PurchaseRecord[] = [
  ...MOCK_PRODUCTS.slice(0, 5).flatMap(p => p.variants.map(v => ({
    id: `pch-${p.id}`, date: '2026-05-10T10:00:00Z', productId: p.id, productName: p.name,
    variantId: v.id, size: v.size, color: v.color, quantity: v.stock,
    unitPurchasePrice: p.purchasePrice, totalCost: v.stock * p.purchasePrice
  }))),
  ...MOCK_PRODUCTS.slice(5, 10).flatMap(p => p.variants.map(v => ({
    id: `pch-${p.id}`, date: '2026-06-15T10:00:00Z', productId: p.id, productName: p.name,
    variantId: v.id, size: v.size, color: v.color, quantity: v.stock,
    unitPurchasePrice: p.purchasePrice, totalCost: v.stock * p.purchasePrice
  }))),
  ...MOCK_PRODUCTS.slice(10, 17).flatMap(p => p.variants.map(v => ({
    id: `pch-${p.id}`, date: '2026-07-02T10:00:00Z', productId: p.id, productName: p.name,
    variantId: v.id, size: v.size, color: v.color, quantity: v.stock,
    unitPurchasePrice: p.purchasePrice, totalCost: v.stock * p.purchasePrice
  })))
];

const MOCK_SALES: SaleRecord[] = [
  { id: 's-mock-1', ticketId: 'TICK-MOCK-1', date: '2026-05-20T14:30:00Z', productId: 'p1', productName: 'Perfume Elegance 1', variantId: 'vp1', size: '100ml', color: 'Único', clientName: 'María Gómez', clientPhone: '1123456789', quantity: 2, unitSalePrice: 55000, revenue: 110000, status: 'Pagada' },
  { id: 's-mock-2', ticketId: 'TICK-MOCK-2', date: '2026-06-10T11:00:00Z', productId: 'l1', productName: 'Labial Matte 1', variantId: 'vl1', size: 'Único', color: 'Rojo', clientName: 'Consumidor Final', clientPhone: '', quantity: 1, unitSalePrice: 8500, revenue: 8500, status: 'Pagada' },
  { id: 's-mock-3', ticketId: 'TICK-MOCK-3', date: '2026-06-25T16:15:00Z', productId: 'b1', productName: 'Body Splash Tropical 1', variantId: 'vb1', size: '200ml', color: 'Único', clientName: 'Juan Perez', clientPhone: '', quantity: 3, unitSalePrice: 12000, revenue: 36000, status: 'Pagada' },
];

export const useStockFlowStore = create<StockFlowState>()(
  persist(
    (set) => ({
      globalMarkupPrc: 50,
      wholesaleConfig: { minQuantity: 3, discountPercentage: 15 },
      products: MOCK_PRODUCTS,
      purchases: MOCK_PURCHASES,
      sales: MOCK_SALES,
      categoriesConfig: CATEGORIAS_PERFUMERIA,
      variantGroupsConfig: DEFAULT_VARIANT_GROUPS,

      setGlobalMarkup: (prc) => set({ globalMarkupPrc: prc }),
      setWholesaleConfig: (cfg) => set({ wholesaleConfig: cfg }),
      setCategoriesConfig: (cfg) => set({ categoriesConfig: cfg }),
      setVariantGroupsConfig: (cfg) => set({ variantGroupsConfig: cfg }),

      registerPurchases: (newPurchases) => {
        set((state) => {
          const updatedProducts = JSON.parse(JSON.stringify(state.products)) as Product[];
          const newPurchaseRecords: PurchaseRecord[] = [];

          newPurchases.forEach(purchase => {
            let targetProductId = purchase.productId;
            let targetProductName = purchase.newProductName || 'Producto Desconocido';
            let targetVariantId = Math.random().toString(36).substr(2, 9);

            if (purchase.productId.startsWith('NEW-')) {
              const existingIndex = updatedProducts.findIndex(p => p.id === purchase.productId);

              if (existingIndex !== -1) {
                  const prod = updatedProducts[existingIndex];
                  // Append variant to the product created in this session
                  prod.variants.push({
                      id: targetVariantId, size: purchase.size, color: purchase.color, stock: purchase.quantity
                  });
              } else {
                  updatedProducts.push({
                    id: purchase.productId,
                    name: purchase.newProductName!,
                    sku: purchase.newProductSku || '',
                    categoryId: purchase.categoryId,
                    imageUrls: purchase.newProductImageUrls || [],
                    purchasePrice: purchase.unitPurchasePrice,
                    salePrice: purchase.manualSalePrice,
                    variants: [
                        { id: targetVariantId, size: purchase.size, color: purchase.color, stock: purchase.quantity }
                    ]
                  });
              }
            } else {
              // Update existing product
              const productIndex = updatedProducts.findIndex(p => p.id === purchase.productId);
              if (productIndex !== -1) {
                const prod = updatedProducts[productIndex];
                targetProductName = prod.name;
                prod.purchasePrice = purchase.unitPurchasePrice;
                prod.salePrice = purchase.manualSalePrice;
                
                // Find if variant exists
                const varIndex = prod.variants.findIndex(v => v.size === purchase.size && v.color === purchase.color);
                if (varIndex !== -1) {
                    prod.variants[varIndex].stock += purchase.quantity;
                    targetVariantId = prod.variants[varIndex].id;
                } else {
                    prod.variants.push({
                        id: targetVariantId, size: purchase.size, color: purchase.color, stock: purchase.quantity
                    });
                }
              }
            }
            
            newPurchaseRecords.push({
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              productId: targetProductId,
              productName: targetProductName,
              variantId: targetVariantId,
              size: purchase.size,
              color: purchase.color,
              quantity: purchase.quantity,
              unitPurchasePrice: purchase.unitPurchasePrice,
              totalCost: purchase.quantity * purchase.unitPurchasePrice
            });
          });

          return {
            products: updatedProducts,
            purchases: [...state.purchases, ...newPurchaseRecords]
          };
        });
      },

      registerSale: (clientName, clientPhone, items, paymentOptions) => {
        const ticketId = 'TICK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        set((state) => {
          const updatedProducts = JSON.parse(JSON.stringify(state.products)) as Product[];
          const newSaleRecords: SaleRecord[] = [];

          items.forEach(item => {
            const productIndex = updatedProducts.findIndex(p => p.id === item.productId);
            let pName = 'Producto Eliminado';
            let pSize = 'N/A';
            let pColor = 'N/A';

            if (productIndex !== -1) {
              pName = updatedProducts[productIndex].name;
              const varIndex = updatedProducts[productIndex].variants.findIndex(v => v.id === item.variantId);
              if(varIndex !== -1) {
                  updatedProducts[productIndex].variants[varIndex].stock -= item.quantity;
                  pSize = updatedProducts[productIndex].variants[varIndex].size;
                  pColor = updatedProducts[productIndex].variants[varIndex].color;
              }
            }

            // Apply Wholesale Discount if applicable
            let unitPrice = item.salePrice;
            if (item.quantity >= state.wholesaleConfig.minQuantity) {
              unitPrice = unitPrice * (1 - state.wholesaleConfig.discountPercentage / 100);
            }

            const itemRevenue = item.quantity * unitPrice;
            const hasPending = paymentOptions ? (paymentOptions.pendingAmount > 0) : false;

            newSaleRecords.push({
              id: Math.random().toString(36).substr(2, 9),
              ticketId,
              date: new Date().toISOString(),
              productId: item.productId,
              productName: pName,
              variantId: item.variantId,
              size: pSize,
              color: pColor,
              clientName,
              clientPhone,
              quantity: item.quantity,
              unitSalePrice: unitPrice,
              revenue: itemRevenue,
              status: hasPending ? 'Pendiente' : 'Pagada',
              paymentType: paymentOptions?.paymentType || 'total',
              paidAmount: paymentOptions ? paymentOptions.paidAmount : itemRevenue,
              pendingAmount: paymentOptions ? paymentOptions.pendingAmount : 0,
              remainingAmount: paymentOptions ? paymentOptions.pendingAmount : 0,
              paymentStatus: paymentOptions ? (paymentOptions.pendingAmount <= 0 ? 'full' : (paymentOptions.paidAmount > 0 ? 'partial' : 'pending')) : 'full',
              installmentsCount: paymentOptions?.installmentsCount || 1,
              installmentMonthlyAmount: (paymentOptions && paymentOptions.installmentsCount && paymentOptions.installmentsCount > 0)
                ? Math.round((paymentOptions.pendingAmount / paymentOptions.installmentsCount) * 100) / 100
                : 0,
              notes: paymentOptions?.notes || ''
            });
          });

          return {
            products: updatedProducts,
            sales: [...state.sales, ...newSaleRecords]
          };
        });
        return ticketId;
      },

      recordSalePayment: (ticketId, amount, note) => {
        set((state) => {
          const updatedSales = state.sales.map(s => {
            if (s.ticketId !== ticketId) return s;
            const currentPending = s.pendingAmount ?? s.remainingAmount ?? 0;
            const currentPaid = s.paidAmount ?? 0;
            const newPaid = currentPaid + amount;
            const newPending = Math.max(0, currentPending - amount);
            const isFullyPaid = newPending <= 0;
            return {
              ...s,
              paidAmount: newPaid,
              pendingAmount: newPending,
              remainingAmount: newPending,
              status: isFullyPaid ? 'Pagada' : 'Pendiente',
              paymentStatus: isFullyPaid ? 'full' : 'partial',
              adminNotes: note ? (s.adminNotes ? `${s.adminNotes} | ${note}` : note) : s.adminNotes
            };
          });
          return { sales: updatedSales };
        });
      },

      markSaleMonthPaid: (ticketId, monthStr) => {
        set((state) => {
          const updatedSales = state.sales.map(s => {
            if (s.ticketId !== ticketId) return s;
            return { ...s, lastNotifiedMonth: monthStr };
          });
          return { sales: updatedSales };
        });
      },

      registerWebSale: (clientName, clientPhone, items, customTicketId) => {
        const ticketId = customTicketId || ('WEB-' + Math.random().toString(36).substr(2, 9).toUpperCase());
        set((state) => {
          const updatedProducts = JSON.parse(JSON.stringify(state.products)) as Product[];
          const newSaleRecords: SaleRecord[] = [];

          items.forEach(item => {
            const productIndex = updatedProducts.findIndex(p => p.id === item.productId);
            let pName = item.productName || 'Producto';
            let pSize = item.size || 'N/A';
            let pColor = item.color || 'N/A';
            let pImage = item.imageUrl || '';

            if (productIndex !== -1) {
              if (!item.productName) pName = updatedProducts[productIndex].name;
              if (!pImage && updatedProducts[productIndex].imageUrls?.length) {
                pImage = updatedProducts[productIndex].imageUrls![0];
              }
              const varIndex = updatedProducts[productIndex].variants.findIndex(v => v.id === item.variantId);
              if(varIndex !== -1) {
                  // Retain / deduct stock immediately
                  updatedProducts[productIndex].variants[varIndex].stock -= item.quantity;
                  if (!item.size) pSize = updatedProducts[productIndex].variants[varIndex].size;
                  if (!item.color) pColor = updatedProducts[productIndex].variants[varIndex].color;
              }
            }

            // Apply Wholesale Discount if applicable
            let unitPrice = item.salePrice;
            if (item.quantity >= state.wholesaleConfig.minQuantity) {
              unitPrice = unitPrice * (1 - state.wholesaleConfig.discountPercentage / 100);
            }

            newSaleRecords.push({
              id: Math.random().toString(36).substr(2, 9),
              ticketId,
              date: new Date().toISOString(),
              productId: item.productId,
              productName: pName,
              variantId: item.variantId,
              size: pSize,
              color: pColor,
              clientName,
              clientPhone,
              quantity: item.quantity,
              unitSalePrice: unitPrice,
              revenue: item.quantity * unitPrice,
              status: 'Pendiente',
              paidAmount: 0,
              remainingAmount: item.quantity * unitPrice,
              paymentStatus: 'pending',
              productImageUrl: pImage
            });
          });

          return {
            products: updatedProducts,
            sales: [...state.sales, ...newSaleRecords]
          };
        });
        return ticketId;
      },

      approveOrderTicket: (ticketId, paidAmount, paymentStatus) => {
        set((state) => {
          const ticketSales = state.sales.filter(s => s.ticketId === ticketId);
          const ticketTotal = ticketSales.reduce((sum, s) => sum + s.revenue, 0);
          const remaining = Math.max(0, ticketTotal - paidAmount);

          const updatedSales = state.sales.map(s => {
            if (s.ticketId === ticketId) {
              return {
                ...s,
                status: 'Pagada' as const,
                paidAmount,
                remainingAmount: remaining,
                paymentStatus,
                confirmationDate: new Date().toISOString()
              };
            }
            return s;
          });

          return { sales: updatedSales };
        });
      },

      rejectOrderTicket: (ticketId) => {
        set((state) => {
          let updatedProducts = JSON.parse(JSON.stringify(state.products)) as Product[];
          const updatedSales = state.sales.map(s => {
            if (s.ticketId === ticketId && s.status !== 'Cancelada') {
              // Restore stock back to the product variant
              const productIndex = updatedProducts.findIndex(p => p.id === s.productId);
              if (productIndex !== -1) {
                const varIndex = updatedProducts[productIndex].variants.findIndex(v => v.id === s.variantId);
                if (varIndex !== -1) {
                  updatedProducts[productIndex].variants[varIndex].stock += s.quantity;
                }
              }
              return { ...s, status: 'Cancelada' as const };
            }
            return s;
          });

          return { products: updatedProducts, sales: updatedSales };
        });
      },

      updateOrderDeliveryStatus: (ticketId, deliveryStatus) => {
        set((state) => {
          const updatedSales = state.sales.map(s => {
            if (s.ticketId === ticketId) {
              return {
                ...s,
                deliveryStatus
              };
            }
            return s;
          });
          return { sales: updatedSales };
        });
      },

      updateOrderDetailsAdmin: (ticketId, updates) => {
        set((state) => {
          const ticketSales = state.sales.filter(s => s.ticketId === ticketId);
          const ticketTotal = ticketSales.reduce((sum, s) => sum + s.revenue, 0);
          const paid = updates.paidAmount !== undefined ? updates.paidAmount : (ticketSales[0]?.paidAmount || 0);
          const remaining = Math.max(0, ticketTotal - paid);

          const updatedSales = state.sales.map(s => {
            if (s.ticketId === ticketId) {
              return {
                ...s,
                ...(updates.status ? { status: updates.status } : {}),
                ...(updates.paymentStatus ? { paymentStatus: updates.paymentStatus } : {}),
                ...(updates.deliveryStatus ? { deliveryStatus: updates.deliveryStatus } : {}),
                ...(updates.adminNotes !== undefined ? { adminNotes: updates.adminNotes } : {}),
                paidAmount: paid,
                remainingAmount: remaining,
              };
            }
            return s;
          });
          return { sales: updatedSales };
        });
      },

      deleteUserOrder: (ticketId) => {
        set((state) => {
          let updatedProducts = JSON.parse(JSON.stringify(state.products)) as Product[];
          const salesForTicket = state.sales.filter(s => s.ticketId === ticketId);
          
          salesForTicket.forEach(s => {
            if (s.status !== 'Cancelada') {
              const productIndex = updatedProducts.findIndex(p => p.id === s.productId);
              if (productIndex !== -1) {
                const varIndex = updatedProducts[productIndex].variants.findIndex(v => v.id === s.variantId);
                if (varIndex !== -1) {
                  updatedProducts[productIndex].variants[varIndex].stock += s.quantity;
                }
              }
            }
          });

          const updatedSales = state.sales.filter(s => s.ticketId !== ticketId);
          return { products: updatedProducts, sales: updatedSales };
        });
      },

      confirmSale: (saleId) => {
        set((state) => {
          // Check if saleId is a ticketId or individual item id
          const targetSale = state.sales.find(s => s.id === saleId || s.ticketId === saleId);
          const targetTicketId = targetSale?.ticketId || saleId;

          const updatedSales = state.sales.map(s => {
            if ((s.id === saleId || s.ticketId === targetTicketId) && s.status === 'Pendiente') {
              return { 
                ...s, 
                status: 'Pagada' as const, 
                paidAmount: s.revenue,
                remainingAmount: 0,
                paymentStatus: 'full' as const,
                confirmationDate: new Date().toISOString() 
              };
            }
            return s;
          });
          return { sales: updatedSales };
        });
      },

      cancelSale: (saleId) => {
        set((state) => {
          let updatedProducts = JSON.parse(JSON.stringify(state.products)) as Product[];
          const targetSale = state.sales.find(s => s.id === saleId || s.ticketId === saleId);
          const targetTicketId = targetSale?.ticketId || saleId;

          const updatedSales = state.sales.map(s => {
            if ((s.id === saleId || s.ticketId === targetTicketId) && s.status === 'Pendiente') {
              // Restore stock
              const productIndex = updatedProducts.findIndex(p => p.id === s.productId);
              if (productIndex !== -1) {
                const varIndex = updatedProducts[productIndex].variants.findIndex(v => v.id === s.variantId);
                if (varIndex !== -1) {
                  updatedProducts[productIndex].variants[varIndex].stock += s.quantity;
                }
              }
              return { ...s, status: 'Cancelada' as const };
            }
            return s;
          });

          return { products: updatedProducts, sales: updatedSales };
        });
      },

      deleteProduct: (productId) => {
        set((state) => ({
             products: state.products.filter(p => p.id !== productId),
             purchases: state.purchases.filter(p => p.productId !== productId),
             sales: state.sales.filter(s => s.productId !== productId)
        }));
      },

      deleteVariant: (productId, variantId) => {
           set((state) => {
               const newProducts = [...state.products];
               const pIdx = newProducts.findIndex(p => p.id === productId);
               if(pIdx !== -1) {
                   newProducts[pIdx] = { 
                     ...newProducts[pIdx], 
                     variants: newProducts[pIdx].variants.filter(v => v.id !== variantId) 
                   };
               }
               return {
                   products: newProducts,
                   purchases: state.purchases.filter(p => p.variantId !== variantId),
                   sales: state.sales.filter(s => s.variantId !== variantId)
               };
           });
      },

      updateProduct: (productId, data, variants) => {
         set((state) => {
            const newProducts = [...state.products];
            let newPurchases = [...state.purchases];
            const pIdx = newProducts.findIndex(p => p.id === productId);
            
            if(pIdx !== -1) {
              const oldProduct = newProducts[pIdx];
              
              if (variants) {
                  variants.forEach(newVar => {
                      const oldVar = oldProduct.variants.find(v => v.id === newVar.id);
                      if (oldVar) {
                          const diff = newVar.stock - oldVar.stock;
                          if (diff !== 0) {
                              // Generar ajuste en finanzas
                              newPurchases.push({
                                  id: 'adj-' + Math.random().toString(36).substr(2, 9),
                                  date: new Date().toISOString(),
                                  productId: oldProduct.id,
                                  productName: data.name || oldProduct.name,
                                  variantId: newVar.id,
                                  size: newVar.size,
                                  color: newVar.color,
                                  quantity: diff, // Can be negative (refund) or positive (expense)
                                  unitPurchasePrice: data.purchasePrice !== undefined ? data.purchasePrice : oldProduct.purchasePrice,
                                  totalCost: diff * (data.purchasePrice !== undefined ? data.purchasePrice : oldProduct.purchasePrice)
                              });
                          }
                      } else {
                          // Es una variante totalmente nueva
                          newPurchases.push({
                              id: 'pch-' + Math.random().toString(36).substr(2, 9),
                              date: new Date().toISOString(),
                              productId: oldProduct.id,
                              productName: data.name || oldProduct.name,
                              variantId: newVar.id,
                              size: newVar.size,
                              color: newVar.color,
                              quantity: newVar.stock,
                              unitPurchasePrice: data.purchasePrice !== undefined ? data.purchasePrice : oldProduct.purchasePrice,
                              totalCost: newVar.stock * (data.purchasePrice !== undefined ? data.purchasePrice : oldProduct.purchasePrice)
                          });
                      }
                  });
              }

              newProducts[pIdx] = { ...newProducts[pIdx], ...data };
              if (variants) {
                newProducts[pIdx].variants = variants;
              }
            }
            
            if(data.purchasePrice !== undefined) {
               newPurchases = newPurchases.map(p => 
                  p.productId === productId ? { ...p, unitPurchasePrice: data.purchasePrice!, totalCost: p.quantity * data.purchasePrice! } : p
               );
            }
            
            let newSales = state.sales;
            if(data.salePrice !== undefined) {
               newSales = newSales.map(s => 
                  s.productId === productId ? { ...s, unitSalePrice: data.salePrice!, revenue: s.quantity * data.salePrice! } : s
               );
            }

            return { products: newProducts, purchases: newPurchases, sales: newSales };
         });
      },

      importData: (data: any) => {
          set((state) => ({
              globalMarkupPrc: data.globalMarkupPrc ?? state.globalMarkupPrc,
              wholesaleConfig: data.wholesaleConfig ?? state.wholesaleConfig,
              products: data.products ?? state.products,
              purchases: data.purchases ?? state.purchases,
              sales: data.sales ?? state.sales
          }));
      }
    }),
    {
      name: 'perfumeria-data-v5',
    }
  )
);
