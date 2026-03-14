'use client';

import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Button,
} from '@shared/ui';
import { GraduationCap } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');

  return (
    <div className="space-y-6">
      {/* Top controls */}
      <div className="flex justify-end gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="bg-primary/10 mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl">
            <GraduationCap className="text-primary h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">{t('loginTitle')}</CardTitle>
          <CardDescription>{t('loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t('email')}
              </label>
              <Input id="email" type="email" placeholder="admin@sslm.vn" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  {t('password')}
                </label>
                <a href="#" className="text-primary text-xs hover:underline">
                  {t('forgotPassword')}
                </a>
              </div>
              <Input id="password" type="password" placeholder="••••••••" required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="border-input rounded" />
              <label htmlFor="remember" className="text-muted-foreground text-sm">
                {t('rememberMe')}
              </label>
            </div>
            <Button type="submit" className="w-full">
              {t('login')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-xs">
        {tc('portalName')} &mdash; {tc('appName')}
      </p>
    </div>
  );
}
