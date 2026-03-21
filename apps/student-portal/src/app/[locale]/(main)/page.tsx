'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Star, Users, Bot, Sparkles, GraduationCap, ChevronRight } from 'lucide-react';
import { Button, Badge, Skeleton } from '@shared/ui';
import { CourseGrid } from '@/components/course/course-grid';
import { useCourses, useCategories } from '@shared/hooks';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const t = useTranslations('home');

  const popularParams = useMemo(() => ({ sort: 'popular', limit: '4' }), []);
  const newestParams = useMemo(() => ({ sort: 'newest', limit: '4' }), []);

  const { data: popularData, isLoading: popularLoading } = useCourses(popularParams);
  const { data: newestData, isLoading: newestLoading } = useCourses(newestParams);
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();

  const popularCourses = (popularData?.data as Record<string, unknown>[]) ?? [];
  const newestCourses = (newestData?.data as Record<string, unknown>[]) ?? [];
  const categories =
    (categoriesData?.data as Array<{ id: string; name: string; slug: string }>) ?? [];

  const features = [
    {
      icon: Users,
      title: t('whyUs.social.title'),
      description: t('whyUs.social.desc'),
      color: 'text-primary bg-primary/10',
    },
    {
      icon: Bot,
      title: t('whyUs.ai.title'),
      description: t('whyUs.ai.desc'),
      color: 'text-primary bg-primary/10',
    },
    {
      icon: GraduationCap,
      title: t('whyUs.quality.title'),
      description: t('whyUs.quality.desc'),
      color: 'text-success bg-success/10',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-primary/10 relative overflow-hidden bg-gradient-to-br py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              {t('heroBadge')}
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('heroTitle')}
            </h1>
            <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/courses">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  {t('heroCta1')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {t('heroCta2')}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 flex items-center justify-center gap-8 sm:gap-12">
              <div className="text-center">
                <div className="text-primary text-3xl font-bold">500+</div>
                <div className="text-muted-foreground text-sm">{t('statCourses')}</div>
              </div>
              <div className="text-center">
                <div className="text-primary text-3xl font-bold">10K+</div>
                <div className="text-muted-foreground text-sm">{t('statStudents')}</div>
              </div>
              <div className="text-center">
                <div className="text-primary flex items-center justify-center gap-1 text-3xl font-bold">
                  4.8 <Star className="fill-primary h-5 w-5" />
                </div>
                <div className="text-muted-foreground text-sm">{t('statRating')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Bar */}
      <section className="border-border bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="scrollbar-hide flex items-center gap-3 overflow-x-auto py-4">
            {categoriesLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-24 rounded-md" />
                ))
              : categories.map((cat) => (
                  <Link key={cat.id} href={`/courses?category=${cat.slug}`}>
                    <Button variant="outline" size="sm" className="whitespace-nowrap">
                      {cat.name}
                    </Button>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Popular Courses */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t('featuredTitle')}</h2>
              <p className="text-muted-foreground mt-1">{t('featuredSubtitle')}</p>
            </div>
            <Link href="/courses?sort=popular">
              <Button variant="ghost" className="gap-1">
                {t('viewAll')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <CourseGrid
            courses={popularCourses as never[]}
            isLoading={popularLoading}
            skeletonCount={4}
          />
        </div>
      </section>

      {/* New Courses */}
      <section className="bg-muted/30 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t('newCoursesTitle')}</h2>
              <p className="text-muted-foreground mt-1">{t('newCoursesSubtitle')}</p>
            </div>
            <Link href="/courses?sort=newest">
              <Button variant="ghost" className="gap-1">
                {t('viewAll')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <CourseGrid
            courses={newestCourses as never[]}
            isLoading={newestLoading}
            skeletonCount={4}
          />
        </div>
      </section>

      {/* Why Us */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('whyUs.title')}</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">{t('whyUs.subtitle')}</p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <div key={index} className="bg-card border-border rounded-2xl border p-6 text-center">
                <div
                  className={cn(
                    'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
                    feature.color,
                  )}
                >
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
