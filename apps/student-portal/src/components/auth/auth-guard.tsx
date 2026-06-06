'use client';

import { useEffect } from 'react';
import { useAuthStore, useAuthHydrated } from '@shared/hooks';
import { useRouter, usePathname } from '@/i18n/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthHydrated();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isAuthenticated, router, pathname]);

  // Wait for the auth store to hydrate from sessionStorage before deciding.
  // On a full reload (F5) the first render sees the un-hydrated default state
  // (isAuthenticated = false); redirecting then would bounce an authenticated
  // user to /login and onward to the homepage.
  if (!hydrated || !isAuthenticated) return null;
  return <>{children}</>;
}
