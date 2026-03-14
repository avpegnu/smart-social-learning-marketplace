'use client';

import { useTranslations } from 'next-intl';
import { Monitor } from 'lucide-react';

export function DesktopGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');

  return (
    <>
      {/* Desktop-only content */}
      <div className="hidden min-[1024px]:contents">{children}</div>

      {/* Mobile/tablet message */}
      <div className="bg-background flex min-h-screen items-center justify-center p-8 min-[1024px]:hidden">
        <div className="max-w-md text-center">
          <Monitor className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
          <h2 className="mb-2 text-xl font-semibold">{t('desktopRequired')}</h2>
          <p className="text-muted-foreground">{t('desktopRequiredDesc')}</p>
        </div>
      </div>
    </>
  );
}
