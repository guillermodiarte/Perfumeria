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
      'Perfumes de Hombre',
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
  unitPurchasePrice?: number;  // Costo de compra por variante
  manualSalePrice?: number;    // Precio de venta por variante
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
  // Descriptive / marketing fields
  description?: string;        // Descripción premium del producto
  tag?: string;                // Insignia: 'Alta Demanda', 'Recomendado', 'Nuevo', 'Edición Limitada', 'Más Vendido', 'Oferta'
  showTag?: boolean;           // Mostrar u ocultar la insignia en la tienda
  // Olfactory / feature attributes
  olfactoryNotes?: string;     // Ej: 'Cítricas, Florales'
  duration?: string;           // Ej: 'Alta (+8 horas)'
  intensity?: string;          // Ej: 'Moderada - Fuerte'
  family?: string;             // Ej: 'Amaderada Especiada'
  showFeatures?: boolean;      // Mostrar u ocultar el bloque de especificaciones en la tienda
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
    // New descriptive / feature fields
    description?: string;
    tag?: string;
    showTag?: boolean;
    olfactoryNotes?: string;
    duration?: string;
    intensity?: string;
    family?: string;
    showFeatures?: boolean;
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

// Initial Mock Data with Variants
// Initial Authentic Perfumes Catalog
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p-asad-zanzibar',
    name: 'Lattafa Asad Zanzibar Eau De Parfum 100ml',
    sku: 'LAT-ZAN-100',
    categoryId: 'Perfumes de Hombre',
    targetGender: 'Hombre',
    purchasePrice: 42000,
    salePrice: 68000,
    imageUrls: ['/uploads/Perfumes/1.webp'],
    variants: [{ id: 'v-p1', size: '100ml', color: 'Azul', stock: 10 }]
  },
  {
    id: 'p-surprise',
    name: 'Mega Collection Surprise Eau De Parfum 100ml',
    sku: 'MC-SUR-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 28000,
    salePrice: 45000,
    imageUrls: ['/uploads/Perfumes/26.webp'],
    variants: [{ id: 'v-p2', size: '100ml', color: 'Rosa', stock: 10 }]
  },
  {
    id: 'p-yara-tous',
    name: 'Lattafa Yara Tous Eau De Parfum 100ml',
    sku: 'LAT-TOUS-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 38000,
    salePrice: 62000,
    imageUrls: ['/uploads/Perfumes/3.webp'],
    variants: [{ id: 'v-p3', size: '100ml', color: 'Amarillo Mango', stock: 10 }]
  },
  {
    id: 'p-eclaire',
    name: 'Lattafa Eclaire Eau De Parfum 100ml',
    sku: 'LAT-ECL-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 45000,
    salePrice: 75000,
    imageUrls: ['/uploads/Perfumes/4.webp'],
    variants: [{ id: 'v-p4', size: '100ml', color: 'Dorado Caramelo', stock: 10 }]
  },
  {
    id: 'p-drive-for-man',
    name: 'Mega Collection Drive For Man Parfum 100ml',
    sku: 'MC-DRV-100',
    categoryId: 'Perfumes de Hombre',
    targetGender: 'Hombre',
    purchasePrice: 30000,
    salePrice: 48000,
    imageUrls: ['/uploads/Perfumes/5.webp'],
    variants: [{ id: 'v-p5', size: '100ml', color: 'Negro', stock: 10 }]
  },
  {
    id: 'p-karseell-oil',
    name: 'Karseell Maca Essence Oil 50ml',
    sku: 'KARS-OIL-50',
    categoryId: 'Cuidado Capilar',
    targetGender: 'Unisex',
    purchasePrice: 15000,
    salePrice: 24000,
    imageUrls: ['/uploads/Perfumes/6.webp'],
    variants: [{ id: 'v-p6', size: '50ml', color: 'Ámbar', stock: 10 }]
  },
  {
    id: 'p-layalina',
    name: 'Ard Al Zaafaran Layalina Eau De Parfum 100ml',
    sku: 'AAZ-LAY-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 34000,
    salePrice: 55000,
    imageUrls: ['/uploads/Perfumes/7.webp'],
    variants: [{ id: 'v-p7', size: '100ml', color: 'Dorado', stock: 10 }]
  },
  {
    id: 'p-ajmal-bloom',
    name: 'Ard Al Zaafaran Ajmal Ehsaas Bloom 100ml',
    sku: 'AAZ-BLOOM-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 32000,
    salePrice: 52000,
    imageUrls: ['/uploads/Perfumes/8.webp'],
    variants: [{ id: 'v-p8', size: '100ml', color: 'Blanco Floral', stock: 10 }]
  },
  {
    id: 'p-karseell-set',
    name: 'Karseell Maca Essence Repair Travel Set',
    sku: 'KARS-SET-TRV',
    categoryId: 'Set de Regalo',
    targetGender: 'Unisex',
    purchasePrice: 26000,
    salePrice: 42000,
    imageUrls: ['/uploads/Perfumes/9.webp'],
    variants: [{ id: 'v-p9', size: 'Travel Set', color: 'Dorado', stock: 10 }]
  },
  {
    id: 'p-asad-bourbon',
    name: 'Lattafa Asad Bourbon Eau De Parfum 100ml',
    sku: 'LAT-BRB-100',
    categoryId: 'Perfumes de Hombre',
    targetGender: 'Hombre',
    purchasePrice: 44000,
    salePrice: 72000,
    imageUrls: ['/uploads/Perfumes/10.webp'],
    variants: [{ id: 'v-p10', size: '100ml', color: 'Marrón Bourbon', stock: 10 }]
  },
  {
    id: 'p-pure-seduction',
    name: "Victoria's Secret Pure Seduction Mist 250ml",
    sku: 'VS-SED-250',
    categoryId: 'Body Splash / Body Mist',
    targetGender: 'Mujer',
    purchasePrice: 20000,
    salePrice: 35000,
    imageUrls: ['/uploads/Perfumes/11.webp'],
    variants: [{ id: 'v-p11', size: '250ml', color: 'Rojo Pasión', stock: 10 }]
  },
  {
    id: 'p-yara-moi',
    name: 'Lattafa Yara Moi Eau De Parfum 100ml',
    sku: 'LAT-MOI-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 38000,
    salePrice: 62000,
    imageUrls: ['/uploads/Perfumes/12.webp'],
    variants: [{ id: 'v-p12', size: '100ml', color: 'Blanco Caramelo', stock: 10 }]
  },
  {
    id: 'p-yara-elixir',
    name: 'Lattafa Yara Elixir Eau De Parfum 100ml',
    sku: 'LAT-ELX-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 42000,
    salePrice: 69000,
    imageUrls: ['/uploads/Perfumes/13.webp'],
    variants: [{ id: 'v-p13', size: '100ml', color: 'Rose Gold', stock: 10 }]
  },
  {
    id: 'p-yara-pink',
    name: 'Lattafa Yara Pink Eau De Parfum 100ml',
    sku: 'LAT-YARA-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 37000,
    salePrice: 60000,
    imageUrls: [
      '/uploads/Perfumes/14.webp',
      '/uploads/Perfumes/22.webp'
    ],
    variants: [{ id: 'v-p14', size: '100ml', color: 'Rosa Pastel', stock: 10 }]
  },
  {
    id: 'p-yara-candy',
    name: 'Lattafa Yara Candy Eau De Parfum 100ml',
    sku: 'LAT-CND-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 42000,
    salePrice: 69000,
    imageUrls: ['/uploads/Perfumes/21.webp'],
    variants: [{ id: 'v-p21', size: '100ml', color: 'Rojo Carmesí', stock: 10 }]
  },
  {
    id: 'p-bad-femme',
    name: 'Maison Alhambra B.A.D Femme Eau De Parfum 100ml',
    sku: 'MA-BAD-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 35000,
    salePrice: 58000,
    imageUrls: ['/uploads/Perfumes/15.webp'],
    variants: [{ id: 'v-p15', size: '100ml', color: 'Negro & Dorado', stock: 10 }]
  },
  {
    id: 'p-shams-pink',
    name: 'Ard Al Zaafaran Shams Al Emarat Pink Blush 100ml',
    sku: 'AAZ-SHAMS-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 33000,
    salePrice: 54000,
    imageUrls: ['/uploads/Perfumes/17.webp'],
    variants: [{ id: 'v-p16', size: '100ml', color: 'Rosa Rubor', stock: 10 }]
  },
  {
    id: 'p-vogue-night',
    name: 'Maison Alhambra Vogue Night Eau De Parfum 100ml',
    sku: 'MA-VOG-100',
    categoryId: 'Perfumes de Hombre',
    targetGender: 'Hombre',
    purchasePrice: 34000,
    salePrice: 56000,
    imageUrls: ['/uploads/Perfumes/18.webp'],
    variants: [{ id: 'v-p17', size: '100ml', color: 'Negro Noche', stock: 10 }]
  },
  {
    id: 'p-petra',
    name: 'Lattafa Petra Eau De Parfum 100ml',
    sku: 'LAT-PET-100',
    categoryId: 'Unisex',
    targetGender: 'Unisex',
    purchasePrice: 40000,
    salePrice: 65000,
    imageUrls: ['/uploads/Perfumes/19.webp'],
    variants: [{ id: 'v-p18', size: '100ml', color: 'Marfil & Oro', stock: 10 }]
  },
  {
    id: 'p-cristalite-pink',
    name: 'Mega Collection Cristalite Pink Crystal 100ml',
    sku: 'MC-CRIS-100',
    categoryId: 'Perfumes de Mujer',
    targetGender: 'Mujer',
    purchasePrice: 28000,
    salePrice: 46000,
    imageUrls: ['/uploads/Perfumes/20.webp'],
    variants: [{ id: 'v-p19', size: '100ml', color: 'Cristal Rosa', stock: 10 }]
  },
  {
    id: 'p-khamrah',
    name: 'Lattafa Khamrah Eau De Parfum 100ml',
    sku: 'LAT-KHM-100',
    categoryId: 'Unisex',
    targetGender: 'Unisex',
    purchasePrice: 48000,
    salePrice: 78000,
    imageUrls: ['/uploads/Perfumes/24.webp'],
    variants: [{ id: 'v-p20', size: '100ml', color: 'Ámbar Cristal', stock: 10 }]
  }
];

