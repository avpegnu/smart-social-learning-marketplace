'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore, useAuthHydrated, useSidebarStore } from '@shared/hooks';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/navigation/sidebar';
import { Header } from '@/components/navigation/header';
import { SocketProvider } from '@/components/providers/socket-provider';

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
    <div className="bg-background min-h-screen">
      <SocketProvider />
      <div className="hidden md:block">
        <Sidebar variant="admin" />
      </div>
      <Header variant="admin" />
      <main
        className={cn(
          'pt-16 transition-all duration-300',
          collapsed ? 'md:ml-[var(--spacing-sidebar-collapsed)]' : 'md:ml-[var(--spacing-sidebar)]',
        )}
      >
        <div className="mx-auto max-w-7xl overflow-x-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
