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
import { Eye, ShieldBan, XCircle, ExternalLink } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { useAdminReports, useReviewReport } from '@shared/hooks';
import { toast } from 'sonner';

const STUDENT_PORTAL_URL = process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001';

interface TargetPreview {
  text: string;
  authorName: string;
  context?: string;
  viewPath?: string;
}

interface ReportItem {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reporter: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  reviewedBy?: { id: string; fullName: string } | null;
  targetPreview?: TargetPreview | null;
}

const TARGET_TYPE_TABS = [
  { value: 'all', types: '' },
  { value: 'content', types: 'POST,COMMENT,COURSE,QUESTION' },
  { value: 'users', types: 'USER' },
] as const;

const STATUS_FILTERS = ['ALL', 'PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'] as const;

const DELETABLE_TYPES = new Set(['POST', 'COMMENT', 'QUESTION', 'ANSWER', 'COURSE']);

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
  const [actionDelete, setActionDelete] = React.useState(false);
  const [actionSuspend, setActionSuspend] = React.useState(false);

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
    ANSWER: t('answer'),
    USER: t('user'),
  };

  const handleReview = () => {
    if (!selectedReport) return;

    let action: string | undefined;
    if (reviewStatus === 'ACTION_TAKEN') {
      if (actionDelete && DELETABLE_TYPES.has(selectedReport.targetType)) {
        action = 'DELETE_CONTENT';
      } else if (actionSuspend && selectedReport.targetType === 'USER') {
        action = 'SUSPEND_USER';
      }
    }

    reviewMutation.mutate(
      {
        id: selectedReport.id,
        data: { status: reviewStatus, adminNote: adminNote || undefined, action },
      },
      {
        onSuccess: () => {
          toast.success(tc('success'));
          setReviewOpen(false);
          setSelectedReport(null);
          setAdminNote('');
          setActionDelete(false);
          setActionSuspend(false);
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

  const openReviewDialog = (report: ReportItem, defaultStatus = 'REVIEWED') => {
    setSelectedReport(report);
    setReviewStatus(defaultStatus);
    setAdminNote('');
    setActionDelete(false);
    setActionSuspend(false);
    setReviewOpen(true);
  };

  const getViewUrl = (item: ReportItem) => {
    const path = item.targetPreview?.viewPath;
    if (!path) return null;
    return `${STUDENT_PORTAL_URL}${path}`;
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
      key: 'targetPreview',
      header: t('reportedContent'),
      className: 'max-w-[280px]',
      render: (item) => {
        const preview = item.targetPreview;
        if (!preview)
          return (
            <span className="text-muted-foreground text-xs italic">{t('contentDeleted')}</span>
          );
        return (
          <div className="space-y-0.5">
            <p className="text-xs font-medium">{preview.authorName}</p>
            <p className="text-muted-foreground truncate text-xs">{preview.text}</p>
            {preview.context && (
              <p className="text-muted-foreground/70 truncate text-[11px] italic">
                {preview.context}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'reason',
      header: t('reason'),
      className: 'max-w-[160px]',
      render: (item) => <span className="text-sm">{item.reason}</span>,
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
      render: (item) => {
        const viewUrl = getViewUrl(item);
        const isPending = item.status === 'PENDING';
        return (
          <div className="flex items-center gap-1">
            {viewUrl && (
              <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-8 w-8" title={t('viewOriginal')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={isPending ? t('review') : t('viewDetail')}
              onClick={() => openReviewDialog(item)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {isPending && (
              <>
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
                  onClick={() => openReviewDialog(item, 'ACTION_TAKEN')}
                  disabled={reviewMutation.isPending}
                >
                  <ShieldBan className="text-destructive h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Tab filters */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {TARGET_TYPE_TABS.map((item) => (
            <Badge
              key={item.value}
              variant={tab === item.value ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-sm"
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

        <div className="border-border hidden h-6 border-l md:block" />

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((status) => (
            <Badge
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-sm"
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
              {/* Report info */}
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
                  <p className="mt-1">
                    <strong>{t('contentPreview')}:</strong> {selectedReport.description}
                  </p>
                )}
              </div>

              {/* Target content preview */}
              {selectedReport.targetPreview && (
                <div className="border-border rounded-lg border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-medium">
                      {t('reportedContent')}
                    </p>
                    {getViewUrl(selectedReport) && (
                      <a
                        href={getViewUrl(selectedReport)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 text-xs hover:underline"
                      >
                        {t('viewOriginal')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs font-medium">{selectedReport.targetPreview.authorName}</p>
                  <p className="text-muted-foreground text-xs">
                    {selectedReport.targetPreview.text}
                  </p>
                  {selectedReport.targetPreview.context && (
                    <p className="text-muted-foreground/70 mt-1 text-[11px] italic">
                      {selectedReport.targetPreview.context}
                    </p>
                  )}
                </div>
              )}

              {/* PENDING → edit form | Already reviewed → read-only detail */}
              {selectedReport.status === 'PENDING' ? (
                <>
                  {/* Status selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('status')}</label>
                    <div className="flex gap-2">
                      {(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED'] as const).map((s) => (
                        <Badge
                          key={s}
                          variant={reviewStatus === s ? 'default' : 'outline'}
                          className="cursor-pointer px-3 py-1 text-sm"
                          onClick={() => {
                            setReviewStatus(s);
                            if (s !== 'ACTION_TAKEN') {
                              setActionDelete(false);
                              setActionSuspend(false);
                            }
                          }}
                        >
                          {tc(`statusLabels.${s}`)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action options — only when ACTION_TAKEN */}
                  {reviewStatus === 'ACTION_TAKEN' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('actionOptions')}</label>
                      <div className="space-y-2">
                        {DELETABLE_TYPES.has(selectedReport.targetType) && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={actionDelete}
                              onChange={(e) => setActionDelete(e.target.checked)}
                              className="accent-primary h-4 w-4 rounded"
                            />
                            {selectedReport.targetType === 'COURSE'
                              ? t('unpublishCourse')
                              : t('deleteContent')}
                          </label>
                        )}
                        {selectedReport.targetType === 'USER' && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={actionSuspend}
                              onChange={(e) => setActionSuspend(e.target.checked)}
                              className="accent-primary h-4 w-4 rounded"
                            />
                            {t('suspendUser')}
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admin note */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('adminNote')}</label>
                    <Textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder={t('adminNotePlaceholder')}
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                /* Already reviewed — read-only */
                <div className="bg-muted space-y-1.5 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <strong>{t('status')}:</strong>
                    <StatusBadge status={selectedReport.status} />
                  </div>
                  {selectedReport.reviewedBy && (
                    <div>
                      <strong>{t('reviewedBy')}:</strong> {selectedReport.reviewedBy.fullName}
                    </div>
                  )}
                  {selectedReport.reviewedAt && (
                    <div>
                      <strong>{t('reviewedDate')}:</strong> {formatDate(selectedReport.reviewedAt)}
                    </div>
                  )}
                  {selectedReport.reviewNote && (
                    <div>
                      <strong>{t('adminNote')}:</strong> {selectedReport.reviewNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              {selectedReport?.status === 'PENDING' ? tc('cancel') : tc('close')}
            </Button>
            {selectedReport?.status === 'PENDING' && (
              <Button onClick={handleReview} disabled={reviewMutation.isPending}>
                {tc('submit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
