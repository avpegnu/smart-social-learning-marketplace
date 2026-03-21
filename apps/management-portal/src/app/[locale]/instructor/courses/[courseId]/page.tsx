'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Pencil, ArrowLeft, Tag } from 'lucide-react';
import { Button, Badge, Skeleton, Separator } from '@shared/ui';
import { useInstructorCourseDetail } from '@shared/hooks';
import { formatPrice } from '@shared/utils';

import { CourseInfoCard } from '@/components/courses/detail/course-info-card';
import { CourseStats } from '@/components/courses/detail/course-stats';
import { CourseCurriculum } from '@/components/courses/detail/course-curriculum';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_REVIEW: 'outline',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
};

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const t = useTranslations('courseDetail');
  const tc = useTranslations('common');
  const router = useRouter();
  const { data: courseData, isLoading } = useInstructorCourseDetail(courseId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const course = courseData?.data as Record<string, unknown> | undefined;
  if (!course) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  const sections = (course.sections as Array<Record<string, unknown>>) ?? [];
  const category = course.category as Record<string, unknown> | undefined;
  const learningOutcomes = (course.learningOutcomes as string[]) ?? [];
  const prerequisites = (course.prerequisites as string[]) ?? [];
  const tags = (course.tags as Array<Record<string, unknown>>) ?? [];
  const status = course.status as string;

  // Count totals
  let totalLessons = 0;
  let totalDuration = 0;
  let totalChapters = 0;
  for (const section of sections) {
    const chapters = (section.chapters as Array<Record<string, unknown>>) ?? [];
    totalChapters += chapters.length;
    for (const chapter of chapters) {
      const lessons = (chapter.lessons as Array<Record<string, unknown>>) ?? [];
      totalLessons += lessons.length;
      for (const lesson of lessons) {
        totalDuration += (lesson.estimatedDuration as number) ?? 0;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/instructor/courses')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('backToCourses')}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/instructor/courses/${courseId}/edit`)}
        >
          <Pencil className="mr-1 h-4 w-4" />
          {t('editCourse')}
        </Button>
      </div>

      {/* Title & Status */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{course.title as string}</h1>
          <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'}>
            {tc(`courseStatus.${status}`)}
          </Badge>
        </div>
        {(course.shortDescription as string) && (
          <p className="text-muted-foreground">{course.shortDescription as string}</p>
        )}
      </div>

      {/* Stats */}
      <CourseStats
        totalStudents={(course.totalStudents as number) ?? 0}
        avgRating={(course.avgRating as number) ?? null}
        totalReviews={(course.totalReviews as number) ?? 0}
        totalDuration={totalDuration}
        sectionCount={sections.length}
        chapterCount={totalChapters}
        lessonCount={totalLessons}
      />

      <Separator />

      {/* Basic Info */}
      <CourseInfoCard course={course} category={category} />

      {/* Learning Outcomes & Prerequisites */}
      {(learningOutcomes.length > 0 || prerequisites.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {learningOutcomes.length > 0 && (
            <div className="border-border space-y-2 rounded-lg border p-6">
              <h3 className="text-sm font-semibold">{t('learningOutcomes')}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {learningOutcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {prerequisites.length > 0 && (
            <div className="border-border space-y-2 rounded-lg border p-6">
              <h3 className="text-sm font-semibold">{t('prerequisites')}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {prerequisites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="border-border space-y-2 rounded-lg border p-6">
          <h3 className="text-sm font-semibold">{t('tags')}</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag.id as string} variant="outline">
                <Tag className="mr-1 h-3 w-3" />
                {(tag.tag as Record<string, unknown>)?.name as string}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Curriculum */}
      <CourseCurriculum sections={sections} />

      {/* Pricing */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t('pricing')}</h2>
        <div className="text-sm">
          <span className="text-muted-foreground">{t('coursePrice')}: </span>
          <span className="text-lg font-bold">
            {(course.price as number) === 0
              ? t('free')
              : formatPrice((course.price as number) ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
