import { create } from 'zustand';

interface AuthModalState {
  isOpen: boolean;
  view: 'login' | 'register';
  pendingAction: (() => void) | null;
  openModal: (view?: 'login' | 'register', onComplete?: () => void) => void;
  closeModal: () => void;
  setView: (view: 'login' | 'register') => void;
  executePendingAction: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set, get) => ({
  isOpen: false,
  view: 'login',
  pendingAction: null,
  openModal: (view = 'login', onComplete) => {
    set({
      isOpen: true,
      view,
      pendingAction: onComplete || null
    });
  },
  closeModal: () => set({ isOpen: false }),
  setView: (view) => set({ view }),
  executePendingAction: () => {
    const action = get().pendingAction;
    if (action) {
      action();
      // Clear action after execution
      set({ pendingAction: null });
    }
  }
}));
