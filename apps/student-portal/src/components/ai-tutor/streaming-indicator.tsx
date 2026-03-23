'use client';

import { useTranslations } from 'next-intl';

export function StreamingIndicator() {
  const t = useTranslations('aiTutor');

  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex items-center gap-1">
        <span className="bg-primary/60 h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" />
        <span className="bg-primary/60 h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
        <span className="bg-primary/60 h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
      </div>
      <span className="text-muted-foreground text-xs">{t('thinking')}</span>
    </div>
  );
}
