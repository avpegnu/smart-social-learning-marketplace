'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore, useAuthHydrated } from '@shared/hooks';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else if (user.role === 'INSTRUCTOR') {
        router.replace('/instructor/dashboard');
      }
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated) return null;
  if (isAuthenticated && user && (user.role === 'ADMIN' || user.role === 'INSTRUCTOR')) {
    return null;
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
