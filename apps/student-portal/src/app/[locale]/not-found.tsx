'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@shared/ui';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  const t = useTranslations('notFound');

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-muted-foreground/20 mb-2 text-[120px] leading-none font-bold select-none">
        404
      </div>
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">{t('description')}</p>
      <Link href="/">
        <Button className="gap-2">
          <Home className="h-4 w-4" />
          {t('backHome')}
        </Button>
      </Link>
    </div>
  );
}
