'use client';

import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/data-display/stat-card';
import { ChartWidget } from '@/components/data-display/chart-widget';
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
} from '@shared/ui';
import { Wallet } from 'lucide-react';
import { instructorRevenueData, instructorCourses, formatCurrency } from '@/lib/mock-data';

export default function RevenuePage() {
  const t = useTranslations('revenue');

  const publishedCourses = instructorCourses.filter((c) => c.status === 'PUBLISHED');

  const stats = [
    {
      label: t('totalRevenue'),
      value: '₫12,450,000',
      change: 12.5,
      changeLabel: 'vs last month',
      icon: 'DollarSign',
    },
    {
      label: t('thisMonth'),
      value: '₫3,200,000',
      change: 8.2,
      changeLabel: 'vs last month',
      icon: 'DollarSign',
    },
    {
      label: t('pendingWithdrawal'),
      value: '₫2,000,000',
      change: 0,
      changeLabel: '',
      icon: 'Clock',
    },
    {
      label: t('availableBalance'),
      value: '₫5,450,000',
      change: 15,
      changeLabel: 'vs last month',
      icon: 'DollarSign',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button>
          <Wallet className="h-4 w-4" />
          {t('withdraw')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Revenue Chart */}
      <ChartWidget
        title={t('revenueChart')}
        type="bar"
        data={instructorRevenueData}
        dataKeys={[{ key: 'revenue', color: '#2563eb', name: t('totalRevenue') }]}
        xAxisKey="month"
        height={300}
      />

      {/* Revenue by Course */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('revenueByCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('course')}</TableHead>
                <TableHead className="text-right">{t('enrollments')}</TableHead>
                <TableHead className="text-right">{t('amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publishedCourses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{course.students}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(course.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
