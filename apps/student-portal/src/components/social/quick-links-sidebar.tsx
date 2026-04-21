'use client';

import { Home, HelpCircle, Bell, Settings } from 'lucide-react';
import { Card, CardContent } from '@shared/ui';
import { Link } from '@/i18n/navigation';

export function QuickLinksSidebar() {
  const links = [
    {
      icon: Home,
      label: 'Home',
      href: '/',
    },
    {
      icon: HelpCircle,
      label: 'Q&A',
      href: '/qna',
    },
    {
      icon: Bell,
      label: 'Notifications',
      href: '/notifications',
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/settings',
    },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-4 text-sm font-semibold">Quick Links</h3>
        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.label}
                href={link.href}
                className="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <Icon className="text-muted-foreground h-5 w-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
