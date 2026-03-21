'use client';

import { useTranslations } from 'next-intl';
import { Users, Star, Clock, BarChart3 } from 'lucide-react';

interface CourseStatsProps {
  totalStudents: number;
  avgRating: number | null;
  totalReviews: number;
  totalDuration: number;
  sectionCount: number;
  chapterCount: number;
  lessonCount: number;
}

export function CourseStats({
  totalStudents,
  avgRating,
  totalReviews,
  totalDuration,
  sectionCount,
  chapterCount,
  lessonCount,
}: CourseStatsProps) {
  const t = useTranslations('courseDetail');

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard icon={Users} label={t('students')} value={String(totalStudents)} />
      <StatCard
        icon={Star}
        label={t('rating')}
        value={avgRating ? `${avgRating.toFixed(1)} (${totalReviews})` : '—'}
      />
      <StatCard
        icon={Clock}
        label={t('totalDuration')}
        value={totalDuration > 0 ? formatDuration(totalDuration) : '—'}
      />
      <StatCard
        icon={BarChart3}
        label={t('content')}
        value={`${sectionCount} ${t('sections')}, ${chapterCount} ${t('chapters')}, ${lessonCount} ${t('lessons')}`}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
