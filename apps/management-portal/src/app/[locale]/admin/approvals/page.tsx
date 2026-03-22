'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@shared/ui';
import { Users, BookOpen, Flag, Wallet, ArrowRight } from 'lucide-react';
import { useAdminDashboard } from '@shared/hooks';

export default function ApprovalsPage() {
  const t = useTranslations('approvals');
  const { data: dashboard, isLoading } = useAdminDashboard();

  const dashboardData = dashboard as { pendingApprovals?: Record<string, number> } | undefined;
  const pending = dashboardData?.pendingApprovals;

  const cards = [
    {
      href: '/admin/approvals/instructors',
      title: t('instructorTitle'),
      description: t('pendingApplications'),
      count: pending?.instructorApps ?? 0,
      icon: Users,
    },
    {
      href: '/admin/approvals/courses',
      title: t('courseTitle'),
      description: t('pendingCourses'),
      count: pending?.courseReviews ?? 0,
      icon: BookOpen,
    },
    {
      href: '/admin/reports',
      title: t('reportsTitle'),
      description: t('pendingReports'),
      count: pending?.reports ?? 0,
      icon: Flag,
    },
    {
      href: '/admin/withdrawals',
      title: t('withdrawalsTitle'),
      description: t('pendingWithdrawals'),
      count: pending?.withdrawals ?? 0,
      icon: Wallet,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div className="grid grid-cols-2 gap-6">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{card.title}</CardTitle>
                {card.count > 0 && <Badge variant="destructive">{card.count}</Badge>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                      <card.icon className="text-primary h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{card.count}</p>
                      <p className="text-muted-foreground text-sm">{card.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
