'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
import { Button, Input } from '@shared/ui';
import { useLogin, useAuthStore } from '@shared/hooks';
import { apiClient } from '@shared/api-client';
import { loginSchema, type LoginValues } from '@/lib/validations/auth';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const ottProcessed = useRef(false);

  // Auto-login via OTT (cross-portal redirect)
  useEffect(() => {
    const ott = searchParams.get('ott');
    if (!ott || ottProcessed.current) return;
    ottProcessed.current = true;

    apiClient
      .post<{
        accessToken: string;
        user: {
          id: string;
          role: string;
          fullName: string;
          email: string;
          avatarUrl: string | null;
        };
      }>('/auth/ott/validate?portal=student', { ott, portal: 'student' })
      .then((res) => {
        const { user, accessToken } = res.data;
        useAuthStore.getState().setAuth(user as never, accessToken);
        window.location.href = '/';
      })
      .catch(() => {
        // OTT invalid — stay on login page
      });
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useLogin();

  const onSubmit = (data: LoginValues) => {
    mutation.mutate(
      { ...data, portal: 'student' },
      {
        onSuccess: () => {
          const redirect = searchParams.get('redirect') || '/';
          router.push(redirect);
        },
      },
    );
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t('loginTitle')}</h1>
      <p className="text-muted-foreground mb-8">{t('loginSubtitle')}</p>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="password">
              {t('password')}
            </label>
            <Link href="/forgot-password" className="text-primary text-xs hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
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
          {errors.password?.message && (
            <p className="text-destructive text-sm">{tv(errors.password.message)}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loginButton')}
            </>
          ) : (
            t('loginButton')
          )}
        </Button>
      </form>

      {/* Register link */}
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-primary font-medium hover:underline">
          {t('registerLink')}
        </Link>
      </p>
    </div>
  );
}
