'use client';

import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/data-display/stat-card';
import { ChartWidget } from '@/components/data-display/chart-widget';
import { Card, CardContent, CardHeader, CardTitle, AvatarSimple } from '@shared/ui';
import { adminStats, adminUserGrowth, adminRevenueData, adminActivities } from '@/lib/mock-data';

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard');

  const statLabels: Record<string, string> = {
    totalUsers: t('totalUsers'),
    totalRevenue: t('totalRevenue'),
    activeCourses: t('activeCourses'),
    pendingApprovals: t('pendingApprovals'),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {adminStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={statLabels[stat.label] || stat.label}
            value={stat.value}
            change={stat.change}
            changeLabel={t('vsLastMonth')}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <ChartWidget
          title={t('userGrowth')}
          type="area"
          data={adminUserGrowth}
          dataKeys={[
            { key: 'students', color: '#2563eb', name: 'Students' },
            { key: 'instructors', color: '#22c55e', name: 'Instructors' },
          ]}
          xAxisKey="month"
          height={280}
        />

        <ChartWidget
          title={t('revenueOverview')}
          type="bar"
          data={adminRevenueData}
          dataKeys={[{ key: 'revenue', color: '#0ea5e9', name: 'Revenue' }]}
          xAxisKey="month"
          height={280}
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {adminActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <AvatarSimple alt="A" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-muted-foreground text-xs">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
