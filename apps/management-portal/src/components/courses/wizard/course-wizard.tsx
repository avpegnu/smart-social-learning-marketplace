'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@shared/ui';
import { useInstructorCourseDetail } from '@shared/hooks';
import { Check } from 'lucide-react';

import { StepBasics } from './step-basics';
import { StepCurriculum } from './step-curriculum';
import { StepPricing } from './step-pricing';
import { StepReview } from './step-review';
import type { CourseBasicsValues } from '@/lib/validations/course';

// ── Types ──

export interface LocalQuizData {
  passingScore: number;
  maxAttempts?: number;
  timeLimitSeconds?: number;
  questions: Array<{
    question: string;
    explanation: string;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
}

export interface LocalLesson {
  id?: string;
  tempId: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'FILE';
  textContent?: string;
  estimatedDuration?: number;
  videoUrl?: string;
  fileUrl?: string;
  fileMimeType?: string;
  quizData?: LocalQuizData;
  chapterId?: string;
  order?: number;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface LocalChapter {
  id?: string;
  tempId: string;
  title: string;
  description?: string;
  order: number;
  price?: number;
  isFreePreview?: boolean;
  sectionId?: string;
  lessons: LocalLesson[];
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export interface LocalSection {
  id?: string;
  tempId: string;
  title: string;
  order: number;
  chapters: LocalChapter[];
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

interface CourseWizardProps {
  mode: 'create' | 'edit';
  courseId?: string;
}

const STEPS = [
  { key: 'step1', label: 'basicInfo' },
  { key: 'step2', label: 'curriculum' },
  { key: 'step3', label: 'pricing' },
  { key: 'step4', label: 'reviewSubmit' },
] as const;

// ── Component ──

export function CourseWizard({ mode, courseId: initialCourseId }: CourseWizardProps) {
  const t = useTranslations('courseWizard');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Step from URL query param (for redirect after create)
  const stepFromUrl = Number(searchParams.get('step')) || 1;
  const [currentStep, setCurrentStep] = useState(stepFromUrl);
  const [courseId, setCourseId] = useState<string | undefined>(initialCourseId);

  // State for each step (preserved when navigating between steps)
  const [basicInfoValues, setBasicInfoValues] = useState<CourseBasicsValues | null>(null);
  const [curriculumState, setCurriculumState] = useState<LocalSection[]>([]);
  const [curriculumLoaded, setCurriculumLoaded] = useState(false);

  // Load course data in edit mode
  const { data: courseData, isLoading } = useInstructorCourseDetail(courseId ?? '');
  const course = courseData?.data as Record<string, unknown> | undefined;

  // Initialize curriculum from server data (only once)
  useEffect(() => {
    const sections = course?.sections as Array<Record<string, unknown>> | undefined;
    if (sections && !curriculumLoaded) {
      setCurriculumState(
        sections.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          tempId: s.id as string,
          title: s.title as string,
          order: s.order as number,
          chapters: ((s.chapters as Record<string, unknown>[]) ?? []).map(
            (ch: Record<string, unknown>) => ({
              id: ch.id as string,
              tempId: ch.id as string,
              title: ch.title as string,
              description: (ch.description as string) ?? '',
              order: ch.order as number,
              price: (ch.price as number) ?? 0,
              isFreePreview: (ch.isFreePreview as boolean) ?? false,
              sectionId: s.id as string,
              lessons: ((ch.lessons as Record<string, unknown>[]) ?? []).map(
                (l: Record<string, unknown>) => {
                  const quiz = l.quiz as Record<string, unknown> | undefined;
                  return {
                    id: l.id as string,
                    tempId: l.id as string,
                    title: l.title as string,
                    type: l.type as 'VIDEO' | 'TEXT' | 'QUIZ' | 'FILE',
                    textContent: (l.textContent as string) ?? '',
                    estimatedDuration: (l.estimatedDuration as number) ?? 0,
                    videoUrl: (l.videoUrl as string) ?? undefined,
                    fileUrl: (l.fileUrl as string) ?? undefined,
                    fileMimeType: (l.fileMimeType as string) ?? undefined,
                    chapterId: ch.id as string,
                    quizData: quiz
                      ? {
                          passingScore: (quiz.passingScore as number) ?? 0.7,
                          maxAttempts: quiz.maxAttempts as number | undefined,
                          timeLimitSeconds: quiz.timeLimitSeconds as number | undefined,
                          questions: ((quiz.questions as Array<Record<string, unknown>>) ?? []).map(
                            (q) => ({
                              question: q.question as string,
                              explanation: (q.explanation as string) ?? '',
                              options: ((q.options as Array<Record<string, unknown>>) ?? []).map(
                                (o) => ({
                                  text: o.text as string,
                                  isCorrect: o.isCorrect as boolean,
                                }),
                              ),
                            }),
                          ),
                        }
                      : undefined,
                  };
                },
              ),
            }),
          ),
        })),
      );
      setCurriculumLoaded(true);
    }
  }, [course, curriculumLoaded]);

