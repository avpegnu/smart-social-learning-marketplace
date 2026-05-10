'use client';

import { create } from 'zustand';

const MAX_OPEN_WINDOWS = 2;

export interface ChatWindow {
  conversationId: string;
  minimized: boolean;
}

interface ChatWindowsState {
  openWindows: ChatWindow[];
  openWindow: (conversationId: string) => void;
  closeWindow: (conversationId: string) => void;
  toggleMinimize: (conversationId: string) => void;
  setMinimized: (conversationId: string, minimized: boolean) => void;
  closeAll: () => void;
}

export const useChatWindowsStore = create<ChatWindowsState>((set) => ({
  openWindows: [],

  openWindow: (conversationId) =>
    set((state) => {
      const existing = state.openWindows.find((w) => w.conversationId === conversationId);
      if (existing) {
        const others = state.openWindows.filter((w) => w.conversationId !== conversationId);
        return { openWindows: [{ ...existing, minimized: false }, ...others] };
      }
      const next = [{ conversationId, minimized: false }, ...state.openWindows];
      return { openWindows: next.slice(0, MAX_OPEN_WINDOWS) };
    }),

  closeWindow: (conversationId) =>
    set((state) => ({
      openWindows: state.openWindows.filter((w) => w.conversationId !== conversationId),
    })),

  toggleMinimize: (conversationId) =>
    set((state) => ({
      openWindows: state.openWindows.map((w) =>
        w.conversationId === conversationId ? { ...w, minimized: !w.minimized } : w,
      ),
    })),

  setMinimized: (conversationId, minimized) =>
    set((state) => ({
      openWindows: state.openWindows.map((w) =>
        w.conversationId === conversationId ? { ...w, minimized } : w,
      ),
    })),

  closeAll: () => set({ openWindows: [] }),
}));
