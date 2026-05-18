'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react';
import { Button, Input, Progress } from '@shared/ui';
import { useRegister } from '@shared/hooks';
import { registerSchema, type RegisterValues } from '@/lib/validations/auth';

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const strengthLabels = [t('weak'), t('weak'), t('fair'), t('good'), t('strong')];

  const mutation = useRegister();

  const onSubmit = (data: RegisterValues) => {
    mutation.mutate(
      { fullName: data.fullName, email: data.email, password: data.password },
      { onSuccess: () => router.push(`/verify-email?email=${encodeURIComponent(data.email)}`) },
    );
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t('registerTitle')}</h1>
      <p className="text-muted-foreground mb-8">{t('registerSubtitle')}</p>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Full Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fullName">
            {t('fullName')}
          </label>
          <div className="relative">
            <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="fullName"
              placeholder={t('fullNamePlaceholder')}
              className="pl-9"
              {...register('fullName')}
            />
          </div>
          {errors.fullName?.message && (
            <p className="text-destructive text-sm">{tv(errors.fullName.message)}</p>
          )}
        </div>

        {/* Email */}
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
          {errors.email?.message && (
            <p className="text-destructive text-sm">{tv(errors.email.message)}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            {t('password')}
          </label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('passwordPlaceholder')}
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
          {errors.password?.message && (
            <p className="text-destructive text-sm">{tv(errors.password.message)}</p>
          )}
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
          {errors.confirmPassword?.message && (
            <p className="text-destructive text-sm">{tv(errors.confirmPassword.message)}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('registerButton')}
            </>
          ) : (
            t('registerButton')
          )}
        </Button>
      </form>

      {/* Login link */}
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('haveAccount')}{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
