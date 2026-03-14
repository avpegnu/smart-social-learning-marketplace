'use client';

import { cn } from '@/lib/utils';
import { CourseCard } from './course-card';
import type { Course } from '@/lib/mock-data';

interface CourseGridProps {
  courses: Course[];
  className?: string;
  columns?: 2 | 3 | 4;
}

export function CourseGrid({ courses, className, columns = 4 }: CourseGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6', gridCols[columns], className)}>
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
