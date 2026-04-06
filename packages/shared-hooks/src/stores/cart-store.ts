'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_KEY = 'sslm-cart';

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface CartItem {
  courseId: string;
  title: string;
  instructorName: string;
  thumbnailUrl: string;
  price: number;
  type: 'FULL_COURSE' | 'CHAPTER';
  chapterId?: string;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
  addItem: (item: CartItem) => void;
  removeItem: (courseId: string, chapterId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  syncWithServer: (serverItems: CartItem[]) => void;
  subtotal: () => number;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      discount: 0,

      addItem: (item) => {
        const exists = get().items.some(
          (i) => i.courseId === item.courseId && i.chapterId === item.chapterId,
        );
        if (!exists) {
          set((s) => ({ items: [...s.items, item] }));
        }
      },

      removeItem: (courseId, chapterId) =>
        set((s) => ({
          items: s.items.filter((i) => !(i.courseId === courseId && i.chapterId === chapterId)),
        })),

      clearCart: () => set({ items: [], couponCode: null, discount: 0 }),

      applyCoupon: (code, discount) => set({ couponCode: code, discount }),

      removeCoupon: () => set({ couponCode: null, discount: 0 }),

      syncWithServer: (serverItems) => set({ items: serverItems }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.price, 0),

      total: () => Math.max(0, get().subtotal() - get().discount),

      itemCount: () => get().items.length,
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : window.localStorage,
      ),
    },
  ),
);

// Cross-tab sync: update local state when another tab modifies the cart
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as {
        state?: { items?: CartItem[]; couponCode?: string | null; discount?: number };
      };
      if (!parsed.state) return;
      useCartStore.setState({
        items: parsed.state.items ?? [],
        couponCode: parsed.state.couponCode ?? null,
        discount: parsed.state.discount ?? 0,
      });
    } catch {
      // ignore malformed storage payloads
    }
  });
}
