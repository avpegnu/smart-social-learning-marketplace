'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import {
  AvatarSimple,
  Badge,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@shared/ui';
import { Check, X, Eye } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { useAdminPendingApps, useReviewApplication } from '@shared/hooks';
import { toast } from 'sonner';

interface AppRow {
  id: string;
  status: string;
  expertise: string;
  experience: string;
  motivation: string | null;
  cvUrl: string | null;
  certificateUrls: string[] | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
}

export default function InstructorApprovalsPage() {
  const t = useTranslations('approvals');
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{
    app: AppRow;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [detailApp, setDetailApp] = useState<AppRow | null>(null);

  const params = useMemo(() => ({ page: String(page), limit: '10' }), [page]);
  const { data, isLoading } = useAdminPendingApps(params);
  const reviewMutation = useReviewApplication();

  const apps = (data?.data as AppRow[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const handleReview = () => {
    if (!actionTarget) return;
    reviewMutation.mutate(
      {
        appId: actionTarget.app.id,
        data: {
          approved: actionTarget.action === 'approve',
          reviewNote: reviewNote || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            actionTarget.action === 'approve' ? t('applicationApproved') : t('applicationRejected'),
          );
          setActionTarget(null);
          setReviewNote('');
        },
      },
    );
  };

  const columns: Column<AppRow>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (app) => (
        <div className="flex items-center gap-3">
          <AvatarSimple src={app.user.avatarUrl ?? undefined} alt={app.user.fullName} size="sm" />
          <div>
            <p className="font-medium">{app.user.fullName}</p>
            <p className="text-muted-foreground text-xs">{app.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'expertise',
      header: t('expertise'),
      render: (app) => (
        <Badge variant="secondary" className="text-xs">
          {app.expertise}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: t('appliedDate'),
      render: (app) => <span className="text-sm">{formatDate(app.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (app) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailApp(app)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600"
            onClick={() => setActionTarget({ app, action: 'approve' })}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {t('approve')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setActionTarget({ app, action: 'reject' })}
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
      <h1 className="text-2xl font-bold">{t('instructorTitle')}</h1>

      <DataTable
        columns={columns}
        data={apps}
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
            ? t('confirmApproveDesc', { name: actionTarget?.app.user.fullName ?? '' })
            : t('confirmRejectDesc', { name: actionTarget?.app.user.fullName ?? '' })
        }
        confirmLabel={actionTarget?.action === 'approve' ? t('approve') : t('reject')}
        variant={actionTarget?.action === 'reject' ? 'destructive' : 'default'}
        isLoading={reviewMutation.isPending}
        onConfirm={handleReview}
      >
        {actionTarget?.action === 'reject' && (
          <Input
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder={t('reviewNotePlaceholder')}
            className="mt-2"
          />
        )}
      </ConfirmDialog>
      {/* Detail Dialog */}
      <Dialog open={!!detailApp} onOpenChange={(open) => !open && setDetailApp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('viewDetails')}</DialogTitle>
          </DialogHeader>
          {detailApp && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <AvatarSimple
                  src={detailApp.user.avatarUrl ?? undefined}
                  alt={detailApp.user.fullName}
                  size="sm"
                />
                <div>
                  <p className="font-medium">{detailApp.user.fullName}</p>
                  <p className="text-muted-foreground text-xs">{detailApp.user.email}</p>
                </div>
              </div>
              <div className="bg-muted space-y-3 rounded-lg p-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">{t('expertise')}</p>
                  <p>{detailApp.expertise}</p>
                </div>
                {detailApp.experience && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('experience')}</p>
                    <p className="whitespace-pre-wrap">{detailApp.experience}</p>
                  </div>
                )}
                {detailApp.motivation && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('motivation')}</p>
                    <p className="whitespace-pre-wrap">{detailApp.motivation}</p>
                  </div>
                )}
                {detailApp.cvUrl && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">CV / Portfolio</p>
                    <a
                      href={detailApp.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary break-all underline"
                    >
                      {detailApp.cvUrl}
                    </a>
                  </div>
                )}
                {detailApp.certificateUrls && detailApp.certificateUrls.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('certificates')}</p>
                    <ul className="ml-4 list-disc space-y-1">
                      {detailApp.certificateUrls.map((url, i) => (
                        <li key={i}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary break-all underline"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs font-medium">{t('appliedDate')}</p>
                  <p>{formatDate(detailApp.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
