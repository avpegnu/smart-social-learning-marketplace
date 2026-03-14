'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatCard } from '@/components/data-display/stat-card';
import { StatusBadge } from '@/components/data-display/status-badge';
import {
  AvatarSimple,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@shared/ui';
import { Check, X } from 'lucide-react';
import {
  adminWithdrawalRequests,
  formatCurrency,
  formatDate,
  type AdminWithdrawalRequest,
} from '@/lib/mock-data';

export default function AdminWithdrawalsPage() {
  const t = useTranslations('adminWithdrawals');
  const tc = useTranslations('common');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<AdminWithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  let filteredData = adminWithdrawalRequests;
  if (statusFilter !== 'ALL') {
    filteredData = filteredData.filter((w) => w.status === statusFilter);
  }

  const pendingAmount = adminWithdrawalRequests
    .filter((w) => w.status === 'PENDING')
    .reduce((sum, w) => sum + w.amount, 0);
  const approvedThisMonth = adminWithdrawalRequests
    .filter((w) => w.status === 'APPROVED' || w.status === 'COMPLETED')
    .reduce((sum, w) => sum + w.amount, 0);
  const totalPaidOut = adminWithdrawalRequests
    .filter((w) => w.status === 'COMPLETED')
    .reduce((sum, w) => sum + w.amount, 0);

  const stats = [
    {
      label: t('pendingAmount'),
      value: formatCurrency(pendingAmount),
      change: -15,
      changeLabel: t('vsLastMonth'),
      icon: 'Clock',
    },
    {
      label: t('approvedThisMonth'),
      value: formatCurrency(approvedThisMonth),
      change: 22,
      changeLabel: t('vsLastMonth'),
      icon: 'DollarSign',
    },
    {
      label: t('totalPaidOut'),
      value: formatCurrency(totalPaidOut),
      change: 18,
      changeLabel: t('vsLastMonth'),
      icon: 'DollarSign',
    },
  ];

  const columns: Column<AdminWithdrawalRequest>[] = [
    {
      key: 'instructorName',
      header: t('instructorName'),
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <AvatarSimple alt={item.instructorName} size="sm" />
          <span className="font-medium">{item.instructorName}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('amount'),
      sortable: true,
      render: (item) => (
        <span className="font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
      ),
    },
    {
      key: 'bankInfo',
      header: t('bankInfo'),
      render: (item) => (
        <div>
          <p className="text-sm">{item.bankName}</p>
          <p className="text-muted-foreground text-xs">{item.accountNumber}</p>
        </div>
      ),
    },
    {
      key: 'requestedAt',
      header: t('requestedDate'),
      sortable: true,
      render: (item) => <span className="text-sm">{formatDate(item.requestedAt)}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: tc('actions'),
      render: (item) =>
        item.status === 'PENDING' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-success hover:text-success"
              onClick={() => {
                setSelectedRequest(item);
                setApproveDialogOpen(true);
              }}
            >
              <Check className="h-4 w-4" />
              {tc('approve')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setSelectedRequest(item);
                setRejectReason('');
                setRejectDialogOpen(true);
              }}
            >
              <X className="h-4 w-4" />
              {tc('reject')}
            </Button>
          </div>
        ) : item.status === 'REJECTED' && item.rejectReason ? (
          <span className="text-muted-foreground text-xs">{item.rejectReason}</span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchKey="instructorName"
        pageSize={8}
        filterSlot={
          <div className="flex items-center gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].map((s) => (
              <Badge
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ALL'
                  ? t('allStatuses')
                  : t(s.toLowerCase() as 'pending' | 'approved' | 'rejected' | 'completed')}
              </Badge>
            ))}
          </div>
        }
      />

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmApprove')}</DialogTitle>
            <DialogDescription>
              {t('confirmApproveDesc', {
                name: selectedRequest?.instructorName ?? '',
                amount: selectedRequest ? formatCurrency(selectedRequest.amount) : '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={() => setApproveDialogOpen(false)}>{tc('approve')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmReject')}</DialogTitle>
            <DialogDescription>{t('confirmRejectDesc')}</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('rejectReasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={() => setRejectDialogOpen(false)}>
              {tc('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
