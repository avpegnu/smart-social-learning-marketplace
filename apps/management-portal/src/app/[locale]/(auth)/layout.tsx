'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore, useAuthHydrated } from '@shared/hooks';
import { DesktopGuard } from '@/components/desktop-guard';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated && user) {
      // Only redirect INSTRUCTOR/ADMIN to their dashboards
      // STUDENT stays on auth pages (they'll see /unauthorized from login redirect)
      if (user.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else if (user.role === 'INSTRUCTOR') {
        router.replace('/instructor/dashboard');
      }
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated) return null;
  // Only block auth pages for users who have a valid management role
  if (isAuthenticated && user && (user.role === 'ADMIN' || user.role === 'INSTRUCTOR')) {
    return null;
  }

  return (
    <DesktopGuard>
      <div className="bg-muted/30 flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </DesktopGuard>
  );
}
