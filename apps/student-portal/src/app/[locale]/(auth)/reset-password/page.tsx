'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { Button, Input, Progress } from '@shared/ui';
import { useResetPassword } from '@shared/hooks';
import { toast } from 'sonner';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/validations/auth';

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

export default function ResetPasswordPage() {
  const t = useTranslations('resetPassword');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = searchParams.get('token') || '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch('password', '');
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const strengthLabels = [t('weak'), t('weak'), t('fair'), t('good'), t('strong')];

  const mutation = useResetPassword();

  const onSubmit = (data: ResetPasswordValues) => {
    mutation.mutate(
      { token, newPassword: data.password },
      {
        onSuccess: () => {
          toast.success(t('success'));
          router.push('/login');
        },
      },
    );
  };

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">{t('invalidToken')}</h1>
        <Link href="/forgot-password" className="text-primary text-sm hover:underline">
          {t('requestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('description')}</p>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* New Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            {t('newPassword')}
          </label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('newPasswordPlaceholder')}
              className="pr-10 pl-9"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="space-y-1">
              <Progress value={strength * 25} className="h-1.5" />
              <p className="text-muted-foreground text-xs">{strengthLabels[strength]}</p>
            </div>
          )}
          {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            {t('confirmPassword')}
          </label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder={t('confirmPasswordPlaceholder')}
              className="pr-10 pl-9"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('submit')}
            </>
          ) : (
            t('submit')
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
