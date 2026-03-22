'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@shared/api-client';
import { useAuthStore, useSidebarStore, useLogout } from '@shared/hooks';
import { cn } from '@/lib/utils';
import {
  Input,
  AvatarSimple,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@shared/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/navigation/locale-switcher';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Bell, Search, Settings, LogOut, Menu, X, GraduationCap } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

interface HeaderProps {
  variant?: 'instructor' | 'admin';
}

export function Header({ variant = 'instructor' }: HeaderProps) {
  const t = useTranslations('header');
  const tAuth = useTranslations('auth');
  const tNav = useTranslations('nav');
  const { collapsed } = useSidebarStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogout();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get<number>('/notifications/unread-count'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const unreadCount = unreadData?.data ?? 0;
  const settingsHref = variant === 'admin' ? '/admin/settings' : '/instructor/settings';

  const mobileNavItems =
    variant === 'instructor'
      ? [
          { label: tNav('dashboard'), href: '/instructor/dashboard' },
          { label: tNav('courses'), href: '/instructor/courses' },
          { label: tNav('revenue'), href: '/instructor/revenue' },
          { label: tNav('withdrawals'), href: '/instructor/withdrawals' },
          { label: tNav('coupons'), href: '/instructor/coupons' },
          { label: tNav('qna'), href: '/instructor/qna' },
          { label: tNav('settings'), href: '/instructor/settings' },
        ]
      : [
          { label: tNav('dashboard'), href: '/admin/dashboard' },
          { label: tNav('users'), href: '/admin/users' },
          { label: tNav('approvals'), href: '/admin/approvals' },
          { label: tNav('courses'), href: '/admin/courses' },
          { label: tNav('categories'), href: '/admin/categories' },
          { label: tNav('withdrawals'), href: '/admin/withdrawals' },
          { label: tNav('reports'), href: '/admin/reports' },
          { label: tNav('analytics'), href: '/admin/analytics' },
          { label: tNav('settings'), href: '/admin/settings' },
        ];

  return (
    <>
      <header
        className={cn(
          'bg-background/95 supports-[backdrop-filter]:bg-background/70 fixed top-0 z-30 flex h-16 items-center gap-4 border-b px-4 backdrop-blur-xl transition-all duration-300 md:px-6',
          'right-0 left-0',
          collapsed
            ? 'md:left-[var(--spacing-sidebar-collapsed)]'
            : 'md:left-[var(--spacing-sidebar)]',
        )}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="hover:bg-accent flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Breadcrumb />

        <div className="ml-auto flex items-center gap-2 md:gap-3">
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

          {/* Theme toggle — desktop only */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* Locale switcher — desktop only */}
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="focus-visible:ring-ring cursor-pointer rounded-full outline-none focus-visible:ring-2">
              <AvatarSimple
                src={user?.avatarUrl ?? undefined}
                alt={user?.fullName ?? ''}
                size="sm"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.fullName ?? ''}</span>
                  <span className="text-muted-foreground text-xs">{user?.email ?? ''}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href={settingsHref}>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  {tNav('settings')}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={() =>
                  logoutMutation.mutate(undefined, {
                    onSettled: () => {
                      window.location.href = '/login';
                    },
                  })
                }
              >
                <LogOut className="mr-2 h-4 w-4" />
                {tAuth('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />

          {/* Sidebar panel */}
          <nav className="bg-background absolute inset-y-0 left-0 flex w-72 flex-col border-r shadow-xl">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-primary h-6 w-6" />
                <span className="text-sm font-bold">SSLM</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="hover:bg-accent flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {mobileNavItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Bottom: theme, locale, user, logout */}
            <div className="border-t p-3">
              <div className="mb-3 flex items-center gap-2 px-3">
                <ThemeToggle />
                <LocaleSwitcher />
              </div>
              <div className="mb-2 flex items-center gap-3 px-3 py-2">
                <AvatarSimple
                  src={user?.avatarUrl ?? undefined}
                  alt={user?.fullName ?? ''}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.fullName ?? ''}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {user?.role === 'ADMIN' ? 'Administrator' : 'Instructor'}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  logoutMutation.mutate(undefined, {
                    onSettled: () => {
                      window.location.href = '/login';
                    },
                  })
                }
                className="text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {tAuth('logout')}
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
