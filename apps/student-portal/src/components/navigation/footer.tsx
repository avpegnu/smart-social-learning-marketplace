'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { GraduationCap } from 'lucide-react';
import { Separator } from '@shared/ui';

export function Footer() {
  const t = useTranslations('footer');

  const links = {
    platform: [{ label: t('browseCourses'), href: '/courses' }],
    resources: [
      { label: t('community'), href: '/social' },
      { label: t('qna'), href: '/qna' },
    ],
  };

  return (
    <footer className="border-border bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <GraduationCap className="text-primary h-7 w-7" />
              <span className="text-lg font-bold">SSLM</span>
            </Link>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">{t('platformTitle')}</h4>
            <ul className="space-y-2">
              {links.platform.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">{t('resourcesTitle')}</h4>
            <ul className="space-y-2">
              {links.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            &copy; 2026 SSLM. {t('allRightsReserved')}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">{t('madeWith')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
