'use client';

import { useTranslations } from 'next-intl';
import { Home, HelpCircle, Bell, Settings } from 'lucide-react';
import { Card, CardContent } from '@shared/ui';
import { Link } from '@/i18n/navigation';

const links = [
  { icon: Home, labelKey: 'home', href: '/' },
  { icon: HelpCircle, labelKey: 'qna', href: '/qna' },
  { icon: Bell, labelKey: 'notifications', href: '/notifications' },
  { icon: Settings, labelKey: 'settings', href: '/settings' },
] as const;

export function QuickLinksSidebar() {
  const t = useTranslations('social');
  const tNav = useTranslations('nav');

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-4 text-sm font-semibold">{t('quickLinks')}</h3>
        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.labelKey}
                href={link.href}
                className="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <Icon className="text-muted-foreground h-5 w-5" />
                <span>{tNav(link.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
