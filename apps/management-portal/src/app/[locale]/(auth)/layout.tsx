'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@shared/hooks';
import { DesktopGuard } from '@/components/desktop-guard';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/instructor/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated) return null;

  return (
    <DesktopGuard>
      <div className="bg-muted/30 flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </DesktopGuard>
  );
}
