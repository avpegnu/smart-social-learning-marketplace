'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore, useAuthHydrated, useSidebarStore } from '@shared/hooks';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/navigation/sidebar';
import { Header } from '@/components/navigation/header';
import { DesktopGuard } from '@/components/auth/desktop-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarStore();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && user.role !== 'ADMIN') {
      router.replace('/unauthorized');
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated || !isAuthenticated || !user) return null;
  if (user.role !== 'ADMIN') return null;

  return (
    <DesktopGuard>
      <div className="bg-background min-h-screen">
        <Sidebar variant="admin" />
        <Header />
        <main
          className={cn(
            'pt-16 transition-all duration-300',
            collapsed ? 'ml-[var(--spacing-sidebar-collapsed)]' : 'ml-[var(--spacing-sidebar)]',
          )}
        >
          <div className="mx-auto max-w-7xl p-6">{children}</div>
        </main>
      </div>
    </DesktopGuard>
  );
}
