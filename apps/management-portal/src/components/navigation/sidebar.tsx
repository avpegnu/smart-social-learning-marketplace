'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/lib/store';
import {
  LayoutDashboard,
  BookOpen,
  DollarSign,
  Wallet,
  Ticket,
  MessageCircleQuestion,
  Settings,
  Users,
  ShieldCheck,
  FolderTree,
  BarChart3,
  FileText,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  UserCheck,
  BookMarked,
  LogOut,
} from 'lucide-react';
import { AvatarSimple } from '@shared/ui';
import { useAuthStore, useLogout } from '@shared/hooks';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string; icon: React.ElementType }[];
}

const instructorNav: NavItem[] = [
  { label: 'dashboard', href: '/instructor/dashboard', icon: LayoutDashboard },
  { label: 'courses', href: '/instructor/courses', icon: BookOpen },
  { label: 'revenue', href: '/instructor/revenue', icon: DollarSign },
  { label: 'withdrawals', href: '/instructor/withdrawals', icon: Wallet },
  { label: 'coupons', href: '/instructor/coupons', icon: Ticket },
  { label: 'qna', href: '/instructor/qna', icon: MessageCircleQuestion },
  { label: 'settings', href: '/instructor/settings', icon: Settings },
];

const adminNav: NavItem[] = [
  { label: 'dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'users', href: '/admin/users', icon: Users },
  {
    label: 'approvals',
    href: '/admin/approvals',
    icon: ShieldCheck,
    children: [
      { label: 'instructorApprovals', href: '/admin/approvals/instructors', icon: UserCheck },
      { label: 'courseReviews', href: '/admin/approvals/courses', icon: BookMarked },
    ],
  },
  { label: 'courses', href: '/admin/courses', icon: BookOpen },
  { label: 'categories', href: '/admin/categories', icon: FolderTree },
  { label: 'withdrawals', href: '/admin/withdrawals', icon: Wallet },
  { label: 'reports', href: '/admin/reports', icon: FileText },
  { label: 'analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'settings', href: '/admin/settings', icon: Settings },
];

interface SidebarProps {
  variant: 'instructor' | 'admin';
}

export function Sidebar({ variant }: SidebarProps) {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogout();

  const navItems = variant === 'instructor' ? instructorNav : adminNav;
  const basePath = variant === 'instructor' ? '' : '';

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label],
    );
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground fixed top-0 left-0 z-40 flex h-screen flex-col border-r transition-all duration-300',
        collapsed ? 'w-[var(--spacing-sidebar-collapsed)]' : 'w-[var(--spacing-sidebar)]',
      )}
    >
      {/* Logo */}
      <div className="border-sidebar-border flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <GraduationCap className="text-primary h-7 w-7" />
            <span className="text-sm font-bold tracking-tight">SSLM</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <GraduationCap className="text-primary h-7 w-7" />
          </div>
        )}
        <button
          onClick={toggle}
          className={cn(
            'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors',
            collapsed && 'mx-auto mt-0',
          )}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(basePath + item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.label);
            const childActive =
              hasChildren && item.children!.some((c) => isActive(basePath + c.href));

            return (
              <li key={item.label}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active || childActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        collapsed && 'justify-center px-2',
                      )}
                      title={collapsed ? t(item.label) : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{t(item.label)}</span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              isExpanded && 'rotate-180',
                            )}
                          />
                        </>
                      )}
                    </button>
                    {!collapsed && isExpanded && (
                      <ul className="border-sidebar-border mt-1 ml-4 space-y-1 border-l pl-3">
                        {item.children!.map((child) => {
                          const cActive = isActive(basePath + child.href);
                          return (
                            <li key={child.label}>
                              <Link
                                href={child.href}
                                className={cn(
                                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                                  cActive
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                    : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                )}
                              >
                                <child.icon className="h-4 w-4 shrink-0" />
                                <span>{t(child.label)}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      collapsed && 'justify-center px-2',
                    )}
                    title={collapsed ? t(item.label) : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{t(item.label)}</span>}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User profile at bottom */}
      <div className="border-sidebar-border border-t p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2',
            collapsed && 'justify-center',
          )}
        >
          <AvatarSimple src={user?.avatarUrl ?? undefined} alt={user?.fullName ?? ''} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-foreground truncate text-sm font-medium">
                {user?.fullName ?? ''}
              </p>
              <p className="text-sidebar-muted truncate text-xs">
                {user?.role === 'ADMIN' ? 'Administrator' : 'Instructor'}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() =>
            logoutMutation.mutate(undefined, {
              onSettled: () => {
                window.location.href = '/login';
              },
            })
          }
          className={cn(
            'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-1 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            collapsed && 'justify-center px-2',
          )}
          title={collapsed ? tAuth('logout') : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{tAuth('logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
