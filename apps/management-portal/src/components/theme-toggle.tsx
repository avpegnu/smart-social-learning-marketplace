'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui';

export function ThemeToggle() {
  const { theme: _theme, setTheme } = useTheme();
  const t = useTranslations('theme');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent flex h-9 w-9 items-center justify-center rounded-md border transition-colors">
        <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:hidden [html[data-theme=dark]_&]:hidden" />
        <Moon className="hidden h-4 w-4 dark:block [html[data-theme=dark]_&]:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          {t('light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          {t('dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          {t('system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
