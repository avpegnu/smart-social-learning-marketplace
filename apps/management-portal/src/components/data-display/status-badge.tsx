'use client';

import { Badge } from '@shared/ui';

type StatusType =
  | 'DRAFT'
  | 'PENDING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'BANNED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'DISABLED'
  | 'ANSWERED'
  | 'UNANSWERED'
  | 'APPROVED'
  | 'REVIEWED'
  | 'DISMISSED';

const statusConfig: Record<
  StatusType,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
    label: string;
  }
> = {
  DRAFT: { variant: 'secondary', label: 'Draft' },
  PENDING: { variant: 'warning', label: 'Pending' },
  PUBLISHED: { variant: 'success', label: 'Published' },
  REJECTED: { variant: 'destructive', label: 'Rejected' },
  ACTIVE: { variant: 'success', label: 'Active' },
  INACTIVE: { variant: 'secondary', label: 'Inactive' },
  BANNED: { variant: 'destructive', label: 'Banned' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  EXPIRED: { variant: 'secondary', label: 'Expired' },
  DISABLED: { variant: 'outline', label: 'Disabled' },
  ANSWERED: { variant: 'success', label: 'Answered' },
  UNANSWERED: { variant: 'warning', label: 'Unanswered' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REVIEWED: { variant: 'info', label: 'Reviewed' },
  DISMISSED: { variant: 'secondary', label: 'Dismissed' },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status] || { variant: 'secondary' as const, label: status };

  return <Badge variant={config.variant}>{label || config.label}</Badge>;
}
