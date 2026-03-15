'use client';

import { useEffect } from 'react';
import { GraduationCap, BookOpen, Users, Bot, Star } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@shared/hooks';
import { useRouter } from '@/i18n/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  if (isAuthenticated) return null;

  const features = [
    { icon: BookOpen, title: t('feature1Title'), description: t('feature1Desc') },
    { icon: Users, title: t('feature2Title'), description: t('feature2Desc') },
    { icon: Bot, title: t('feature3Title'), description: t('feature3Desc') },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left side - Form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2">
            <GraduationCap className="text-primary h-8 w-8" />
            <span className="text-xl font-bold">SSLM</span>
          </div>
          {children}
        </div>
        <div className="mt-8 flex items-center gap-3">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>

      {/* Right side - Feature showcase */}
      <div className="from-primary via-primary/90 to-primary/70 text-primary-foreground hidden flex-1 flex-col justify-center bg-gradient-to-br p-12 lg:flex">
        <div className="mx-auto max-w-md">
          <h2 className="mb-2 text-3xl font-bold">{t('welcomeTitle')}</h2>
          <p className="text-primary-foreground/80 mb-10">{t('welcomeDesc')}</p>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{feature.title}</h3>
                  <p className="text-primary-foreground/70 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">500+</div>
              <div className="text-primary-foreground/70 text-xs">{t('statCourses')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">10K+</div>
              <div className="text-primary-foreground/70 text-xs">{t('statStudents')}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                4.8 <Star className="h-4 w-4 fill-current" />
              </div>
              <div className="text-primary-foreground/70 text-xs">{t('statRating')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
