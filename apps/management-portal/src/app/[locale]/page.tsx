'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore, useAuthHydrated } from '@shared/hooks';

export default function HomePage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user?.role === 'ADMIN') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/instructor/dashboard');
    }
  }, [hydrated, isAuthenticated, user, router]);

  return null;
}
