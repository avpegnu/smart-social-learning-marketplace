'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { GraduationCap, RotateCcw, ArrowRight, Home } from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress } from '@shared/ui';
import type { PlacementResult } from '@shared/hooks';
import { cn } from '@/lib/utils';

interface TestResultProps {
  result: PlacementResult;
  questionsByLevel: Record<string, number>;
  onRetake: () => void;
}

const LEVEL_STYLES = {
  BEGINNER: {
    variant: 'success' as const,
    gradient: 'from-emerald-500/10 to-green-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  INTERMEDIATE: {
    variant: 'warning' as const,
    gradient: 'from-amber-500/10 to-yellow-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  ADVANCED: {
    variant: 'destructive' as const,
    gradient: 'from-rose-500/10 to-red-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
  },
};

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

export function TestResult({ result, questionsByLevel, onRetake }: TestResultProps) {
  const t = useTranslations('placementTest');
  const levelStyle = LEVEL_STYLES[result.level] ?? LEVEL_STYLES.BEGINNER;

  const getLevelLabel = (level: string) => {
    const key = `level${level.charAt(0)}${level.slice(1).toLowerCase()}` as
      | 'levelBeginner'
      | 'levelIntermediate'
      | 'levelAdvanced';
    return t(key);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div
          className={cn(
            'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br',
            levelStyle.gradient,
          )}
        >
          <GraduationCap className={cn('h-10 w-10', levelStyle.text)} />
        </div>
        <h1 className="text-2xl font-bold">{t('resultTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('resultSubtitle', { level: getLevelLabel(result.level) })}
        </p>
      </div>

      {/* Recommended level card */}
      <Card className={cn('mb-6 bg-gradient-to-r', levelStyle.gradient)}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-2 text-sm font-medium">{t('recommendedLevel')}</p>
          <Badge variant={levelStyle.variant} className="px-4 py-1.5 text-lg font-bold">
            {getLevelLabel(result.level)}
          </Badge>
        </CardContent>
      </Card>

      {/* Score breakdown */}
      <div className="mb-8">
        <h2 className="mb-4 font-semibold">{t('scoreBreakdown')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LEVELS.map((level) => {
            const correct = result.scores[level] ?? 0;
            const total = questionsByLevel[level] ?? 0;
            const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
            const style = LEVEL_STYLES[level];

            return (
              <Card key={level}>
                <CardContent className="p-4 text-center">
                  <Badge variant={style.variant} className="mb-2">
                    {getLevelLabel(level)}
                  </Badge>
                  <p className="text-2xl font-bold">{pct}%</p>
                  <p className="text-muted-foreground mb-2 text-sm">
                    {t('correct', { score: correct, total })}
                  </p>
                  <Progress value={pct} className="h-1.5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recommended courses */}
      {result.recommendedCourses.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 font-semibold">{t('recommendedCourses')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {result.recommendedCourses.map((course) => (
              <Link key={course.id} href={`/courses/${course.slug}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center gap-3 p-4">
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-14 w-20 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="from-primary/20 flex h-14 w-20 shrink-0 items-center justify-center rounded-md bg-gradient-to-br to-violet-500/20">
                        <GraduationCap className="text-primary h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium">{course.title}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {getLevelLabel(course.level)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {result.recommendedCourses.length === 0 && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground text-sm">{t('noRecommendations')}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="outline" onClick={onRetake} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t('retake')}
        </Button>
        <Link href={`/courses?level=${result.level}`}>
          <Button className="w-full gap-2 sm:w-auto">
            {t('viewCourses')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" className="w-full gap-2 sm:w-auto">
            <Home className="h-4 w-4" />
            {t('backHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
