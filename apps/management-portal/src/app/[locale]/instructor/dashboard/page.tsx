'use client';

import { useTranslations } from 'next-intl';
import { useInstructorDashboard } from '@shared/hooks';
import { StatCard } from '@/components/data-display/stat-card';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from '@shared/ui';
import { Star } from 'lucide-react';
import { formatPrice, formatDate } from '@shared/utils';

interface DashboardData {
  overview: {
    totalRevenue: number;
    totalStudents: number;
    totalCourses: number;
    availableBalance: number;
    pendingBalance: number;
  };
  recentEarnings: Array<{
    id: string;
    netAmount: number;
    createdAt: string;
    orderItem: { title: string; price: number };
  }>;
  courseStats: Array<{
    id: string;
    title: string;
    totalStudents: number;
    avgRating: number;
  }>;
}

export default function InstructorDashboardPage() {
  const t = useTranslations('dashboard');
  const { data, isLoading } = useInstructorDashboard();

  if (isLoading) return <DashboardSkeleton />;

  const dashboard = data?.data as DashboardData | undefined;
  const overview = dashboard?.overview;
  const recentEarnings = dashboard?.recentEarnings ?? [];
  const courseStats = dashboard?.courseStats ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('totalRevenue')}
          value={formatPrice(overview?.totalRevenue ?? 0)}
          change={0}
          changeLabel=""
          icon="DollarSign"
        />
        <StatCard
          label={t('newStudents')}
          value={String(overview?.totalStudents ?? 0)}
          change={0}
          changeLabel=""
          icon="Users"
        />
        <StatCard
          label={t('publishedCourses')}
          value={String(overview?.totalCourses ?? 0)}
          change={0}
          changeLabel=""
          icon="BookOpen"
        />
        <StatCard
          label={t('availableBalance')}
          value={formatPrice(overview?.availableBalance ?? 0)}
          change={0}
          changeLabel=""
          icon="DollarSign"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Top Courses */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t('recentCourses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('courseTitle')}</TableHead>
                  <TableHead className="text-right">{t('newStudents')}</TableHead>
                  <TableHead className="text-right">{t('averageRating')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      {t('noCourses')}
                    </TableCell>
                  </TableRow>
                ) : (
                  courseStats.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {course.title}
                      </TableCell>
                      <TableCell className="text-right">{course.totalStudents}</TableCell>
                      <TableCell className="text-right">
                        {course.avgRating > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="fill-warning text-warning h-3 w-3" />
                            {course.avgRating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Earnings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('recentEarnings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEarnings.length === 0 ? (
                <p className="text-muted-foreground text-center text-sm">{t('noEarnings')}</p>
              ) : (
                recentEarnings.map((earning) => (
                  <div key={earning.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {earning.orderItem?.title ?? ''}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(earning.createdAt)}
                      </p>
                    </div>
                    <span className="text-success ml-2 text-sm font-medium">
                      +{formatPrice(earning.netAmount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-64 rounded-lg lg:col-span-3" />
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
      </div>
    </div>
  );
}
