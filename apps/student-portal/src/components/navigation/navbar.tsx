'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import {
  Search,
  ShoppingCart,
  Menu,
  X,
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  User,
  Settings,
  LogOut,
  Heart,
  Package,
  MessageSquare,
  MessageCircle,
  Bot,
  Users,
} from 'lucide-react';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import {
  Button,
  Input,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@shared/ui';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/navigation/locale-switcher';
import {
  useAuthStore,
  useCartStore,
  useServerCart,
  useWishlist,
  useLogout,
  useAuthHydrated,
  useConversations,
} from '@shared/hooks';
import { apiClient } from '@shared/api-client';

export function Navbar() {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useAuthHydrated();
  const { user, isAuthenticated } = useAuthStore();
  const localCartCount = useCartStore((s) => s.itemCount());
  const { data: serverCartData } = useServerCart();
  const serverCartCount =
    (serverCartData?.data as { items: unknown[] } | undefined)?.items?.length ?? 0;
  // After login+merge, localStorage is cleared → use server count
  const cartCount = isAuthenticated ? serverCartCount : localCartCount;

  const { data: wishlistData } = useWishlist();
  const wishlistCount = (wishlistData?.data as unknown[] | undefined)?.length ?? 0;

  // Chat unread count
  const { data: conversationsRaw } = useConversations();
  const totalChatUnread = (
    (conversationsRaw as { data?: Array<{ unreadCount?: number }> })?.data ??
    (Array.isArray(conversationsRaw) ? (conversationsRaw as Array<{ unreadCount?: number }>) : [])
  ).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const logoutMutation = useLogout();

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <>
      <header className="border-border/50 bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 w-full border-b backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center px-4">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="hover:bg-accent mr-2 flex cursor-pointer rounded-lg p-2 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link href="/" className="mr-6 flex items-center gap-2">
            <GraduationCap className="text-primary h-7 w-7" />
            <span className="hidden text-lg font-bold sm:inline-block">SSLM</span>
          </Link>

          {/* Search - Desktop */}
          <div className="mx-4 hidden max-w-md flex-1 md:flex">
            <div className="relative w-full">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input placeholder={t('searchPlaceholder')} className="bg-muted/50 pl-9" />
            </div>
          </div>

          {/* Nav links - Desktop */}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {hydrated && (
              <Link href="/courses">
                <Button variant="ghost" size="sm" className="gap-1">
                  <BookOpen className="h-4 w-4" />
                  {t('browseCourses')}
                </Button>
              </Link>
            )}
            {hydrated && isAuthenticated && (
              <Link href="/my-learning">
                <Button variant="ghost" size="sm">
                  {t('myLearning')}
                </Button>
              </Link>
            )}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1 md:ml-4">
            {/* Search icon - Mobile */}
            <Link href="/courses" className="md:hidden">
              <Button variant="ghost" size="icon">
                <Search className="h-5 w-5" />
              </Button>
            </Link>

            {/* Cart — always visible (guest uses localStorage, auth uses server) */}
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {hydrated && cartCount > 0 && (
                  <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Button>
            </Link>

            {!hydrated ? (
              <div className="ml-2 flex items-center gap-2">
                <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
              </div>
            ) : isAuthenticated ? (
              <>
                {/* Wishlist */}
                <Link href="/wishlist">
                  <Button variant="ghost" size="icon" className="relative">
                    <Heart className="h-5 w-5" />
                    {wishlistCount > 0 && (
                      <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                        {wishlistCount > 9 ? '9+' : wishlistCount}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* Social */}
                <Link href="/social" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="icon" title={t('social')}>
                    <Users className="h-5 w-5" />
                  </Button>
                </Link>

                {/* Chat */}
                <Link href="/chat" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="icon" className="relative" title={t('chat')}>
                    <MessageCircle className="h-5 w-5" />
                    {totalChatUnread > 0 && (
                      <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                        {totalChatUnread > 9 ? '9+' : totalChatUnread}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* Q&A */}
                <Link href="/qna" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="icon" title={t('qna')}>
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </Link>

                {/* AI Tutor */}
                <Link href="/ai-tutor" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="icon" title={t('aiTutor')}>
                    <Bot className="h-5 w-5" />
                  </Button>
                </Link>

                {/* Notifications */}
                {isAuthenticated && <NotificationPopover />}

                {/* Theme & Locale - Desktop */}
                <div className="ml-2 hidden items-center gap-2 lg:flex">
                  <ThemeToggle />
                  <LocaleSwitcher />
                </div>

                {/* Avatar Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="ml-2 cursor-pointer">
                    <Avatar className="h-8 w-8">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.fullName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{user?.fullName}</span>
                        <span className="text-muted-foreground text-xs">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push(`/profile/${user?.id}`)}>
                      <User className="mr-2 h-4 w-4" />
                      {t('profile')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/my-learning')}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      {t('myLearning')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/wishlist')}>
                      <Heart className="mr-2 h-4 w-4" />
                      {t('wishlist')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/orders')}>
                      <Package className="mr-2 h-4 w-4" />
                      {t('orders')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t('settings')}
                    </DropdownMenuItem>
                    {user?.role === 'STUDENT' && (
                      <>
                        <DropdownMenuSeparator />
                        <Link href="/become-instructor">
                          <DropdownMenuItem className="cursor-pointer">
                            <GraduationCap className="mr-2 h-4 w-4" />
                            {t('becomeInstructor')}
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}
                    {user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN' ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-primary cursor-pointer"
                          onClick={() => {
                            const base =
                              process.env.NEXT_PUBLIC_MANAGEMENT_URL || 'http://localhost:3002';
                            apiClient
                              .get<{ ott: string }>('/auth/ott')
                              .then((res) => {
                                window.location.href = `${base}/login?ott=${res.data.ott}`;
                              })
                              .catch(() => {
                                window.location.href = base;
                              });
                          }}
                        >
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          {t('managementPortal')}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <div className="flex items-center gap-2 px-2 py-1.5 lg:hidden">
                      <ThemeToggle />
                      <LocaleSwitcher />
                    </div>
                    <DropdownMenuSeparator className="lg:hidden" />
                    <DropdownMenuItem
                      className="text-destructive cursor-pointer"
                      onClick={() =>
                        logoutMutation.mutate(undefined, { onSettled: () => router.push('/login') })
                      }
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Guest: Login + Register buttons */}
                <div className="ml-2 hidden items-center gap-2 lg:flex">
                  <ThemeToggle />
                  <LocaleSwitcher />
                </div>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    {t('login')}
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">{t('register')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay — outside header so z-index works over page content */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <nav className="bg-background absolute inset-y-0 left-0 flex w-72 flex-col border-r shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-primary h-6 w-6" />
                <span className="text-lg font-bold">SSLM</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="hover:bg-accent flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {[
                  { href: '/', label: t('home') },
                  { href: '/courses', label: t('browseCourses') },
                  ...(hydrated && isAuthenticated
                    ? [
                        { href: '/my-learning', label: t('myLearning') },
                        { href: '/social', label: t('social') },
                        { href: '/chat', label: t('chat') },
                        { href: '/qna', label: t('qna') },
                        { href: '/ai-tutor', label: t('aiTutor') },
                      ]
                    : []),
                ].map((item) => {
                  const active =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
            <div className="border-t p-3">
              <div className="mb-3 flex items-center gap-2 px-3">
                <ThemeToggle />
                <LocaleSwitcher />
              </div>
              {hydrated && isAuthenticated && user && (
                <>
                  <div className="mb-2 flex items-center gap-3 px-3 py-2">
                    <Avatar className="h-8 w-8">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.fullName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.fullName}</p>
                      <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      logoutMutation.mutate(undefined, { onSettled: () => router.push('/login') })
                    }
                    className="text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('logout')}
                  </button>
                </>
              )}
              {hydrated && !isAuthenticated && (
                <div className="flex gap-2 px-3">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full">
                      {t('login')}
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1">
                    <Button className="w-full">{t('register')}</Button>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
