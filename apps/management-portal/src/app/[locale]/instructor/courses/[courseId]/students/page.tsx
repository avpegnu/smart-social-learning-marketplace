'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatCard } from '@/components/data-display/stat-card';
import { StatusBadge } from '@/components/data-display/status-badge';
import { AvatarSimple, Badge, Button, Progress } from '@shared/ui';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { courseStudents, instructorCourses, type CourseStudent } from '@/lib/mock-data';

export default function CourseStudentsPage() {
  const t = useTranslations('students');
  const [statusFilter, setStatusFilter] = React.useState('ALL');

  const course = instructorCourses[0];

  let filteredData = courseStudents;
  if (statusFilter !== 'ALL') {
    filteredData = filteredData.filter((s) => s.status === statusFilter);
  }

  const totalStudents = courseStudents.length;
  const activeThisWeek = courseStudents.filter((s) => s.status === 'ACTIVE').length;
  const completionRate = Math.round(
    (courseStudents.filter((s) => s.status === 'COMPLETED').length / totalStudents) * 100,
  );

  const stats = [
    {
      label: t('totalStudents'),
      value: String(totalStudents),
      change: 12,
      changeLabel: t('vsLastMonth'),
      icon: 'Users',
    },
    {
      label: t('activeThisWeek'),
      value: String(activeThisWeek),
      change: 5,
      changeLabel: t('vsLastMonth'),
      icon: 'Clock',
    },
    {
      label: t('completionRate'),
      value: `${completionRate}%`,
      change: 3.2,
      changeLabel: t('vsLastMonth'),
      icon: 'BookOpen',
    },
    {
      label: t('avgRating'),
      value: String(course.rating),
      change: 0.3,
      changeLabel: t('vsLastMonth'),
      icon: 'Star',
    },
  ];

  const columns: Column<CourseStudent>[] = [
    {
      key: 'name',
      header: t('studentName'),
      sortable: true,
      render: (student) => (
        <div className="flex items-center gap-3">
          <AvatarSimple alt={student.name} size="sm" />
          <div>
            <p className="font-medium">{student.name}</p>
            <p className="text-muted-foreground text-xs">{student.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'enrolledAt',
      header: t('enrolledDate'),
      sortable: true,
      render: (student) => <span className="text-sm">{formatDate(student.enrolledAt)}</span>,
    },
    {
      key: 'progress',
      header: t('progress'),
      sortable: true,
      render: (student) => (
        <div className="flex items-center gap-2">
          <Progress value={student.progress} className="h-2 w-20" />
          <span className="text-sm tabular-nums">{student.progress}%</span>
        </div>
      ),
    },
    {
      key: 'lastActive',
      header: t('lastActive'),
      sortable: true,
      render: (student) => <span className="text-sm">{formatDate(student.lastActive)}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (student) => <StatusBadge status={student.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/instructor/courses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="text-muted-foreground text-sm">{t('title')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            changeLabel={stat.changeLabel}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Students Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchKey="name"
        pageSize={8}
        filterSlot={
          <div className="flex items-center gap-2">
            {['ALL', 'ACTIVE', 'INACTIVE', 'COMPLETED'].map((s) => (
              <Badge
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ALL'
                  ? t('allStatuses')
                  : t(s.toLowerCase() as 'active' | 'inactive' | 'completed')}
              </Badge>
            ))}
          </div>
        }
      />
    </div>
  );
}
