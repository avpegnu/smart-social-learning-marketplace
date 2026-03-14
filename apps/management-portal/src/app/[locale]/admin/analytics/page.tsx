'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChartWidget } from '@/components/data-display/chart-widget';
import { Badge } from '@shared/ui';
import { adminUserGrowth, adminRevenueData, adminCategoryDistribution } from '@/lib/mock-data';

const completionData = [
  { month: 'T1', completions: 12 },
  { month: 'T2', completions: 18 },
  { month: 'T3', completions: 25 },
  { month: 'T4', completions: 22 },
  { month: 'T5', completions: 30 },
  { month: 'T6', completions: 38 },
  { month: 'T7', completions: 42 },
  { month: 'T8', completions: 35 },
  { month: 'T9', completions: 48 },
  { month: 'T10', completions: 45 },
  { month: 'T11', completions: 55 },
  { month: 'T12', completions: 60 },
];

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const [dateRange, setDateRange] = React.useState('12months');

  const ranges = [
    { value: '7days', label: t('last7Days') },
    { value: '30days', label: t('last30Days') },
    { value: '3months', label: t('last3Months') },
    { value: '12months', label: t('last12Months') },
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

      <div className="grid grid-cols-2 gap-6">
        <ChartWidget
          title={t('userRegistrations')}
          type="area"
          data={adminUserGrowth}
          dataKeys={[
            { key: 'students', color: '#2563eb', name: t('students') },
            { key: 'instructors', color: '#22c55e', name: t('instructors') },
          ]}
          xAxisKey="month"
          height={280}
        />

        <ChartWidget
          title={t('revenueTrends')}
          type="line"
          data={adminRevenueData}
          dataKeys={[{ key: 'revenue', color: '#0ea5e9', name: 'Revenue (VND)' }]}
          xAxisKey="month"
          height={280}
        />

        <ChartWidget
          title={t('popularCategories')}
          type="pie"
          data={adminCategoryDistribution}
          dataKeys={[{ key: 'value', color: '#2563eb' }]}
          height={300}
        />

        <ChartWidget
          title={t('courseCompletions')}
          type="bar"
          data={completionData}
          dataKeys={[{ key: 'completions', color: '#22c55e', name: 'Completions' }]}
          xAxisKey="month"
          height={300}
        />
      </div>
    </div>
  );
}
