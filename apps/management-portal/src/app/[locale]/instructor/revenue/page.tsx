'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from '@shared/ui';
import { useInstructorDashboard } from '@shared/hooks';
import { formatPrice, formatDate } from '@shared/utils';
import { StatCard } from '@/components/data-display/stat-card';
import { StatusBadge } from '@/components/data-display/status-badge';

interface DashboardOverview {
  totalRevenue: number;
  totalStudents: number;
  totalCourses: number;
  availableBalance: number;
  pendingBalance: number;
}

interface RecentEarning {
  id: string;
  status: string;
  netAmount: number;
  createdAt: string;
  orderItem: { title: string; price: number };
}

interface CourseStat {
  id: string;
  title: string;
  totalStudents: number;
  avgRating: number;
}

interface DashboardData {
  overview: DashboardOverview;
  recentEarnings: RecentEarning[];
  courseStats: CourseStat[];
}

export default function RevenuePage() {
  const t = useTranslations('revenue');
  const router = useRouter();
  const { data, isLoading } = useInstructorDashboard();

  const dashboard = data?.data as DashboardData | undefined;
  const overview = dashboard?.overview;
  const recentEarnings = dashboard?.recentEarnings ?? [];
  const courseStats = dashboard?.courseStats ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stats = [
    {
      label: t('totalRevenue'),
      value: formatPrice(overview?.totalRevenue ?? 0),
      change: 0,
      changeLabel: '',
      icon: 'DollarSign',
    },
    {
      label: t('totalStudents'),
      value: String(overview?.totalStudents ?? 0),
      change: 0,
      changeLabel: '',
      icon: 'Users',
    },
    {
      label: t('pendingWithdrawal'),
      value: formatPrice(overview?.pendingBalance ?? 0),
      change: 0,
      changeLabel: '',
      icon: 'Clock',
    },
    {
      label: t('availableBalance'),
      value: formatPrice(overview?.availableBalance ?? 0),
      change: 0,
      changeLabel: '',
      icon: 'DollarSign',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => router.push('/instructor/withdrawals')}>
          <Wallet className="mr-2 h-4 w-4" />
          {t('withdraw')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Recent Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recentEarnings')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEarnings.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t('noEarnings')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('course')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEarnings.map((earning) => (
                  <TableRow key={earning.id}>
                    <TableCell className="font-medium">{earning.orderItem.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(earning.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={earning.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(earning.netAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Course Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('revenueByCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          {courseStats.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t('noCourses')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('course')}</TableHead>
                  <TableHead className="text-right">{t('enrollments')}</TableHead>
                  <TableHead className="text-right">{t('rating')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseStats.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {course.totalStudents}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {course.avgRating > 0 ? `${course.avgRating.toFixed(1)} ⭐` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
