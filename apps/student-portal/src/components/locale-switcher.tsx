'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: 'vi' | 'en') => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="border-border bg-muted/50 flex items-center gap-1 rounded-lg border p-1">
      <button
        onClick={() => switchLocale('vi')}
        className={cn(
          'inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium transition-colors',
          locale === 'vi'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        VI
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={cn(
          'inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium transition-colors',
          locale === 'en'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        EN
      </button>
    </div>
  );
}
