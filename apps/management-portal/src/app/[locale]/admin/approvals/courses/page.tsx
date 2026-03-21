'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Badge, Button, Input } from '@shared/ui';
import { Check, X, Eye } from 'lucide-react';
import { formatDate, formatPrice } from '@shared/utils';
import { useAdminPendingCourses, useReviewCourse } from '@shared/hooks';
import { toast } from 'sonner';

interface CourseRow {
  id: string;
  title: string;
  price: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  instructor: { id: string; fullName: string };
  category: { id: string; name: string } | null;
  _count?: { sections: number };
}

export default function CourseApprovalsPage() {
  const t = useTranslations('approvals');
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{
    course: CourseRow;
    action: 'approve' | 'reject';
  } | null>(null);
  const [feedback, setFeedback] = useState('');

  const params = useMemo(() => ({ page: String(page), limit: '10' }), [page]);
  const { data, isLoading } = useAdminPendingCourses(params);
  const reviewMutation = useReviewCourse();

  const courses = (data?.data as CourseRow[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const handleReview = () => {
    if (!actionTarget) return;
    reviewMutation.mutate(
      {
        courseId: actionTarget.course.id,
        data: {
          approved: actionTarget.action === 'approve',
          feedback: feedback || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            actionTarget.action === 'approve' ? t('courseApproved') : t('courseRejected'),
          );
          setActionTarget(null);
          setFeedback('');
        },
      },
    );
  };

  const columns: Column<CourseRow>[] = [
    {
      key: 'title',
      header: t('courseTitle'),
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
      key: 'updatedAt',
      header: t('submittedDate'),
      render: (c) => <span className="text-sm">{formatDate(c.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/courses/${c.id}`)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            {t('view')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600"
            onClick={() => setActionTarget({ course: c, action: 'approve' })}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setActionTarget({ course: c, action: 'reject' })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('courseTitle')}</h1>

      <DataTable
        columns={columns}
        data={courses}
        isLoading={isLoading}
        serverPage={meta?.page}
        serverTotalPages={meta?.totalPages}
        serverTotal={meta?.total}
        onServerPageChange={setPage}
      />

      <ConfirmDialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setActionTarget(null);
            setFeedback('');
          }
        }}
        title={actionTarget?.action === 'approve' ? t('confirmApprove') : t('confirmReject')}
        description={
          actionTarget?.action === 'approve'
            ? t('confirmApproveCourseDesc', { title: actionTarget?.course.title ?? '' })
            : t('confirmRejectCourseDesc', { title: actionTarget?.course.title ?? '' })
        }
        confirmLabel={actionTarget?.action === 'approve' ? t('approve') : t('reject')}
        variant={actionTarget?.action === 'reject' ? 'destructive' : 'default'}
        isLoading={reviewMutation.isPending}
        onConfirm={handleReview}
      >
        {actionTarget?.action === 'reject' && (
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t('feedbackPlaceholder')}
            className="mt-2"
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
