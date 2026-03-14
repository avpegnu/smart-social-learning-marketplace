'use client';

import { useTranslations } from 'next-intl';
import { usePathname, Link } from '@/i18n/navigation';
import { Home, BookOpen, Search, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'home', href: '/', icon: Home },
  { key: 'learn', href: '/my-learning', icon: BookOpen },
  { key: 'search', href: '/courses', icon: Search },
  { key: 'chat', href: '/chat', icon: MessageCircle },
  { key: 'profile', href: '/settings', icon: User },
] as const;

export function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="border-border bg-background/95 fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map(({ key, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
