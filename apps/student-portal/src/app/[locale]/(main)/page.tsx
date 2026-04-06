'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ArrowRight,
  Star,
  Users,
  Bot,
  Sparkles,
  GraduationCap,
  ChevronRight,
  Target,
} from 'lucide-react';
import { Button, Badge, Skeleton } from '@shared/ui';
import { CourseGrid } from '@/components/course/course-grid';
import { RecommendationSection } from '@/components/course/recommendation-section';
import { useCourses, useCategories } from '@shared/hooks';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const t = useTranslations('home');
  const tp = useTranslations('placementTest');

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
      color: 'text-accent-cyan bg-accent-cyan/10',
    },
    {
      icon: Bot,
      title: t('whyUs.ai.title'),
      description: t('whyUs.ai.desc'),
      color: 'text-accent-violet bg-accent-violet/10',
    },
    {
      icon: GraduationCap,
      title: t('whyUs.quality.title'),
      description: t('whyUs.quality.desc'),
      color: 'text-accent-emerald bg-accent-emerald/10',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-mesh-1 relative overflow-hidden py-16 sm:py-24">
        <div className="bg-primary/15 absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-accent-violet/15 absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-accent-pink/10 absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative container mx-auto px-4">
          <div className="animate-fade-in-up mx-auto max-w-3xl text-center">
            <Badge className="border-primary/20 bg-background/60 text-primary mb-4 border px-4 py-1.5 text-sm shadow-sm backdrop-blur-md">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t('heroBadge')}
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-gradient">{t('heroTitle')}</span>
            </h1>
            <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/courses">
                <Button
                  size="lg"
                  className="h-12 w-full gap-2 rounded-full px-8 text-base sm:w-auto"
                >
                  {t('heroCta1')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-full rounded-full px-8 text-base sm:w-auto"
                >
                  {t('heroCta2')}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 flex items-center justify-center gap-8 sm:gap-12">
              <div className="text-center">
                <div className="text-gradient text-3xl font-bold">500+</div>
                <div className="text-muted-foreground text-sm">{t('statCourses')}</div>
              </div>
              <div className="text-center">
                <div className="text-gradient text-3xl font-bold">10K+</div>
                <div className="text-muted-foreground text-sm">{t('statStudents')}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-3xl font-bold">
                  <span className="text-gradient">4.8</span>
                  <Star className="fill-warning text-warning h-5 w-5" />
                </div>
                <div className="text-muted-foreground text-sm">{t('statRating')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Bar */}
      <section className="border-border bg-background border-b">
        <div className="container mx-auto flex items-center gap-6 px-4 py-4">
          <span className="text-muted-foreground shrink-0 text-sm font-medium">
            {t('categories')}
          </span>
          <div className="overflow-hidden">
            {categoriesLoading ? (
              <div className="flex items-center gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-md" />
                ))}
              </div>
            ) : (
              <div className="animate-marquee flex w-max items-center gap-3">
                {[...categories, ...categories].map((cat, i) => (
                  <Link key={`${cat.id}-${i}`} href={`/courses?category=${cat.slug}`}>
                    <Button variant="outline" size="sm" className="whitespace-nowrap">
                      {cat.name}
                    </Button>
                  </Link>
                ))}
              </div>
            )}
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
      <section className="relative overflow-hidden py-12 sm:py-16">
        <div className="from-primary/4 to-accent-violet/4 absolute inset-0 bg-linear-to-r" />
        <div className="relative container mx-auto px-4">
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

      {/* Recommendations — only for logged-in users */}
      <RecommendationSection
        context="homepage"
        limit={4}
        title={t('recommendedTitle')}
        subtitle={t('recommendedSubtitle')}
        requireAuth
      />

      {/* Why Us */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('whyUs.title')}</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">{t('whyUs.subtitle')}</p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-card border-border hover:shadow-primary/5 rounded-2xl border p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
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

      {/* Placement Test CTA */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="from-primary/10 mx-auto max-w-3xl rounded-2xl border bg-gradient-to-r to-violet-500/10 p-8 text-center sm:p-12">
            <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <Target className="text-primary h-7 w-7" />
            </div>
            <h2 className="mb-2 text-xl font-bold sm:text-2xl">{tp('ctaTitle')}</h2>
            <p className="text-muted-foreground mx-auto mb-6 max-w-lg">{tp('ctaDesc')}</p>
            <Link href="/placement-test">
              <Button size="lg" className="h-12 gap-2 rounded-full px-8">
                {tp('ctaButton')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
