'use client';

import { Sparkles } from 'lucide-react';
import { useRecommendations, useAuthStore } from '@shared/hooks';
import type { RecommendationContext } from '@shared/hooks';
import { CourseCard } from './course-card';
import type { CourseCardCourse } from './course-card';
import { Skeleton } from '@shared/ui';

interface RecommendationSectionProps {
  context: RecommendationContext;
  courseId?: string;
  limit?: number;
  title: string;
  subtitle?: string;
  requireAuth?: boolean;
}

export function RecommendationSection({
  context,
  courseId,
  limit = 4,
  title,
  subtitle,
  requireAuth = false,
}: RecommendationSectionProps) {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useRecommendations(context, {
    courseId,
    limit,
    enabled: requireAuth ? !!user : true,
  });

  const courses = (data?.data ?? data ?? []) as CourseCardCourse[];

  // Hide section entirely if no results and not loading
  if (!isLoading && courses.length === 0) return null;

  // Hide if auth required but not logged in
  if (requireAuth && !user) return null;

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
