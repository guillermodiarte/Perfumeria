import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: string;
  address?: string;
  province?: string;
  city?: string;
  postal_code?: string;
  email_verified: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => {
        set({ user });
        // Sync cart (requires dynamic import to avoid circular dependency in zustand stores)
        import('./useCartStore').then(({ useCartStore }) => {
          useCartStore.getState().syncUserCart(user.email);
        });
      },
      logout: () => {
        set({ token: null, user: null });
        import('./useCartStore').then(({ useCartStore }) => {
          useCartStore.getState().syncUserCart(null);
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
