import { Skeleton } from '@shared/ui';

export default function Loading() {
  return (
    <div className="min-h-screen">
      {/* Navbar Skeleton */}
      <div className="flex h-16 items-center gap-4 border-b px-4">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-64 rounded-lg" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Content Skeleton */}
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border p-4">
              <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
              <Skeleton className="mb-1 h-6 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 rounded-lg border p-4">
              <Skeleton className="h-24 w-40 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
