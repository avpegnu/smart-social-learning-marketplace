'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { CheckCircle2, XCircle, Video, FileText, HelpCircle } from 'lucide-react';
import { Button, Badge, Skeleton } from '@shared/ui';
import { useInstructorCourseDetail, useSubmitCourseForReview } from '@shared/hooks';
import { formatPrice } from '@shared/utils';
import { toast } from 'sonner';

interface StepReviewProps {
  courseId: string;
  onPrevious: () => void;
}

const LESSON_TYPE_ICONS = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: HelpCircle,
} as const;

export function StepReview({ courseId, onPrevious }: StepReviewProps) {
  const t = useTranslations('courseWizard');
  const router = useRouter();
  const { data: courseData, isLoading } = useInstructorCourseDetail(courseId);
  const submitMutation = useSubmitCourseForReview();

  const course = courseData?.data as Record<string, unknown> | undefined;

  if (isLoading || !course) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const sections = (course.sections as Array<Record<string, unknown>>) ?? [];
  const category = course.category as Record<string, unknown> | undefined;
  const learningOutcomes = (course.learningOutcomes as string[]) ?? [];
  const prerequisites = (course.prerequisites as string[]) ?? [];

  // Count total lessons
  let totalLessons = 0;
  for (const section of sections) {
    for (const chapter of (section.chapters as Array<Record<string, unknown>>) ?? []) {
      totalLessons += ((chapter.lessons as unknown[]) ?? []).length;
    }
  }

  // Completeness checks
  const checks = [
    { key: 'checkTitle', pass: !!(course.title as string) },
    {
      key: 'checkDescription',
      pass: !!course.description && (course.description as string).length >= 50,
    },
    { key: 'checkCategory', pass: !!course.categoryId },
    { key: 'checkSections', pass: sections.length > 0 },
    {
      key: 'checkChapters',
      pass: sections.some((s) => ((s.chapters as unknown[]) ?? []).length > 0),
    },
    { key: 'checkLessons', pass: totalLessons > 0 },
  ];

  const allPassed = checks.every((c) => c.pass);

  const handleSubmit = () => {
    submitMutation.mutate(courseId, {
      onSuccess: () => {
        toast.success(t('courseSubmitted'));
        router.push('/instructor/courses');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info Summary */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <h3 className="text-lg font-semibold">{t('basicInfoSummary')}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t('title')}:</span>{' '}
            <span className="font-medium">{course.title as string}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('category')}:</span>{' '}
            <span className="font-medium">{(category?.name as string) ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('level')}:</span>{' '}
            <Badge variant="outline">{course.level as string}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">{t('language')}:</span>{' '}
            <span className="font-medium">{course.language as string}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('coursePrice')}:</span>{' '}
            <span className="font-medium">
              {(course.price as number) === 0
                ? t('freeCourse')
                : formatPrice((course.price as number) ?? 0)}
            </span>
            {(course.originalPrice as number) > 0 &&
              (course.originalPrice as number) > (course.price as number) && (
                <>
                  {' '}
                  <span className="text-muted-foreground text-sm line-through">
                    {formatPrice(course.originalPrice as number)}
                  </span>
                  <span className="text-success ml-1 text-sm font-medium">
                    -
                    {Math.round(
                      (((course.originalPrice as number) - (course.price as number)) /
                        (course.originalPrice as number)) *
                        100,
                    )}
                    %
                  </span>
                </>
              )}
          </div>
        </div>
        {(course.thumbnailUrl as string) && (
          <img
            src={course.thumbnailUrl as string}
            alt="Thumbnail"
            className="h-32 w-auto rounded-md object-cover"
          />
        )}
      </div>

      {/* Curriculum Summary */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <h3 className="text-lg font-semibold">
          {t('curriculumSummary')} ({sections.length} {t('sections')}, {totalLessons} {t('lessons')}
          )
        </h3>
        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.id as string}>
              <p className="text-sm font-medium">{section.title as string}</p>
              {((section.chapters as Array<Record<string, unknown>>) ?? []).map((chapter) => (
                <div key={chapter.id as string} className="ml-4">
                  <p className="text-muted-foreground text-sm">{chapter.title as string}</p>
                  {((chapter.lessons as Array<Record<string, unknown>>) ?? []).map((lesson) => {
                    const type = lesson.type as keyof typeof LESSON_TYPE_ICONS;
                    const TypeIcon = LESSON_TYPE_ICONS[type] ?? FileText;
                    return (
                      <div
                        key={lesson.id as string}
                        className="text-muted-foreground ml-4 flex items-center gap-1.5 text-xs"
                      >
                        <TypeIcon className="h-3 w-3" />
                        <span>{lesson.title as string}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Learning Outcomes & Prerequisites */}
      {(learningOutcomes.length > 0 || prerequisites.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {learningOutcomes.length > 0 && (
            <div className="border-border space-y-2 rounded-lg border p-4">
              <h4 className="text-sm font-medium">{t('learningOutcomes')}</h4>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
                {learningOutcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {prerequisites.length > 0 && (
            <div className="border-border space-y-2 rounded-lg border p-4">
              <h4 className="text-sm font-medium">{t('prerequisites')}</h4>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
                {prerequisites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Completeness Checklist */}
      <div className="border-border space-y-3 rounded-lg border p-6">
        <h3 className="text-lg font-semibold">{t('checklist')}</h3>
        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.key} className="flex items-center gap-2">
              {check.pass ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="text-destructive h-5 w-5" />
              )}
              <span className="text-sm">{t(check.key)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onPrevious}>
          {t('previous')}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              toast.success(t('savedSuccess'));
              router.push('/instructor/courses');
            }}
          >
            {t('saveDraft')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!allPassed || submitMutation.isPending}
          >
            {submitMutation.isPending ? t('submitting') : t('submitForReview')}
          </Button>
        </div>
      </div>

      {!allPassed && (
        <p className="text-muted-foreground text-center text-sm">{t('allChecksMustPass')}</p>
      )}
    </div>
  );
}
