'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Star, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent, Badge, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { formatPrice, formatDuration } from '@shared/utils';
import { cn } from '@/lib/utils';

// Loose interface to accept both real API data and legacy mock data
export interface CourseCardCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl?: string | null;
  price: number;
  originalPrice?: number | null;
  avgRating?: number;
  reviewCount?: number;
  totalStudents?: number;
  totalLessons?: number;
  totalDuration?: number | string;
  publishedAt?: string;
  instructor: { id?: string; fullName?: string; name?: string; avatarUrl?: string | null };
  category?: { id: string; name: string; slug: string } | string;
  // Legacy mock fields
  rating?: number;
  totalRatings?: number;
}

interface CourseCardProps {
  course: CourseCardCourse;
  className?: string;
}

export function CourseCard({ course, className }: CourseCardProps) {
  const t = useTranslations('course');

  const isNew =
    course.publishedAt &&
    Date.now() - new Date(course.publishedAt).getTime() < 30 * 24 * 60 * 60 * 1000;

  const instructorName = course.instructor.fullName ?? course.instructor.name ?? '';
  const initials = instructorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(-2);

  const avgRating = course.avgRating ?? course.rating ?? 0;
  const reviewCount = course.reviewCount ?? course.totalRatings ?? 0;
  const totalLessons = course.totalLessons ?? 0;
  const totalDuration = typeof course.totalDuration === 'number' ? course.totalDuration : 0;

  const originalPrice = course.originalPrice ?? undefined;
  const discount =
    originalPrice && originalPrice > course.price
      ? Math.round(((originalPrice - course.price) / originalPrice) * 100)
      : 0;

  return (
    <Link href={`/courses/${course.slug}`}>
      <Card
        className={cn(
          'group hover:shadow-primary/5 hover:border-primary/30 h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
          className,
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="from-primary/20 to-primary/5 flex h-full w-full items-center justify-center bg-gradient-to-br">
              <BookOpen className="text-primary/30 h-12 w-12" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
          {isNew && (
            <Badge className="bg-success text-success-foreground absolute top-2 left-2">
              {t('new')}
            </Badge>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-4">
          {/* Title */}
          <h3 className="group-hover:text-primary mb-1 line-clamp-2 text-sm font-semibold transition-colors">
            {course.title}
          </h3>

          {/* Instructor */}
          <div className="mb-2 flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {course.instructor.avatarUrl && (
                <AvatarImage src={course.instructor.avatarUrl} alt={instructorName} />
              )}
              <AvatarFallback className="bg-muted text-[8px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground truncate text-xs">{instructorName}</span>
          </div>

          {/* Rating */}
          <div className="mb-2 flex items-center gap-1">
            <span className="text-warning text-sm font-bold">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </span>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-3.5 w-3.5',
                    star <= Math.floor(avgRating)
                      ? 'fill-warning text-warning'
                      : star <= avgRating
                        ? 'fill-warning/50 text-warning'
                        : 'text-muted-foreground/30',
                  )}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-xs">
              ({reviewCount.toLocaleString('en-US')})
            </span>
          </div>

          {/* Meta */}
          <div className="text-muted-foreground mb-3 flex items-center gap-3 text-xs">
            {totalDuration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(totalDuration)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {totalLessons} {t('lessons')}
            </span>
          </div>

          {/* Price */}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {course.price === 0 ? (
              <span className="text-success text-base font-bold">{t('free')}</span>
            ) : (
              <>
                <span className="text-foreground text-base font-bold">
                  {formatPrice(course.price)}
                </span>
                {discount > 0 && originalPrice && (
                  <>
                    <span className="text-muted-foreground text-xs line-through">
                      {formatPrice(originalPrice)}
                    </span>
                    <span className="text-success text-xs font-semibold">-{discount}%</span>
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
