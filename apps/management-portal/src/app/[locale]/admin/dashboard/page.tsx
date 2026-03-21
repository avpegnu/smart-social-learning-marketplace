'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  Users,
  BookOpen,
  DollarSign,
  ShoppingCart,
  UserCheck,
  BookMarked,
  Flag,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Badge } from '@shared/ui';
import { useAdminDashboard } from '@shared/hooks';
import { formatPrice } from '@shared/utils';

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { data: dashboardData, isLoading } = useAdminDashboard();

  const dashboard = dashboardData?.data as
    | {
        overview: {
          totalUsers: number;
          totalCourses: number;
          totalRevenue: number;
          todayOrders: number;
          newUsersThisWeek: number;
        };
        pendingApprovals: {
          instructorApps: number;
          courseReviews: number;
          reports: number;
          withdrawals: number;
        };
        topCourses: Array<{
          id: string;
          title: string;
          totalStudents: number;
          avgRating: number;
        }>;
      }
    | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!dashboard) return null;

  const { overview, pendingApprovals, topCourses } = dashboard;

  const stats = [
    {
      label: t('totalUsers'),
      value: String(overview.totalUsers),
      icon: Users,
      sub: `+${overview.newUsersThisWeek} ${t('thisWeek')}`,
    },
    { label: t('activeCourses'), value: String(overview.totalCourses), icon: BookOpen },
    { label: t('totalRevenue'), value: formatPrice(overview.totalRevenue), icon: DollarSign },
    { label: t('todayOrders'), value: String(overview.todayOrders), icon: ShoppingCart },
  ];

  const pending = [
    {
      label: t('instructorApps'),
      count: pendingApprovals.instructorApps,
      icon: UserCheck,
      href: '/admin/approvals/instructors',
    },
    {
      label: t('courseReviews'),
      count: pendingApprovals.courseReviews,
      icon: BookMarked,
      href: '/admin/approvals/courses',
    },
    {
      label: t('pendingReports'),
      count: pendingApprovals.reports,
      icon: Flag,
      href: '/admin/reports',
    },
    {
      label: t('pendingWithdrawals'),
      count: pendingApprovals.withdrawals,
      icon: Wallet,
      href: '/admin/withdrawals',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs">{stat.label}</p>
                    <p className="mt-1 text-xl font-bold">{stat.value}</p>
                    {stat.sub && <p className="text-muted-foreground text-xs">{stat.sub}</p>}
                  </div>
                  <Icon className="text-muted-foreground h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending Approvals */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('pendingApprovals')}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {pending.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.label}
                className="hover:bg-accent cursor-pointer transition-colors"
                onClick={() => router.push(item.href)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-sm">{item.label}</p>
                    <Badge variant={item.count > 0 ? 'default' : 'secondary'}>{item.count}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Top Courses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('topCourses')}</CardTitle>
        </CardHeader>
        <CardContent>
          {topCourses.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noCourses')}</p>
          ) : (
            <div className="space-y-3">
              {topCourses.map((course) => (
                <div key={course.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{course.title}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {course.totalStudents} {t('students')}
                    </span>
                    <span className="text-muted-foreground">
                      {course.avgRating > 0 ? `★ ${course.avgRating.toFixed(1)}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
