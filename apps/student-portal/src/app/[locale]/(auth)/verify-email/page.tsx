'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button, Input } from '@shared/ui';
import { useVerifyEmail, useResendVerification, useApiError } from '@shared/hooks';
import { toast } from 'sonner';

export default function VerifyEmailPage() {
  const t = useTranslations('verifyEmail');
  const router = useRouter();
  const searchParams = useSearchParams();
  const getErrorMessage = useApiError();
  const [countdown, setCountdown] = useState(0);
  const [emailInput, setEmailInput] = useState('');

  const emailFromParam = searchParams.get('email') || '';
  const token = searchParams.get('token');
  const email = emailFromParam || emailInput;

  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();

  // Auto-verify if token present
  useEffect(() => {
    if (token && !verifyMutation.isPending && !verifyMutation.isSuccess) {
      verifyMutation.mutate(token, {
        onSuccess: () => {
          toast.success(t('verified'));
          router.push('/login');
        },
      });
    }
  }, [token]); // Only run when token changes

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = () => {
    if (email.trim()) {
      resendMutation.mutate(email.trim(), {
        onSuccess: () => {
          setCountdown(60);
          toast.success(t('resendSuccess'));
        },
      });
    }
  };

  // Auto-verify view
  if (token) {
    return (
      <div className="text-center">
        {verifyMutation.isPending && (
          <>
            <Loader2 className="text-primary mx-auto mb-4 h-12 w-12 animate-spin" />
            <p className="text-muted-foreground">{t('verifying')}</p>
          </>
        )}
        {verifyMutation.isSuccess && (
          <>
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <p className="text-foreground font-medium">{t('verified')}</p>
          </>
        )}
        {verifyMutation.isError && (
          <div>
            <p className="text-destructive mb-4">{getErrorMessage(verifyMutation.error)}</p>
            <Link href="/login" className="text-primary text-sm hover:underline">
              {t('backToLogin')}
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Resend view
  return (
    <div className="text-center">
      <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
        <Mail className="text-primary h-8 w-8" />
      </div>

      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>

      {emailFromParam ? (
        <p className="text-muted-foreground mb-8">{t('description', { email: emailFromParam })}</p>
      ) : (
        <div className="mb-6 space-y-2">
          <p className="text-muted-foreground mb-4">{t('enterEmail')}</p>
          <Input
            type="email"
            placeholder="email@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
        </div>
      )}

      <Button
        onClick={handleResend}
        disabled={!email.trim() || countdown > 0 || resendMutation.isPending}
        className="mb-4 w-full"
      >
        {resendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
