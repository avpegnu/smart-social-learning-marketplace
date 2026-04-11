'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BookOpen, Menu, X } from 'lucide-react';
import { Progress, Skeleton } from '@shared/ui';
import { useLesson, useCourseDetail } from '@shared/hooks';
import { VideoPlayer } from '@/components/learning/video-player';
import { TextViewer } from '@/components/learning/text-viewer';
import { QuizPlayer } from '@/components/learning/quiz-player';
import { FileLessonViewer } from '@/components/learning/file-lesson-viewer';
import { CurriculumSidebar } from '@/components/learning/curriculum-sidebar';
import { LessonNav } from '@/components/learning/lesson-nav';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

// --- Types ---

interface LessonData {
  id: string;
  title: string;
  type: string;
  textContent: string | null;
  videoUrl: string | null;
  fileUrl: string | null;
  fileMimeType: string | null;
  estimatedDuration: number | null;
  isCompleted: boolean;
  progress: {
    lastPosition: number;
    watchedPercent: number;
    watchedSegments: [number, number][];
  } | null;
  quiz: {
    id: string;
    title: string;
    passingScore: number;
    maxAttempts: number;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      order: number;
      options: Array<{ id: string; text: string; order: number }>;
    }>;
  } | null;
  media: Array<{ url: string; type: string }>;
}

interface CurriculumLesson {
  id: string;
  title: string;
  type: string;
  estimatedDuration: number | null;
  isCompleted: boolean;
}

interface CurriculumChapter {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  lessons: CurriculumLesson[];
}

interface CurriculumSection {
  id: string;
  title: string;
  order: number;
  chapters: CurriculumChapter[];
}

// --- Header Content (portaled into layout slot) ---

function HeaderContent({ title, progress }: { title: string; progress: number }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById('learning-header-slot'));
  }, []);

  if (!container) return null;

  return createPortal(
    <div>
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <div className="mt-1 flex items-center gap-2">
        <Progress value={Math.round(progress * 100)} className="h-1.5 max-w-xs flex-1" />
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>,
    container,
  );
}

// --- Main Page ---

export default function LessonPlayerPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = use(params);
  const t = useTranslations('learning');
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Resolve courseId from slug
  const { data: courseData } = useCourseDetail(slug);
  const course = courseData?.data as { id: string; title: string } | undefined;
  const courseId = course?.id ?? '';

  // Fetch lesson + curriculum
  const { data: lessonData, isLoading, error: lessonError } = useLesson(courseId, lessonId);
  const lesson = lessonData?.data as
    | { lesson: LessonData; curriculum: CurriculumSection[] }
    | undefined;

  // Flatten curriculum to get prev/next lesson IDs
  const flatLessons = useMemo(() => {
    if (!lesson?.curriculum) return [];
    const flat: string[] = [];
    for (const section of lesson.curriculum) {
      for (const chapter of section.chapters) {
        for (const l of chapter.lessons) {
          flat.push(l.id);
        }
      }
    }
    return flat;
  }, [lesson?.curriculum]);

  const currentIndex = flatLessons.indexOf(lessonId);
  const prevLessonId = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLessonId = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  // Calculate course progress from curriculum
  const courseProgress = useMemo(() => {
    if (!lesson?.curriculum) return 0;
    let total = 0;
    let completed = 0;
    for (const section of lesson.curriculum) {
      for (const chapter of section.chapters) {
        for (const l of chapter.lessons) {
          total++;
          if (l.isCompleted) completed++;
        }
      }
    }
    return total > 0 ? completed / total : 0;
  }, [lesson?.curriculum]);

  const handleNavigate = (targetLessonId: string) => {
    router.push(`/courses/${slug}/lessons/${targetLessonId}`);
  };

  // Access denied or error → show error state (no redirect, stay on page)
  const lessonErrorCode = (lessonError as { code?: string })?.code;

  // Error state — show inline message, stay on page
  if (lessonError) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <BookOpen className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
          <h2 className="mb-2 text-xl font-semibold">
            {lessonErrorCode === 'LESSON_ACCESS_DENIED' ? t('accessDenied') : t('lessonError')}
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            {lessonErrorCode === 'LESSON_ACCESS_DENIED'
              ? t('accessDeniedDesc')
              : t('lessonErrorDesc')}
          </p>
          <button onClick={() => router.back()} className="text-primary text-sm hover:underline">
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading || !lesson) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <Skeleton className="aspect-video max-h-[70vh] w-full" />
          <div className="space-y-4 p-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="hidden w-80 lg:block">
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  const { lesson: lessonContent, curriculum } = lesson;

  // Determine video URL
  const videoUrl =
    lessonContent.videoUrl ?? lessonContent.media?.find((m) => m.type === 'VIDEO')?.url ?? null;

  return (
    <>
      {/* Portal course title + progress into layout header */}
      {course && <HeaderContent title={course.title} progress={courseProgress} />}

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Lesson content by type */}
          <div className="flex-1 overflow-y-auto">
            {lessonContent.type === 'VIDEO' && videoUrl ? (
              <div>
                <VideoPlayer
                  lessonId={lessonId}
                  videoUrl={videoUrl}
                  lastPosition={lessonContent.progress?.lastPosition ?? 0}
                  watchedSegments={lessonContent.progress?.watchedSegments ?? []}
                />
                <div className="max-w-3xl p-6">
                  <h2 className="text-xl font-semibold">{lessonContent.title}</h2>
                </div>
              </div>
            ) : lessonContent.type === 'TEXT' && lessonContent.textContent ? (
              <TextViewer
                lessonId={lessonId}
                textContent={lessonContent.textContent}
                isCompleted={lessonContent.isCompleted}
              />
            ) : lessonContent.type === 'QUIZ' && lessonContent.quiz ? (
              <QuizPlayer
                lessonId={lessonId}
                quiz={lessonContent.quiz}
                isCompleted={lessonContent.isCompleted}
              />
            ) : lessonContent.type === 'FILE' && lessonContent.fileUrl ? (
              <FileLessonViewer
                lessonId={lessonId}
                fileUrl={lessonContent.fileUrl}
                fileMimeType={lessonContent.fileMimeType ?? 'application/octet-stream'}
                fileName={lessonContent.title}
                isCompleted={lessonContent.isCompleted}
              />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <BookOpen className="text-muted-foreground/50 mx-auto mb-3 h-12 w-12" />
                  <p className="text-muted-foreground">{t('noContent')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Lesson navigation */}
          <LessonNav
            prevLessonId={prevLessonId}
            nextLessonId={nextLessonId}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Curriculum sidebar — desktop */}
        <div
          className={cn(
            'hidden transition-all duration-300 lg:block',
            sidebarOpen ? 'w-80' : 'w-0',
          )}
        >
          {sidebarOpen && (
            <CurriculumSidebar
              curriculum={curriculum}
              currentLessonId={lessonId}
              onLessonClick={handleNavigate}
            />
          )}
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-primary text-primary-foreground fixed right-4 bottom-20 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-lg lg:hidden"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="absolute top-14 right-0 bottom-0 w-80">
              <CurriculumSidebar
                curriculum={curriculum}
                currentLessonId={lessonId}
                onLessonClick={(id) => {
                  handleNavigate(id);
                  setSidebarOpen(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
