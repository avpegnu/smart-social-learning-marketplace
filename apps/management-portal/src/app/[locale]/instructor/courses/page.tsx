'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useInstructorCourses, useDeleteCourse, useSubmitCourseForReview } from '@shared/hooks';
import { useDebounce } from '@shared/hooks';
import { Button, Badge } from '@shared/ui';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Plus, Pencil, Eye, Trash2, Send, Star, Image } from 'lucide-react';
import { formatPrice } from '@shared/utils';

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  status: string;
  price: number;
  totalStudents: number;
  totalLessons: number;
  avgRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FILTERS = ['ALL', 'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'] as const;

export default function InstructorCoursesPage() {
  const t = useTranslations('courses');
  const tc = useTranslations('common');
  const router = useRouter();

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  // Confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitTarget, setSubmitTarget] = useState<string | null>(null);

  // API
  const { data, isLoading } = useInstructorCourses({
    page,
    limit: 10,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
  });
  const deleteMutation = useDeleteCourse();
  const submitMutation = useSubmitCourseForReview();

  const courses = (data?.data ?? []) as CourseItem[];
  const meta = data?.meta;

  const columns: Column<CourseItem>[] = [
    {
      key: 'thumbnail',
      header: t('thumbnail'),
      className: 'w-16',
      render: (course) =>
        course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="h-10 w-16 rounded object-cover"
          />
        ) : (
          <div className="bg-muted flex h-10 w-16 items-center justify-center rounded">
            <Image className="text-muted-foreground h-4 w-4" />
          </div>
        ),
    },
    {
      key: 'title',
      header: t('courseTitle'),
      render: (course) => (
        <div className="max-w-[250px]">
          <p className="truncate font-medium">{course.title}</p>
          <p className="text-muted-foreground text-xs">
            {course.totalLessons} {t('lessons')} · {formatPrice(course.price)}
          </p>
        </div>
      ),
    },
    {
      key: 'totalStudents',
      header: t('students'),
      className: 'text-right',
      render: (course) => <span className="tabular-nums">{course.totalStudents}</span>,
    },
    {
      key: 'avgRating',
      header: t('rating'),
      className: 'text-right',
      render: (course) =>
        course.avgRating > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Star className="fill-warning text-warning h-3 w-3" />
            <span className="tabular-nums">{course.avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground text-xs">({course.reviewCount})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'status',
      header: t('status'),
      render: (course) => <StatusBadge status={course.status as 'DRAFT'} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (course) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('edit')}
            onClick={() => router.push(`/instructor/courses/${course.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {course.status === 'PUBLISHED' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('view')}
              onClick={() => router.push(`/instructor/courses/${course.id}/curriculum`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {(course.status === 'DRAFT' || course.status === 'REJECTED') && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('submitForReview')}
                onClick={() => setSubmitTarget(course.id)}
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-8 w-8"
                title={tc('delete')}
                onClick={() => setDeleteTarget(course.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
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
            <Plus className="mr-1 h-4 w-4" />
            {t('createCourse')}
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={courses}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        pageSize={10}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        serverPage={page}
        serverTotalPages={meta?.totalPages ?? 1}
        serverTotal={meta?.total ?? 0}
        onServerPageChange={setPage}
        filterSlot={
          <div className="flex items-center gap-2">
            {STATUS_FILTERS.map((s) => (
              <Badge
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
              >
                {s === 'ALL' ? t('allCourses') : t(statusMap(s))}
              </Badge>
            ))}
          </div>
        }
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('confirmDelete')}
        description={t('confirmDeleteDesc')}
        confirmLabel={tc('delete')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
      />

      {/* Submit for Review Confirmation */}
      <ConfirmDialog
        open={!!submitTarget}
        onOpenChange={(open) => !open && setSubmitTarget(null)}
        title={t('confirmSubmit')}
        description={t('confirmSubmitDesc')}
        confirmLabel={t('submitForReview')}
        isLoading={submitMutation.isPending}
        onConfirm={() => {
          if (submitTarget) {
            submitMutation.mutate(submitTarget, {
              onSuccess: () => setSubmitTarget(null),
            });
          }
        }}
      />
    </div>
  );
}

function statusMap(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PENDING_REVIEW':
      return 'pending';
    case 'PUBLISHED':
      return 'published';
    case 'REJECTED':
      return 'rejected';
    default:
      return status.toLowerCase();
  }
}
