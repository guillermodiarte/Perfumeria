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
    id: 'talles_ropa',
    name: 'Talles de Ropa Deportiva',
    options: [
      { value: 'XS', description: 'Extra Small' },
      { value: 'S', description: 'Small' },
      { value: 'M', description: 'Medium' },
      { value: 'L', description: 'Large' },
      { value: 'XL', description: 'Extra Large' },
      { value: 'XXL', description: 'Doble Extra Large' }
    ]
  },
  {
    id: 'calzado',
    name: 'Talles de Calzado',
    options: [
      { value: '38', description: '38 AR' },
      { value: '39', description: '39 AR' },
      { value: '40', description: '40 AR' },
      { value: '41', description: '41 AR' },
      { value: '42', description: '42 AR' },
      { value: '43', description: '43 AR' },
      { value: '44', description: '44 AR' }
    ]
  },
  {
    id: 'accesorios',
    name: 'Talles / Medidas de Accesorios',
    options: [
      { value: 'Único', description: 'Ajustable o Talle Único' },
      { value: 'Chico', description: 'Medida Pequeña' },
      { value: 'Grande', description: 'Medida Grande' }
    ]
  }
];

export const CATEGORIAS_DEPORTIVAS: CategoryConfig[] = [
  {
    grupo: 'Ropa Deportiva',
    variantGroupId: 'talles_ropa',
    opciones: [
      'Remeras y Musculosas',
      'Calzas y Shorts',
      'Camperas y Buzos',
      'Tops Deportivos',
      'Conjuntos'
    ]
  },
  {
    grupo: 'Accesorios',
    variantGroupId: 'accesorios',
    opciones: [
      'Gorras y Viseras',
      'Botellas y Shakers',
      'Mochilas y Bolsos',
      'Medias y Muñequeras',
      'Equipamiento y Fitness'
    ]
  },
  {
    grupo: 'Calzado',
    variantGroupId: 'calzado',
    opciones: [
      'Zapatillas Running',
      'Zapatillas Training',
      'Ojotas y Sandalias Deportivas'
    ]
  }
];

export const CATEGORIAS_PERFUMERIA: CategoryConfig[] = CATEGORIAS_DEPORTIVAS;

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
  clientEmail?: string;
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
      clientEmail?: string;
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

// Initial Mock Data (Limpiado: Catálogo vacío)
const MOCK_PRODUCTS: Product[] = [];
const MOCK_PURCHASES: PurchaseRecord[] = [];
const MOCK_SALES: SaleRecord[] = [];

export const useStockFlowStore = create<StockFlowState>()(
  persist(
    (set) => ({
      globalMarkupPrc: 50,
      wholesaleConfig: { minQuantity: 3, discountPercentage: 15 },
      products: [],
      purchases: [],
      sales: [],
      categoriesConfig: CATEGORIAS_DEPORTIVAS,
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
              clientEmail: paymentOptions?.clientEmail || '',
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
              status: (isFullyPaid ? 'Pagada' : 'Pendiente') as SaleRecord['status'],
              paymentStatus: (isFullyPaid ? 'full' : 'partial') as SaleRecord['paymentStatus'],
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
      name: 'tienda-deportiva-data-v1',
      onRehydrateStorage: () => () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('perfumeria-data-v8');
            localStorage.removeItem('perfumeria-data-v7');
            localStorage.removeItem('perfumeria-cart-storage');
          } catch (e) {}
        }
      }
    }
  )
);
