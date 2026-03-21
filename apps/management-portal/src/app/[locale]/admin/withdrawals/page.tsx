'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button, Input } from '@shared/ui';
import { Check, X } from 'lucide-react';
import { formatDate, formatPrice } from '@shared/utils';
import { useAdminWithdrawals, useProcessWithdrawal } from '@shared/hooks';
import { toast } from 'sonner';

interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  instructor: { id: string; fullName: string; email: string };
}

export default function WithdrawalsPage() {
  const t = useTranslations('adminWithdrawals');
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{
    withdrawal: WithdrawalRow;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const params = useMemo(() => ({ page: String(page), limit: '10' }), [page]);
  const { data, isLoading } = useAdminWithdrawals(params);
  const processMutation = useProcessWithdrawal();

  const withdrawals = (data?.data as WithdrawalRow[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const handleProcess = () => {
    if (!actionTarget) return;
    processMutation.mutate(
      {
        id: actionTarget.withdrawal.id,
        data: {
          status: actionTarget.action === 'approve' ? 'COMPLETED' : 'REJECTED',
          reviewNote: reviewNote || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            actionTarget.action === 'approve' ? t('withdrawalApproved') : t('withdrawalRejected'),
          );
          setActionTarget(null);
          setReviewNote('');
        },
      },
    );
  };

  const columns: Column<WithdrawalRow>[] = [
    {
      key: 'instructor',
      header: t('instructorName'),
      render: (w) => (
        <div>
          <p className="font-medium">{w.instructor.fullName}</p>
          <p className="text-muted-foreground text-xs">{w.instructor.email}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('amount'),
      render: (w) => <span className="font-medium">{formatPrice(w.amount)}</span>,
    },
    {
      key: 'createdAt',
      header: t('requestedDate'),
      render: (w) => <span className="text-sm">{formatDate(w.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (w) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600"
            onClick={() => setActionTarget({ withdrawal: w, action: 'approve' })}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {t('approve')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setActionTarget({ withdrawal: w, action: 'reject' })}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t('reject')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <DataTable
        columns={columns}
        data={withdrawals}
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
            setReviewNote('');
          }
        }}
        title={actionTarget?.action === 'approve' ? t('confirmApprove') : t('confirmReject')}
        description={
          actionTarget?.action === 'approve'
            ? t('confirmApproveDesc', {
                amount: formatPrice(actionTarget?.withdrawal.amount ?? 0),
                name: actionTarget?.withdrawal.instructor.fullName ?? '',
              })
            : t('confirmRejectDesc', { name: actionTarget?.withdrawal.instructor.fullName ?? '' })
        }
        confirmLabel={actionTarget?.action === 'approve' ? t('approve') : t('reject')}
        variant={actionTarget?.action === 'reject' ? 'destructive' : 'default'}
        isLoading={processMutation.isPending}
        onConfirm={handleProcess}
      >
        {actionTarget?.action === 'reject' && (
          <Input
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder={t('rejectReasonPlaceholder')}
            className="mt-2"
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
