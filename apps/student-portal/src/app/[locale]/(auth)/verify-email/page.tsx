'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@shared/ui';
import { useState, useEffect, useCallback } from 'react';

export default function VerifyEmailPage() {
  const t = useTranslations('verifyEmail');
  const [countdown, setCountdown] = useState(0);
  const [email] = useState('user@example.com');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = useCallback(() => {
    setCountdown(60);
  }, []);

  return (
    <div className="text-center">
      <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
        <Mail className="text-primary h-8 w-8" />
      </div>

      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('description', { email })}</p>

      <Button onClick={handleResend} disabled={countdown > 0} className="mb-4 w-full">
        {countdown > 0 ? t('resendCountdown', { seconds: countdown }) : t('resend')}
      </Button>

      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToLogin')}
      </Link>
    </div>
  );
}
