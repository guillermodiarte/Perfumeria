import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from './useStockStore';

export interface CartItem {
  product: Product;
  variantId: string;
  size: string;
  color: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  userCarts: Record<string, CartItem[]>;
  addItem: (product: Product, variantId: string, size: string, color: string, quantity: number) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
  clearCart: () => void;
  syncUserCart: (email: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      userCarts: {},
      syncUserCart: (email) => set((state) => {
        const key = email || 'guest';
        // Save current items to previous user
        // But we actually just want to load the new user's cart
        return { items: state.userCarts[key] || [] };
      }),
      addItem: (product, variantId, size, color, quantity) => set((state) => {
        const existingItemIndex = state.items.findIndex(
          (item) => item.product.id === product.id && item.variantId === variantId
        );

        const newItems = [...state.items];
        if (existingItemIndex >= 0) {
          newItems[existingItemIndex].quantity += quantity;
        } else {
          newItems.push({ product, variantId, size, color, quantity });
        }
        
        return { items: newItems };
      }),
      removeItem: (productId, variantId) => set((state) => ({
        items: state.items.filter((item) => !(item.product.id === productId && item.variantId === variantId))
      })),
      updateQuantity: (productId, variantId, quantity) => set((state) => ({
        items: state.items.map((item) => 
          item.product.id === productId && item.variantId === variantId 
            ? { ...item, quantity } 
            : item
        )
      })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'perfumeria-cart-storage',
    }
  )
);
