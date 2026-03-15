'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from './stores/auth-store';

/**
 * Returns true once the auth store has finished hydrating from sessionStorage.
 * Use this to avoid rendering auth-dependent UI before hydration completes,
 * which prevents a flash of guest UI on page refresh.
 */
export function useAuthHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false, // Server snapshot — always false during SSR
  );
}
