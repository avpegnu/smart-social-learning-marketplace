'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@shared/hooks';
import { useRouter, usePathname } from '@/i18n/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, router, pathname]);

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
