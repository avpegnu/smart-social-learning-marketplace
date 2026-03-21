'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { Badge, Button } from '@shared/ui';
import { Eye } from 'lucide-react';
import { formatDate, formatPrice } from '@shared/utils';
import { useAdminCourses, useDebounce } from '@shared/hooks';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_REVIEW: 'outline',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
};

interface CourseRow {
  id: string;
  title: string;
  price: number;
  status: string;
  totalStudents: number;
  createdAt: string;
  instructor: { id: string; fullName: string };
  category: { id: string; name: string } | null;
}

export default function AdminCoursesPage() {
  const t = useTranslations('adminCourses');
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '10' };
    if (debouncedSearch) p.search = debouncedSearch;
    if (statusFilter !== 'ALL') p.status = statusFilter;
    return p;
  }, [page, debouncedSearch, statusFilter]);

  const { data, isLoading } = useAdminCourses(params);
  const courses = (data?.data as CourseRow[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const columns: Column<CourseRow>[] = [
    {
      key: 'title',
      header: t('title'),
      render: (c) => <span className="font-medium">{c.title}</span>,
    },
    {
      key: 'instructor',
      header: t('instructor'),
      render: (c) => <span className="text-sm">{c.instructor.fullName}</span>,
    },
    {
      key: 'category',
      header: t('category'),
      render: (c) => (
        <Badge variant="secondary" className="text-xs">
          {c.category?.name ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: t('price'),
      render: (c) => (
        <span className="text-sm">{c.price === 0 ? t('free') : formatPrice(c.price)}</span>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      render: (c) => <Badge variant={STATUS_VARIANTS[c.status] ?? 'secondary'}>{c.status}</Badge>,
    },
    {
      key: 'totalStudents',
      header: t('students'),
      render: (c) => <span className="text-sm">{c.totalStudents}</span>,
    },
    {
      key: 'createdAt',
      header: t('createdDate'),
      render: (c) => <span className="text-sm">{formatDate(c.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/courses/${c.id}`)}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          {t('view')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>

      <DataTable
        columns={columns}
        data={courses}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={t('searchPlaceholder')}
        serverPage={meta?.page}
        serverTotalPages={meta?.totalPages}
        serverTotal={meta?.total}
        onServerPageChange={setPage}
        filterSlot={
          <div className="flex items-center gap-1">
            {['ALL', 'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'].map((s) => (
              <Badge
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
              >
                {s === 'ALL' ? t('allStatuses') : s}
              </Badge>
            ))}
          </div>
        }
      />
    </div>
  );
}