const MOCK_PURCHASES: PurchaseRecord[] = MOCK_PRODUCTS.flatMap(p => p.variants.map(v => ({
  id: `pch-${p.id}`,
  date: '2026-09-14T10:00:00Z',
  productId: p.id,
  productName: p.name,
  variantId: v.id,
  size: v.size,
  color: v.color,
  quantity: v.stock,
  unitPurchasePrice: p.purchasePrice,
  totalCost: v.stock * p.purchasePrice
})));

const MOCK_SALES: SaleRecord[] = [];

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
          const newProductMap = new Map<string, Product>();

          newPurchases.forEach(purchase => {
            let targetProductId = purchase.productId;
            let targetProductName = purchase.newProductName?.trim() || 'Producto';
            let targetVariantId = Math.random().toString(36).substr(2, 9);

            // 1. Check if this purchase belongs to a new product already created in this current batch
            let existingProd: Product | undefined;
            if (purchase.productId && newProductMap.has(purchase.productId)) {
              existingProd = newProductMap.get(purchase.productId);
            }

            // 2. Check if product exists in updatedProducts by ID (if not a temporary 'NEW' ID)
            if (!existingProd && purchase.productId && !purchase.productId.startsWith('NEW')) {
              existingProd = updatedProducts.find(p => p.id === purchase.productId);
            }

            // 3. Check if product exists by Name (case-insensitive)
            if (!existingProd && purchase.newProductName?.trim()) {
              existingProd = updatedProducts.find(
                p => p.name.trim().toLowerCase() === purchase.newProductName!.trim().toLowerCase()
              );
            }

            if (existingProd) {
              // --- PRODUCT ALREADY EXISTS (OR CREATED IN BATCH) ---
              targetProductId = existingProd.id;
              targetProductName = existingProd.name;

              // Update prices to latest purchase/sale price
              if (purchase.unitPurchasePrice !== undefined) {
                existingProd.purchasePrice = Number(purchase.unitPurchasePrice) || 0;
              }
              if (purchase.manualSalePrice !== undefined) {
                existingProd.salePrice = Number(purchase.manualSalePrice) || 0;
              }

              // Update category, sku, gender if provided
              if (purchase.categoryId) existingProd.categoryId = purchase.categoryId;
              if (purchase.newProductSku) existingProd.sku = purchase.newProductSku;
              if (purchase.targetGender) existingProd.targetGender = purchase.targetGender;

              // Update descriptive/feature fields if provided
              if (purchase.description !== undefined) existingProd.description = purchase.description;
              if (purchase.tag !== undefined) existingProd.tag = purchase.tag;
              if (purchase.showTag !== undefined) existingProd.showTag = purchase.showTag;
              if (purchase.olfactoryNotes !== undefined) existingProd.olfactoryNotes = purchase.olfactoryNotes;
              if (purchase.duration !== undefined) existingProd.duration = purchase.duration;
              if (purchase.intensity !== undefined) existingProd.intensity = purchase.intensity;
              if (purchase.family !== undefined) existingProd.family = purchase.family;
              if (purchase.showFeatures !== undefined) existingProd.showFeatures = purchase.showFeatures;

              // Append new images if any
              if (purchase.newProductImageUrls && purchase.newProductImageUrls.length > 0) {
                const currentImages = existingProd.imageUrls || [];
                const mergedImages = Array.from(new Set([...currentImages, ...purchase.newProductImageUrls]));
                existingProd.imageUrls = mergedImages;
              }

              // Check if variant with same size & color exists
              const pSize = (purchase.size || 'Único').trim().toLowerCase();
              const pColor = (purchase.color || '').trim().toLowerCase();

              const varIndex = existingProd.variants.findIndex(
                v => (v.size || 'Único').trim().toLowerCase() === pSize && (v.color || '').trim().toLowerCase() === pColor
              );

              if (varIndex !== -1) {
                existingProd.variants[varIndex].stock += Number(purchase.quantity) || 0;
                // Update per-variant price if provided
                if (purchase.unitPurchasePrice !== undefined) {
                  existingProd.variants[varIndex].unitPurchasePrice = Number(purchase.unitPurchasePrice) || 0;
                }
                if (purchase.manualSalePrice !== undefined) {
                  existingProd.variants[varIndex].manualSalePrice = Number(purchase.manualSalePrice) || 0;
                }
                targetVariantId = existingProd.variants[varIndex].id;
              } else {
                targetVariantId = Math.random().toString(36).substr(2, 9);
                existingProd.variants.push({
                  id: targetVariantId,
                  size: purchase.size || 'Único',
                  color: purchase.color || '',
                  stock: Number(purchase.quantity) || 0,
                  unitPurchasePrice: Number(purchase.unitPurchasePrice) || 0,
                  manualSalePrice: Number(purchase.manualSalePrice) || 0,
                });
              }
            } else {
              // --- COMPLETELY NEW PRODUCT ---
              const createdProductId = 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
              targetProductId = createdProductId;
              targetProductName = purchase.newProductName?.trim() || 'Nuevo Producto';
              targetVariantId = Math.random().toString(36).substr(2, 9);

              const newProduct: Product = {
                id: createdProductId,
                name: targetProductName,
                sku: purchase.newProductSku || '',
                categoryId: purchase.categoryId || 'Perfumes de Mujer',
                targetGender: purchase.targetGender || 'Unisex',
                purchasePrice: Number(purchase.unitPurchasePrice) || 0,
                salePrice: Number(purchase.manualSalePrice) || 0,
                imageUrls: purchase.newProductImageUrls || [],
                description: purchase.description,
                tag: purchase.tag,
                showTag: purchase.showTag,
                olfactoryNotes: purchase.olfactoryNotes,
                duration: purchase.duration,
                intensity: purchase.intensity,
                family: purchase.family,
                showFeatures: purchase.showFeatures,
                variants: [
                  {
                    id: targetVariantId,
                    size: purchase.size || 'Único',
                    color: purchase.color || '',
                    stock: Number(purchase.quantity) || 0,
                    unitPurchasePrice: Number(purchase.unitPurchasePrice) || 0,
                    manualSalePrice: Number(purchase.manualSalePrice) || 0,
                  }
                ]

              };

              updatedProducts.push(newProduct);

              // Map temporary ID and name so subsequent variants in the same batch attach to this product
              if (purchase.productId) {
                newProductMap.set(purchase.productId, newProduct);
              }
              if (purchase.newProductName?.trim()) {
                newProductMap.set(purchase.newProductName.trim().toLowerCase(), newProduct);
              }
            }

            // Create purchase history record
            newPurchaseRecords.push({
              id: 'pch-' + Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              productId: targetProductId,
              productName: targetProductName,
              variantId: targetVariantId,
              size: purchase.size || 'Único',
              color: purchase.color || '',
              quantity: Number(purchase.quantity) || 0,
              unitPurchasePrice: Number(purchase.unitPurchasePrice) || 0,
              totalCost: (Number(purchase.quantity) || 0) * (Number(purchase.unitPurchasePrice) || 0)
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
      name: 'perfumeria-data-v8',
      onRehydrateStorage: () => (state) => {
        if (!state || !Array.isArray(state.purchases) || !Array.isArray(state.products)) return;
        const existingProducts = [...state.products];
        let hasChanges = false;

        state.purchases.forEach(pch => {
          if (!pch.productName || pch.quantity <= 0) return;
          const found = existingProducts.find(
            p => p.id === pch.productId || p.name.trim().toLowerCase() === pch.productName.trim().toLowerCase()
          );
          if (!found) {
            hasChanges = true;
            const newId = pch.productId && !pch.productId.startsWith('NEW') ? pch.productId : 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            existingProducts.push({
              id: newId,
              name: pch.productName,
              sku: '',
              categoryId: 'Perfumes de Mujer',
              targetGender: 'Unisex',
              purchasePrice: pch.unitPurchasePrice || 0,
              salePrice: Number(((pch.unitPurchasePrice || 0) * 1.5).toFixed(2)) || 0,
              variants: [
                {
                  id: pch.variantId || Math.random().toString(36).substr(2, 9),
                  size: pch.size || 'Único',
                  color: pch.color || '',
                  stock: pch.quantity || 1
                }
              ]
            });
          }
        });

        if (hasChanges) {
          useStockFlowStore.setState({ products: existingProducts });
        }
      }
    }
  )
);