  // Completed steps tracking
  const completedSteps = new Set<number>();
  if (courseId) completedSteps.add(1);
  if (curriculumState.some((s) => !s.isDeleted && s.chapters.some((ch) => !ch.isDeleted)))
    completedSteps.add(2);
  if (course?.price !== undefined) completedSteps.add(3);

  const handleStepClick = useCallback(
    (step: number) => {
      // In create mode, can only go to completed steps or current+1
      if (mode === 'create' && !courseId && step > 1) return;
      setCurrentStep(step);
    },
    [mode, courseId],
  );

  const handleCourseCreated = useCallback(
    (newCourseId: string) => {
      setCourseId(newCourseId);
      router.replace(`/instructor/courses/${newCourseId}/edit?step=2`);
    },
    [router],
  );

  // Warn on unsaved changes when leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (curriculumState.some((s) => s.isNew || s.isModified || s.isDeleted)) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [curriculumState]);

  if (mode === 'edit' && isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-12 w-full animate-pulse rounded" />
        <div className="bg-muted h-96 w-full animate-pulse rounded" />
      </div>
    );
  }

  const courseStatus = (course?.status as string) ?? 'DRAFT';
  const isReadOnly = courseStatus === 'PENDING_REVIEW';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {mode === 'create' ? t('createTitle') : t('editTitle')}
      </h1>

      {isReadOnly && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          {t('courseReadOnly')}
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const stepNum = index + 1;
          const isActive = currentStep === stepNum;
          const isCompleted = completedSteps.has(stepNum);
          const isClickable = mode === 'edit' || isCompleted || stepNum <= currentStep;

          return (
            <div key={step.key} className="flex items-center">
              {index > 0 && (
                <div
                  className={cn(
                    'mx-2 h-px w-8 sm:w-16',
                    isCompleted || stepNum <= currentStep ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => isClickable && handleStepClick(stepNum)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  !isActive && isCompleted && 'border-primary bg-background text-primary',
                  !isActive && !isCompleted && 'border-border bg-background text-muted-foreground',
                  !isClickable && 'cursor-not-allowed opacity-50',
                  isClickable && !isActive && 'hover:border-primary/50 cursor-pointer',
                )}
              >
                {isCompleted && !isActive ? <Check className="h-4 w-4" /> : <span>{stepNum}</span>}
                <span className="hidden sm:inline">{t(step.label)}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <StepBasics
          mode={mode}
          courseId={courseId}
          course={course}
          savedValues={basicInfoValues}
          onSaveValues={setBasicInfoValues}
          onNext={() => setCurrentStep(2)}
          onCourseCreated={handleCourseCreated}
          isReadOnly={isReadOnly}
        />
      )}

      {currentStep === 2 && courseId && (
        <StepCurriculum
          courseId={courseId}
          sections={curriculumState}
          onSectionsChange={setCurriculumState}
          onPrevious={() => setCurrentStep(1)}
          onNext={() => setCurrentStep(3)}
          isReadOnly={isReadOnly}
        />
      )}

      {currentStep === 3 && courseId && (
        <StepPricing
          courseId={courseId}
          course={course}
          sections={curriculumState}
          onPrevious={() => setCurrentStep(2)}
          onNext={() => setCurrentStep(4)}
          isReadOnly={isReadOnly}
        />
      )}

      {currentStep === 4 && courseId && (
        <StepReview courseId={courseId} onPrevious={() => setCurrentStep(3)} />
      )}
    </div>
  );
}
