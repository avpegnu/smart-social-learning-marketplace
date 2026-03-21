'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookOpen, CheckCircle2, Award, TrendingUp, Play, Flame } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Progress,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
} from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import { useLearningDashboard } from '@shared/hooks';
import { cn } from '@/lib/utils';

// --- Types ---

// API spreads enrollment fields directly: { id, progress, courseId, course, nextLesson }
interface ActiveCourse {
  id: string;
  progress: number;
  courseId: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    totalLessons: number;
    instructor?: { fullName: string };
  };
  nextLesson: { id: string; title: string; type: string } | null;
}

interface CompletedCourse {
  id: string;
  progress: number;
  courseId: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    totalLessons: number;
    instructor?: { fullName: string };
  };
  firstLesson: { id: string; title: string; type: string } | null;
  certificate: { id: string; verifyCode: string } | null;
}

interface DashboardData {
  activeCourses: ActiveCourse[];
  completedCourses: CompletedCourse[];
  streak: { currentStreak: number; longestStreak: number; todayCompleted: boolean };
}

// --- Course Card ---

interface CourseCardProps {
  course: ActiveCourse['course'];
  progress: number;
  nextLesson?: { id: string; title: string } | null;
  firstLessonId?: string | null;
  isCompleted: boolean;
}

function CourseProgressCard({
  course,
  progress,
  nextLesson,
  firstLessonId,
  isCompleted,
}: CourseCardProps) {
  const t = useTranslations('myLearning');
  const progressPercent = Math.round(progress * 100);

  // In progress → next lesson, Completed → first lesson (review), fallback → course detail
  const targetLessonId = nextLesson?.id ?? firstLessonId;
  const learnUrl = targetLessonId
    ? `/courses/${course.slug}/lessons/${targetLessonId}`
    : `/courses/${course.slug}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="h-32 shrink-0 object-cover sm:h-auto sm:w-48"
          />
        ) : (
          <div className="from-primary/20 to-primary/5 flex h-32 shrink-0 items-center justify-center bg-gradient-to-br sm:h-auto sm:w-48">
            <BookOpen className="text-primary/40 h-8 w-8" />
          </div>
        )}
        <CardContent className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-sm font-semibold">{course.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{course.instructor?.fullName}</p>
            </div>
            <Badge variant={isCompleted ? 'default' : 'outline'} className="shrink-0">
              {isCompleted ? t('completed') : t('inProgress')}
            </Badge>
          </div>
          <div className="mt-3">
            <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
              {nextLesson && <span className="line-clamp-1">{nextLesson.title}</span>}
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
          <div className="mt-3">
            <Link href={learnUrl}>
              <Button size="sm" className="w-full gap-1">
                <Play className="h-3 w-3" />
                {isCompleted ? t('review') : t('continue')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// --- Main Page ---

export default function MyLearningPage() {
  const t = useTranslations('myLearning');
  const { data, isLoading } = useLearningDashboard();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const dashboard = data?.data as DashboardData | undefined;
  const activeCourses = dashboard?.activeCourses ?? [];
  const completedCourses = dashboard?.completedCourses ?? [];
  const streak = dashboard?.streak;
  const allCourses = [...activeCourses, ...completedCourses];

  const stats = [
    {
      icon: BookOpen,
      label: t('coursesInProgress'),
      value: activeCourses.length,
      color: 'text-primary bg-primary/10',
    },
    {
      icon: CheckCircle2,
      label: t('coursesCompleted'),
      value: completedCourses.length,
      color: 'text-success bg-success/10',
    },
    {
      icon: Flame,
      label: t('learningStreak'),
      value: `${streak?.currentStreak ?? 0} ${t('days')}`,
      color: 'text-warning bg-warning/10',
    },
    {
      icon: Award,
      label: t('certificates'),
      value: completedCourses.filter((c) => c.certificate).length,
      color: 'text-primary bg-primary/10',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  color,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-muted-foreground text-xs">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Streak info */}
      {streak && (
        <Card className="mb-8">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="bg-warning/10 flex h-12 w-12 items-center justify-center rounded-xl">
              <TrendingUp className="text-warning h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {t('currentStreak')}:{' '}
                <span className="text-primary font-bold">
                  {streak.currentStreak} {t('days')}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                {t('longestStreak')}: {streak.longestStreak} {t('days')}
                {streak.todayCompleted && (
                  <span className="text-success ml-2">✓ {t('todayDone')}</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Courses */}
      {allCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          actionLabel={t('browseCourses')}
          onAction={() => {}}
        />
      ) : (
        <Tabs defaultValue="inProgress">
          <TabsList className="mb-6">
            <TabsTrigger value="inProgress">
              {t('inProgress')} ({activeCourses.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t('completed')} ({completedCourses.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              {t('all')} ({allCourses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inProgress">
            <div className="space-y-4">
              {activeCourses.map((item) => (
                <CourseProgressCard
                  key={item.id ?? item.course?.id}
                  course={item.course}
                  progress={item.progress ?? 0}
                  nextLesson={item.nextLesson}
                  isCompleted={false}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-4">
              {completedCourses.map((item) => (
                <CourseProgressCard
                  key={item.id ?? item.course?.id}
                  course={item.course}
                  progress={item.progress ?? 1}
                  firstLessonId={item.firstLesson?.id}
                  isCompleted={true}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="all">
            <div className="space-y-4">
              {activeCourses.map((item) => (
                <CourseProgressCard
                  key={item.id ?? item.course?.id}
                  course={item.course}
                  progress={item.progress ?? 0}
                  nextLesson={item.nextLesson}
                  isCompleted={false}
                />
              ))}
              {completedCourses.map((item) => (
                <CourseProgressCard
                  key={item.id ?? item.course?.id}
                  course={item.course}
                  progress={item.progress ?? 1}
                  firstLessonId={item.firstLesson?.id}
                  isCompleted={true}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
