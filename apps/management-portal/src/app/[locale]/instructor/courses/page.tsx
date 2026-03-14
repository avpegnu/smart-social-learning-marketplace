'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Badge } from '@shared/ui';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Plus, Pencil, Eye, Star, Image } from 'lucide-react';
import { instructorCourses, formatCurrency, type Course } from '@/lib/mock-data';

export default function InstructorCoursesPage() {
  const t = useTranslations('courses');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  const filteredData =
    statusFilter === 'ALL'
      ? instructorCourses
      : instructorCourses.filter((c) => c.status === statusFilter);

  const columns: Column<Course>[] = [
    {
      key: 'thumbnail',
      header: t('thumbnail'),
      className: 'w-16',
      render: () => (
        <div className="bg-muted flex h-10 w-14 items-center justify-center rounded">
          <Image className="text-muted-foreground h-4 w-4" />
        </div>
      ),
    },
    {
      key: 'title',
      header: t('courseTitle'),
      sortable: true,
      render: (course) => (
        <div className="max-w-[250px]">
          <p className="truncate font-medium">{course.title}</p>
          <p className="text-muted-foreground truncate text-xs">{course.subtitle}</p>
        </div>
      ),
    },
    {
      key: 'students',
      header: t('students'),
      sortable: true,
      className: 'text-right',
      render: (course) => <span className="tabular-nums">{course.students}</span>,
    },
    {
      key: 'revenue',
      header: t('revenue'),
      sortable: true,
      className: 'text-right',
      render: (course) => <span className="tabular-nums">{formatCurrency(course.revenue)}</span>,
    },
    {
      key: 'rating',
      header: t('rating'),
      sortable: true,
      className: 'text-right',
      render: (course) =>
        course.rating > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Star className="fill-warning text-warning h-3 w-3" />
            <span className="tabular-nums">{course.rating}</span>
            <span className="text-muted-foreground text-xs">({course.reviewCount})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'status',
      header: t('status'),
      render: (course) => <StatusBadge status={course.status} />,
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (course) => (
        <div className="flex items-center gap-1">
          <Link href={`/instructor/courses/${course.id}/curriculum`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/instructor/courses/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t('createCourse')}
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchKey="title"
        pageSize={5}
        filterSlot={
          <div className="flex items-center gap-2">
            {['ALL', 'DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED'].map((s) => (
              <Badge
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ALL'
                  ? t('allCourses')
                  : t(s.toLowerCase() as 'draft' | 'pending' | 'published' | 'rejected')}
              </Badge>
            ))}
          </div>
        }
      />
    </div>
  );
}
