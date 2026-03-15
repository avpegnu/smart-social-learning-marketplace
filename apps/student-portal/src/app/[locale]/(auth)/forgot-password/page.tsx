'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button, Input } from '@shared/ui';
import { useForgotPassword } from '@shared/hooks';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validations/auth';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const mutation = useForgotPassword();

  if (mutation.isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">{t('sentTitle')}</h1>
        <p className="text-muted-foreground mb-8">{t('sentDescription')}</p>
        <Link href="/login" className="text-primary text-sm font-medium hover:underline">
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('description')}</p>

      <form className="space-y-4" onSubmit={handleSubmit((data) => mutation.mutate(data.email))}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              className="pl-9"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('sendLink')}
            </>
          ) : (
            t('sendLink')
          )}
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
