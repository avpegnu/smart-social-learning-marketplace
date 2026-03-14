'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Lock, Mail, ArrowLeft } from 'lucide-react';
import { Button, Input } from '@shared/ui';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');

  return (
    <div>
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <Lock className="text-primary h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input id="email" type="email" placeholder={t('emailPlaceholder')} className="pl-9" />
          </div>
        </div>

        <Button type="submit" className="w-full">
          {t('sendLink')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  );
}
