'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { useAuthStore } from '@shared/hooks';
import { useSidebarStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Input, AvatarSimple } from '@shared/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Bell, Search } from 'lucide-react';

export function Header() {
  const t = useTranslations('header');
  const { collapsed } = useSidebarStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get<number>('/notifications/unread-count'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const unreadCount = unreadData?.data ?? 0;

  return (
    <header
      className={cn(
        'bg-background fixed top-0 z-30 flex h-16 items-center gap-4 border-b px-6 transition-all duration-300',
        collapsed ? 'left-[var(--spacing-sidebar-collapsed)]' : 'left-[var(--spacing-sidebar)]',
        'right-0',
      )}
    >
      <Breadcrumb />

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input placeholder={t('search')} className="w-64 pl-9" />
        </div>

        {/* Notifications */}
        <button className="hover:bg-accent relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Locale switcher */}
        <LocaleSwitcher />

        {/* Avatar */}
        <AvatarSimple src={user?.avatarUrl ?? undefined} alt={user?.fullName ?? ''} size="sm" />
      </div>
    </header>
  );
}
