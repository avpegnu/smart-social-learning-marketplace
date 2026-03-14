'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Star, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent, Badge, Avatar, AvatarFallback } from '@shared/ui';
import { PriceDisplay } from './price-display';
import { cn } from '@/lib/utils';
import type { Course } from '@/lib/mock-data';

interface CourseCardProps {
  course: Course;
  className?: string;
}

export function CourseCard({ course, className }: CourseCardProps) {
  const t = useTranslations('course');

  return (
    <Link href={`/courses/${course.slug}`}>
      <Card
        className={cn(
          'group h-full overflow-hidden transition-all duration-300 hover:shadow-lg',
          className,
        )}
      >
        {/* Thumbnail */}
        <div className="from-primary/20 to-primary/5 relative aspect-video overflow-hidden bg-gradient-to-br">
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="text-primary/30 h-12 w-12" />
          </div>
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
          {course.isBestseller && (
            <Badge className="bg-warning text-warning-foreground absolute top-2 left-2">
              {t('bestseller')}
            </Badge>
          )}
          {course.isNew && (
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
              <AvatarFallback className="bg-muted text-[8px]">
                {course.instructor.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(-2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground truncate text-xs">{course.instructor.name}</span>
          </div>

          {/* Rating */}
          <div className="mb-2 flex items-center gap-1">
            <span className="text-warning text-sm font-bold">{course.rating}</span>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-3.5 w-3.5',
                    star <= Math.floor(course.rating)
                      ? 'fill-warning text-warning'
                      : star <= course.rating
                        ? 'fill-warning/50 text-warning'
                        : 'text-muted-foreground/30',
                  )}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-xs">
              ({course.totalRatings.toLocaleString('en-US')})
            </span>
          </div>

          {/* Meta */}
          <div className="text-muted-foreground mb-3 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {course.totalDuration}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {course.totalLessons} {t('lessons')}
            </span>
          </div>

          {/* Price */}
          <div className="mt-auto">
            <PriceDisplay price={course.price} originalPrice={course.originalPrice} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
