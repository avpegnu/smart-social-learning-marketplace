'use client';

import { Skeleton } from '@shared/ui';

export function CourseDetailSkeleton() {
  return (
    <div>
      <div className="bg-primary/5 py-8 sm:py-12">
        <div className="container mx-auto space-y-4 px-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="flex-1 space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="hidden w-80 lg:block">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
