'use client';

import { useTranslations } from 'next-intl';
import { Star, Users, Clock, BookOpen, Globe } from 'lucide-react';
import { Badge, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { formatDuration } from '@shared/utils';
import { cn } from '@/lib/utils';
import type { ApiCourse } from './types';

interface CourseHeroProps {
  course: ApiCourse;
}

export function CourseHero({ course }: CourseHeroProps) {
  const t = useTranslations('courseDetail');
  const instructorInitial = course.instructor.fullName.split(' ').pop()?.[0] ?? '';

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-600 to-violet-700 py-8 text-white sm:py-12">
      <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-300/10 blur-3xl" />
      <div className="relative container mx-auto px-4">
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            {course.category && (
              <Badge variant="secondary" className="border-0 bg-white/20 text-white">
                {course.category.name}
              </Badge>
            )}
          </div>
          <h1 className="mb-4 text-2xl font-bold sm:text-3xl lg:text-4xl">{course.title}</h1>
          {course.shortDescription && <p className="mb-4 opacity-90">{course.shortDescription}</p>}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="font-bold text-yellow-300">
                {course.avgRating > 0 ? course.avgRating.toFixed(1) : '—'}
              </span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-4 w-4',
                      star <= Math.floor(course.avgRating)
                        ? 'fill-yellow-300 text-yellow-300'
                        : 'text-white/40',
                    )}
                  />
                ))}
              </div>
              <span className="opacity-80">
                ({course.reviewCount.toLocaleString('en-US')} {t('ratings')})
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-90">
              <Users className="h-4 w-4" />
              {course.totalStudents.toLocaleString('en-US')} {t('students')}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm opacity-90">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(course.totalDuration)}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {course.totalLessons} {t('lessons')}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              {course.language === 'vi' ? 'Tiếng Việt' : 'English'}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {course.instructor.avatarUrl && (
                <AvatarImage src={course.instructor.avatarUrl} alt={course.instructor.fullName} />
              )}
              <AvatarFallback className="bg-white/20 text-xs text-white">
                {instructorInitial}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{course.instructor.fullName}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
