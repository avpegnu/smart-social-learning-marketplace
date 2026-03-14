'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookOpen, CheckCircle2, Clock, Award, TrendingUp, Play } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Progress,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { mockEnrolledCourses, learningStats, streakData } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

function StreakCalendar() {
  const t = useTranslations('myLearning');
  const last12Weeks = streakData.slice(-84);
  const weeks: (typeof last12Weeks)[] = [];
  for (let i = 0; i < last12Weeks.length; i += 7) {
    weeks.push(last12Weeks.slice(i, i + 7));
  }

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    if (count === 1) return 'bg-primary/25';
    if (count === 2) return 'bg-primary/50';
    if (count === 3) return 'bg-primary/75';
    return 'bg-primary';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          {t('learningStreak')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={cn('h-3 w-3 rounded-sm', getColor(day.count))}
                  title={`${day.date}: ${day.count} activities`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
          <span>{t('less')}</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div key={level} className={cn('h-3 w-3 rounded-sm', getColor(level))} />
          ))}
          <span>{t('more')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseProgressCard({ course }: { course: (typeof mockEnrolledCourses)[0] }) {
  const t = useTranslations('myLearning');

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="from-primary/20 to-primary/5 flex h-32 shrink-0 items-center justify-center bg-gradient-to-br sm:h-auto sm:w-48">
          <BookOpen className="text-primary/40 h-8 w-8" />
        </div>
        <CardContent className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-sm font-semibold">{course.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{course.instructor.name}</p>
            </div>
            {course.progress === 100 ? (
              <Badge variant="success" className="shrink-0">
                {t('completed')}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                {t('inProgress')}
              </Badge>
            )}
          </div>
          <div className="mt-3">
            <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
              <span>{course.currentLesson}</span>
              <span>{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-1.5" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {t('lastAccessed')}: {course.lastAccessed}
            </span>
            <Link href={`/courses/${course.slug}`}>
              <Button size="sm" variant="ghost" className="h-8 gap-1">
                <Play className="h-3 w-3" />
                {course.progress === 100 ? t('review') : t('continue')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function MyLearningPage() {
  const t = useTranslations('myLearning');

  const stats = [
    {
      icon: BookOpen,
      label: t('coursesInProgress'),
      value: learningStats.coursesInProgress,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      icon: CheckCircle2,
      label: t('coursesCompleted'),
      value: learningStats.coursesCompleted,
      color: 'text-green-500 bg-green-500/10',
    },
    {
      icon: Clock,
      label: t('totalHours'),
      value: learningStats.totalHours,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      icon: Award,
      label: t('certificates'),
      value: learningStats.certificates,
      color: 'text-yellow-500 bg-yellow-500/10',
    },
  ];

  const inProgress = mockEnrolledCourses.filter((c) => c.progress > 0 && c.progress < 100);
  const completed = mockEnrolledCourses.filter((c) => c.progress === 100);

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

      {/* Streak */}
      <div className="mb-8">
        <StreakCalendar />
      </div>

      {/* Courses */}
      <Tabs defaultValue="inProgress">
        <TabsList className="mb-6">
          <TabsTrigger value="inProgress">
            {t('inProgress')} ({inProgress.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t('completed')} ({completed.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            {t('all')} ({mockEnrolledCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inProgress">
          <div className="space-y-4">
            {inProgress.map((course) => (
              <CourseProgressCard key={course.id} course={course} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="space-y-4">
            {completed.map((course) => (
              <CourseProgressCard key={course.id} course={course} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all">
          <div className="space-y-4">
            {mockEnrolledCourses.map((course) => (
              <CourseProgressCard key={course.id} course={course} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Skills Map */}
      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">{t('skillsMap')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { name: 'React', level: 85 },
            { name: 'TypeScript', level: 72 },
            { name: 'Next.js', level: 68 },
            { name: 'Node.js', level: 55 },
            { name: 'Python', level: 40 },
            { name: 'Docker', level: 30 },
            { name: 'CSS', level: 78 },
            { name: 'Git', level: 90 },
          ].map(({ name: skill, level }) => {
            return (
              <Card key={skill}>
                <CardContent className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{skill}</span>
                    <span className="text-muted-foreground text-xs">{level}%</span>
                  </div>
                  <Progress value={level} className="h-1.5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
