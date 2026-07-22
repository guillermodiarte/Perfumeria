import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CATEGORIAS_PERFUMERIA = [
  {
    grupo: "Perfumería",
    opciones: ["Perfumes de Mujer", "Perfumes de Hombre", "Unisex", "Body Splash", "Set de Regalo"]
  },
  {
    grupo: "Maquillaje",
    opciones: ["Ojos", "Labios", "Rostro", "Paletas", "Brochas y Accesorios"]
  },
  {
    grupo: "Cuidado de la Piel",
    opciones: ["Limpieza Facial", "Hidratación", "Tratamiento Anti-age", "Protectores Solares"]
  },
  {
    grupo: "Cuidado Personal",
    opciones: ["Cuidado Capilar", "Higiene Corporal", "Desodorantes"]
  },
  {
    grupo: "Accesorios",
    opciones: ["Collares y Cadenas", "Anillos", "Aros", "Pulseras y Esclavas", "Relojes"]
  }
];

export const TABLA_PRESENTACION_PERFUMES = [
  { ML: "30ml", TIPO: "Travel Size" },
  { ML: "50ml", TIPO: "Estándar" },
  { ML: "75ml", TIPO: "Mediano" },
  { ML: "100ml", TIPO: "Grande" },
  { ML: "150ml", TIPO: "Extra Grande" },
  { ML: "200ml", TIPO: "Familiar" }
];

export const TABLA_TALLES_ACCESORIOS = [
  { TALLE: "Único", DESC: "Ajustable o Estándar" },
  { TALLE: "S", DESC: "Pequeño" },
  { TALLE: "M", DESC: "Mediano" },
  { TALLE: "L", DESC: "Grande" }
];

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
  confirmationDate?: string;
}

export interface StockFlowState {
  globalMarkupPrc: number;
  products: Product[];
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  wholesaleConfig: { minQuantity: number; discountPercentage: number };
  
  setGlobalMarkup: (percentage: number) => void;
  setWholesaleConfig: (config: { minQuantity: number; discountPercentage: number }) => void;
  
  registerPurchases: (newPurchases: {
    productId: string | 'NEW';
    newProductName?: string;
    newProductSku?: string;
    newProductImageUrls?: string[];
    categoryId: string;
    size: string;
    color: string;
    quantity: number;
    unitPurchasePrice: number;
    manualSalePrice: number;
  }[]) => void;

  registerSale: (clientName: string, clientPhone: string, items: { 
    productId: string; 
    variantId: string; 
    quantity: number; 
    salePrice: number 
  }[]) => string;

  registerWebSale: (clientName: string, clientPhone: string, items: { 
    productId: string; 
    variantId: string; 
    quantity: number; 
    salePrice: number 
  }[]) => string;

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
  { id: 's-mock-4', ticketId: 'TICK-MOCK-4', date: '2026-07-05T09:45:00Z', productId: 'p3', productName: 'Perfume Intense 3', variantId: 'vp3', size: '50ml', color: 'Único', clientName: 'Ana Ruiz', clientPhone: '', quantity: 1, unitSalePrice: 50000, revenue: 50000, status: 'Pagada' },
];

export const useStockFlowStore = create<StockFlowState>()(
  persist(
    (set) => ({
      globalMarkupPrc: 50, // 50% por defecto
      wholesaleConfig: { minQuantity: 6, discountPercentage: 10 },
      products: MOCK_PRODUCTS,
      purchases: MOCK_PURCHASES,
      sales: MOCK_SALES,

      setGlobalMarkup: (percentage) => set({ globalMarkupPrc: percentage }),
      setWholesaleConfig: (config) => set({ wholesaleConfig: config }),

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

      registerSale: (clientName, clientPhone, items) => {
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
              status: 'Pagada'
            });
          });

          return {
            products: updatedProducts,
            sales: [...state.sales, ...newSaleRecords]
          };
        });
        return ticketId;
      },

      registerWebSale: (clientName, clientPhone, items) => {
        const ticketId = 'WEB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
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
                  // Deduct stock immediately
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
              status: 'Pendiente'
            });
          });

          return {
            products: updatedProducts,
            sales: [...state.sales, ...newSaleRecords]
          };
        });
        return ticketId;
      },

      confirmSale: (saleId) => {
        set((state) => {
          const updatedSales = state.sales.map(s => {
            if (s.id === saleId && s.status === 'Pendiente') {
              return { ...s, status: 'Pagada', confirmationDate: new Date().toISOString() };
            }
            return s;
          });
          return { sales: updatedSales };
        });
      },

      cancelSale: (saleId) => {
        set((state) => {
          let updatedProducts = [...state.products];
          let updatedSales = [...state.sales];

          const saleIndex = updatedSales.findIndex(s => s.id === saleId);
          if (saleIndex !== -1 && updatedSales[saleIndex].status === 'Pendiente') {
            const sale = updatedSales[saleIndex];
            // Restore stock
            const productIndex = updatedProducts.findIndex(p => p.id === sale.productId);
            if (productIndex !== -1) {
              updatedProducts = JSON.parse(JSON.stringify(updatedProducts));
              const varIndex = updatedProducts[productIndex].variants.findIndex(v => v.id === sale.variantId);
              if (varIndex !== -1) {
                updatedProducts[productIndex].variants[varIndex].stock += sale.quantity;
              }
            }
            
            updatedSales[saleIndex] = { ...sale, status: 'Cancelada' };
          }

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
            const pIdx = newProducts.findIndex(p => p.id === productId);
            if(pIdx !== -1) {
              newProducts[pIdx] = { ...newProducts[pIdx], ...data };
              if (variants) {
                newProducts[pIdx].variants = variants;
              }
            }
            
            let newPurchases = state.purchases;
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
