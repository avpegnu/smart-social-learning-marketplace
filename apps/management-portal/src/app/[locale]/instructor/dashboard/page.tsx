'use client';

import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/data-display/stat-card';
import { ChartWidget } from '@/components/data-display/chart-widget';
import { StatusBadge } from '@/components/data-display/status-badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AvatarSimple,
} from '@shared/ui';
import { Star } from 'lucide-react';
import {
  instructorStats,
  instructorCourses,
  instructorRevenueData,
  instructorActivities,
  formatCurrency,
} from '@/lib/mock-data';

export default function InstructorDashboardPage() {
  const t = useTranslations('dashboard');

  const statLabels: Record<string, string> = {
    totalRevenue: t('totalRevenue'),
    newStudents: t('newStudents'),
    publishedCourses: t('publishedCourses'),
    averageRating: t('averageRating'),
  };

  const recentCourses = instructorCourses.slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {instructorStats.map((stat) => (
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

      {/* Revenue Chart */}
      <Tabs defaultValue="12months">
        <ChartWidget
          title={t('revenueChart')}
          type="line"
          data={instructorRevenueData}
          dataKeys={[{ key: 'revenue', color: '#2563eb', name: t('totalRevenue') }]}
          xAxisKey="month"
          height={300}
        >
          <TabsList>
            <TabsTrigger value="7days">{t('days7')}</TabsTrigger>
            <TabsTrigger value="30days">{t('days30')}</TabsTrigger>
            <TabsTrigger value="12months">{t('months12')}</TabsTrigger>
          </TabsList>
        </ChartWidget>
      </Tabs>

      <div className="grid grid-cols-5 gap-6">
        {/* Recent Courses */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t('recentCourses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {course.title}
                    </TableCell>
                    <TableCell className="text-right">{course.students}</TableCell>
                    <TableCell className="text-right">{formatCurrency(course.revenue)}</TableCell>
                    <TableCell className="text-right">
                      {course.rating > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="fill-warning text-warning h-3 w-3" />
                          {course.rating}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={course.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('activityFeed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {instructorActivities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <AvatarSimple alt="U" size="sm" />
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
    </div>
  );
}
