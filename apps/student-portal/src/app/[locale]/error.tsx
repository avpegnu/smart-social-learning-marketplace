'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@shared/ui';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorPage({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="bg-destructive/10 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive h-10 w-10" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">{t('description')}</p>
      <Button onClick={reset} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        {t('retry')}
      </Button>
    </div>
  );
}
