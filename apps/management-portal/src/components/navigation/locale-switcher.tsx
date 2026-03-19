'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const toggleLocale = () => {
    const newLocale = locale === 'vi' ? 'en' : 'vi';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <button
      onClick={toggleLocale}
      className={cn(
        'hover:bg-accent flex h-9 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition-colors',
      )}
    >
      {locale === 'vi' ? 'VI' : 'EN'}
    </button>
  );
}
