'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

export default function GoogleCallbackPage() {
  const t = useTranslations('googleCallback');

  return (
    <div className="text-center">
      <Loader2 className="text-primary mx-auto mb-6 h-12 w-12 animate-spin" />
      <p className="text-muted-foreground text-lg font-medium">{t('processing')}</p>
    </div>
  );
}
