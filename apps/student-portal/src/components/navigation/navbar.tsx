'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Search,
  ShoppingCart,
  Bell,
  Menu,
  GraduationCap,
  BookOpen,
  User,
  Settings,
  LogOut,
  Heart,
} from 'lucide-react';
import {
  Button,
  Input,
  Avatar,
  AvatarFallback,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@shared/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';

export function Navbar() {
  const t = useTranslations('nav');

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center px-4">
        {/* Mobile menu */}
        <div className="mr-2 flex md:hidden">
          <Sheet>
            <SheetTrigger className="hover:bg-accent rounded-lg p-2">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>
                  <span className="flex items-center gap-2">
                    <GraduationCap className="text-primary h-6 w-6" />
                    SSLM
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-2">
                <Link
                  href="/"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('home')}
                </Link>
                <Link
                  href="/courses"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('browseCourses')}
                </Link>
                <Link
                  href="/my-learning"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('myLearning')}
                </Link>
                <Link
                  href="/social"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('social')}
                </Link>
                <Link
                  href="/chat"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('chat')}
                </Link>
                <Link
                  href="/qna"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('qna')}
                </Link>
                <Link
                  href="/ai-tutor"
                  className="hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  {t('aiTutor')}
                </Link>
              </nav>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <ThemeToggle />
                <LocaleSwitcher />
              </div>
            </SheetContent>
          </Sheet>
        </div>

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
          <Link href="/courses">
            <Button variant="ghost" size="sm" className="gap-1">
              <BookOpen className="h-4 w-4" />
              {t('browseCourses')}
            </Button>
          </Link>
          <Link href="/my-learning">
            <Button variant="ghost" size="sm">
              {t('myLearning')}
            </Button>
          </Link>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1 md:ml-4">
          {/* Search icon - Mobile */}
          <Link href="/courses" className="md:hidden">
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </Link>

          {/* Cart */}
          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                2
              </span>
            </Button>
          </Link>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
              3
            </span>
          </Button>

          {/* Theme & Locale - Desktop */}
          <div className="ml-2 hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>

          {/* Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  MT
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">Minh Tuấn</span>
                  <span className="text-muted-foreground text-xs">minhtuan@email.com</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                {t('profile')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BookOpen className="mr-2 h-4 w-4" />
                {t('myLearning')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Heart className="mr-2 h-4 w-4" />
                {t('wishlist')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                {t('settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="flex items-center gap-2 px-2 py-1.5 lg:hidden">
                <ThemeToggle />
                <LocaleSwitcher />
              </div>
              <DropdownMenuSeparator className="lg:hidden" />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
