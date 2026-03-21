'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, Skeleton } from '@shared/ui';
import { CourseCard } from './course-card';
import type { CourseCardCourse } from './course-card';

interface CourseGridProps {
  courses: CourseCardCourse[];
  isLoading?: boolean;
  skeletonCount?: number;
  className?: string;
  columns?: 2 | 3 | 4;
}

function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-1/3" />
      </CardContent>
    </Card>
  );
}

export function CourseGrid({
  courses,
  isLoading,
  skeletonCount = 4,
  className,
  columns = 4,
}: CourseGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  if (isLoading) {
    return (
      <div className={cn('grid gap-6', gridCols[columns], className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-6', gridCols[columns], className)}>
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
