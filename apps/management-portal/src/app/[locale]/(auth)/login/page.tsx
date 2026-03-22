'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@/i18n/navigation';
import { useLogin, useAuthStore } from '@shared/hooks';
import { apiClient } from '@shared/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Button,
} from '@shared/ui';
import { GraduationCap, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/navigation/locale-switcher';
import { loginSchema, type LoginValues } from '@/lib/validations/auth';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginMutation = useLogin();
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
      }>('/auth/ott/validate?portal=management', { ott, portal: 'management' })
      .then((res) => {
        const { user, accessToken } = res.data;
        useAuthStore.getState().setAuth(user as never, accessToken);
        if (user.role === 'ADMIN') {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = '/instructor/dashboard';
        }
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
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginValues) => {
    loginMutation.mutate(
      { ...data, portal: 'management' },
      {
        onSuccess: (res) => {
          const role = res.data.user.role;
          if (role === 'ADMIN') {
            router.push('/admin/dashboard');
          } else if (role === 'INSTRUCTOR') {
            router.push('/instructor/dashboard');
          } else {
            router.push('/unauthorized');
          }
        },
      },
    );
  };

  return (
    <div className="space-y-6">
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
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t('email')}
              </label>
              <Input id="email" type="email" placeholder="admin@sslm.vn" {...register('email')} />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t('password')}
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
