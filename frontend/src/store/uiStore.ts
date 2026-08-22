'use client';

import { create } from 'zustand';

interface UiState {
  toast: { message: string; tone: 'success' | 'info' | 'error' } | null;
  showToast: (
    message: string,
    tone?: 'success' | 'info' | 'error',
  ) => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message, tone = 'success') => {
    set({ toast: { message, tone } });
    window.setTimeout(() => set({ toast: null }), 2200);
  },
  clearToast: () => set({ toast: null }),
}));
