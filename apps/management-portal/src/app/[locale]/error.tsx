'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@shared/ui';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <AlertTriangle className="text-destructive mx-auto h-16 w-16" />
        <h1 className="mt-4 text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 max-w-md">{error.message || t('description')}</p>
      </div>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
