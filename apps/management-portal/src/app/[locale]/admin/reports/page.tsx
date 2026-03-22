'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import {
  AvatarSimple,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
} from '@shared/ui';
import { Eye, ShieldBan, XCircle } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { useAdminReports, useReviewReport } from '@shared/hooks';
import { toast } from 'sonner';

interface ReportItem {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  reporter: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

const TARGET_TYPE_TABS = [
  { value: 'all', types: '' },
  { value: 'content', types: 'POST,COMMENT,COURSE,QUESTION' },
  { value: 'users', types: 'USER' },
] as const;

const STATUS_FILTERS = ['ALL', 'PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'] as const;

export default function ReportsPage() {
  const t = useTranslations('reports');
  const tc = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [tab, setTab] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [selectedReport, setSelectedReport] = React.useState<ReportItem | null>(null);
  const [reviewStatus, setReviewStatus] = React.useState('REVIEWED');
  const [adminNote, setAdminNote] = React.useState('');

  const targetTypes = TARGET_TYPE_TABS.find((t) => t.value === tab)?.types ?? '';

  const params: Record<string, string> = {
    page: String(page),
    limit: '10',
    ...(statusFilter !== 'ALL' && { status: statusFilter }),
    ...(targetTypes && { targetType: targetTypes }),
  };

  const { data, isLoading } = useAdminReports(params);
  const reviewMutation = useReviewReport();

  const responseData = data as
    | { data?: ReportItem[]; meta?: { page: number; total: number; totalPages: number } }
    | undefined;
  const reports: ReportItem[] = responseData?.data ?? [];
  const meta = responseData?.meta;

  const targetTypeLabel: Record<string, string> = {
    POST: t('post'),
    COMMENT: t('comment'),
    COURSE: t('course'),
    QUESTION: t('question'),
    USER: t('user'),
  };

  const handleReview = () => {
    if (!selectedReport) return;
    reviewMutation.mutate(
      { id: selectedReport.id, data: { status: reviewStatus, adminNote: adminNote || undefined } },
      {
        onSuccess: () => {
          toast.success(tc('success'));
          setReviewOpen(false);
          setSelectedReport(null);
          setAdminNote('');
        },
      },
    );
  };

  const handleQuickAction = (report: ReportItem, status: string) => {
    reviewMutation.mutate(
      { id: report.id, data: { status } },
      { onSuccess: () => toast.success(tc('success')) },
    );
  };

  const openReviewDialog = (report: ReportItem) => {
    setSelectedReport(report);
    setReviewStatus('REVIEWED');
    setAdminNote('');
    setReviewOpen(true);
  };

  const columns: Column<ReportItem>[] = [
    {
      key: 'reporter',
      header: t('reporter'),
      render: (item) => (
        <div className="flex items-center gap-2">
          <AvatarSimple src={item.reporter.avatarUrl} alt={item.reporter.fullName} size="sm" />
          <span className="text-sm font-medium">{item.reporter.fullName}</span>
        </div>
      ),
    },
    {
      key: 'targetType',
      header: t('contentType'),
      render: (item) => (
        <Badge variant="secondary">{targetTypeLabel[item.targetType] || item.targetType}</Badge>
      ),
    },
    {
      key: 'reason',
      header: t('reason'),
      className: 'max-w-[200px]',
      render: (item) => <span className="text-sm">{item.reason}</span>,
    },
    {
      key: 'description',
      header: t('contentPreview'),
      className: 'max-w-[250px]',
      render: (item) => (
        <p className="text-muted-foreground truncate text-sm">{item.description || '—'}</p>
      ),
    },
    {
      key: 'createdAt',
      header: t('reportedDate'),
      render: (item) => <span className="text-sm">{formatDate(item.createdAt)}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (item) =>
        item.status === 'PENDING' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('review')}
              onClick={() => openReviewDialog(item)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('dismiss')}
              onClick={() => handleQuickAction(item, 'DISMISSED')}
              disabled={reviewMutation.isPending}
            >
              <XCircle className="text-muted-foreground h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('actionTaken')}
              onClick={() => openReviewDialog(item)}
              disabled={reviewMutation.isPending}
            >
              <ShieldBan className="text-destructive h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Tab filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {TARGET_TYPE_TABS.map((item) => (
            <Badge
              key={item.value}
              variant={tab === item.value ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                setTab(item.value);
                setPage(1);
              }}
            >
              {item.value === 'all'
                ? tc('all')
                : item.value === 'content'
                  ? t('reportedContent')
                  : t('reportedUsers')}
            </Badge>
          ))}
        </div>

        <div className="border-border h-6 border-l" />

        {/* Status filters */}
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((status) => (
            <Badge
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {status === 'ALL' ? tc('all') : tc(`statusLabels.${status}`)}
            </Badge>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={reports}
        isLoading={isLoading}
        serverPage={page}
        serverTotalPages={meta?.totalPages ?? 1}
        serverTotal={meta?.total ?? 0}
        onServerPageChange={setPage}
      />

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reviewReport')}</DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p>
                  <strong>{t('reporter')}:</strong> {selectedReport.reporter.fullName}
                </p>
                <p>
                  <strong>{t('contentType')}:</strong>{' '}
                  {targetTypeLabel[selectedReport.targetType] || selectedReport.targetType}
                </p>
                <p>
                  <strong>{t('reason')}:</strong> {selectedReport.reason}
                </p>
                {selectedReport.description && (
                  <p>
                    <strong>{t('contentPreview')}:</strong> {selectedReport.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('status')}</label>
                <div className="flex gap-2">
                  {(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED'] as const).map((s) => (
                    <Badge
                      key={s}
                      variant={reviewStatus === s ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setReviewStatus(s)}
                    >
                      {tc(`statusLabels.${s}`)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminNote')}</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={t('adminNotePlaceholder')}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleReview} disabled={reviewMutation.isPending}>
              {tc('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
