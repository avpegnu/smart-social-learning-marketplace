'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChartWidget } from '@/components/data-display/chart-widget';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';
import { useAdminDashboard, useAdminAnalytics } from '@shared/hooks';
import { BarChart3, FileText, TrendingUp, Users } from 'lucide-react';
import { formatPrice } from '@shared/utils';

const RANGES: Record<string, number> = {
  '7days': 7,
  '30days': 30,
  '3months': 90,
  '12months': 365,
};

interface AnalyticsSnapshot {
  id: string;
  date: string;
  type: string;
  data: Record<string, number>;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function useAnalyticsRange(dateRange: string) {
  return React.useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (RANGES[dateRange] ?? 30));
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }, [dateRange]);
}

function transformSnapshots(snapshots: AnalyticsSnapshot[] | undefined) {
  if (!snapshots || !Array.isArray(snapshots)) return [];
  return snapshots.map((s) => ({
    date: formatDateLabel(s.date),
    ...(typeof s.data === 'object' ? s.data : {}),
  }));
}

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const [dateRange, setDateRange] = React.useState('30days');

  const { from, to } = useAnalyticsRange(dateRange);
  const { data: dashboard } = useAdminDashboard();

  const usersQuery = useAdminAnalytics({ type: 'DAILY_USERS', from, to });
  const revenueQuery = useAdminAnalytics({ type: 'DAILY_REVENUE', from, to });
  const enrollmentsQuery = useAdminAnalytics({ type: 'DAILY_ENROLLMENTS', from, to });
  const coursesQuery = useAdminAnalytics({ type: 'DAILY_COURSES', from, to });

  const usersData = transformSnapshots(usersQuery.data as AnalyticsSnapshot[] | undefined);
  const revenueData = transformSnapshots(revenueQuery.data as AnalyticsSnapshot[] | undefined);
  const enrollmentsData = transformSnapshots(
    enrollmentsQuery.data as AnalyticsSnapshot[] | undefined,
  );
  const coursesData = transformSnapshots(coursesQuery.data as AnalyticsSnapshot[] | undefined);

  const isLoading =
    usersQuery.isLoading ||
    revenueQuery.isLoading ||
    enrollmentsQuery.isLoading ||
    coursesQuery.isLoading;

  const dashboardData = dashboard as
    | { overview?: Record<string, number>; pendingApprovals?: Record<string, number> }
    | undefined;
  const overview = dashboardData?.overview;

  const ranges = [
    { value: '7days', label: t('last7Days') },
    { value: '30days', label: t('last30Days') },
    { value: '3months', label: t('last3Months') },
    { value: '12months', label: t('last12Months') },
  ];

  const stats = [
    {
      label: t('totalUsers'),
      value: overview?.totalUsers ?? 0,
      icon: Users,
    },
    {
      label: t('totalCourses'),
      value: overview?.totalCourses ?? 0,
      icon: FileText,
    },
    {
      label: t('totalRevenue'),
      value: formatPrice(overview?.totalRevenue ?? 0),
      icon: TrendingUp,
    },
    {
      label: t('newUsersThisWeek'),
      value: overview?.newUsersThisWeek ?? 0,
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {ranges.map((range) => (
            <Badge
              key={range.value}
              variant={dateRange === range.value ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setDateRange(range.value)}
            >
              {range.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[280px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <ChartWidget
            title={t('userRegistrations')}
            type="area"
            data={usersData}
            dataKeys={[
              { key: 'students', color: '#2563eb', name: t('students') },
              { key: 'instructors', color: '#22c55e', name: t('instructors') },
            ]}
            xAxisKey="date"
            height={280}
          >
            {usersData.length === 0 && <EmptyChartNote text={t('noData')} />}
          </ChartWidget>

          <ChartWidget
            title={t('revenueTrends')}
            type="line"
            data={revenueData}
            dataKeys={[{ key: 'revenue', color: '#0ea5e9', name: t('revenue') }]}
            xAxisKey="date"
            height={280}
          >
            {revenueData.length === 0 && <EmptyChartNote text={t('noData')} />}
          </ChartWidget>

          <ChartWidget
            title={t('enrollments')}
            type="bar"
            data={enrollmentsData}
            dataKeys={[{ key: 'count', color: '#8b5cf6', name: t('enrollments') }]}
            xAxisKey="date"
            height={300}
          >
            {enrollmentsData.length === 0 && <EmptyChartNote text={t('noData')} />}
          </ChartWidget>

          <ChartWidget
            title={t('newCourses')}
            type="bar"
            data={coursesData}
            dataKeys={[{ key: 'count', color: '#22c55e', name: t('newCourses') }]}
            xAxisKey="date"
            height={300}
          >
            {coursesData.length === 0 && <EmptyChartNote text={t('noData')} />}
          </ChartWidget>
        </div>
      )}
    </div>
  );
}

function EmptyChartNote({ text }: { text: string }) {
  return <span className="text-muted-foreground text-xs">{text}</span>;
}
