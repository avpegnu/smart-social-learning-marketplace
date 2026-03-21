'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@shared/ui';

type StatusType =
  | 'DRAFT'
  | 'PENDING'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'BANNED'
  | 'SUSPENDED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'DISABLED'
  | 'ANSWERED'
  | 'UNANSWERED'
  | 'APPROVED'
  | 'REVIEWED'
  | 'DISMISSED';

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING: 'outline',
  PENDING_REVIEW: 'outline',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  BANNED: 'destructive',
  SUSPENDED: 'destructive',
  COMPLETED: 'default',
  EXPIRED: 'secondary',
  DISABLED: 'outline',
  ANSWERED: 'default',
  UNANSWERED: 'outline',
  APPROVED: 'default',
  REVIEWED: 'secondary',
  DISMISSED: 'secondary',
};

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const t = useTranslations('common');
  const variant = statusVariants[status] ?? 'secondary';

  // Try to get localized label from common.statusLabels
  let displayLabel = label ?? status;
  try {
    const localized = t(`statusLabels.${status}`);
    if (localized && !localized.startsWith('common.statusLabels.')) {
      displayLabel = localized;
    }
  } catch {
    // Key not found, use raw status
  }

  return <Badge variant={variant}>{displayLabel}</Badge>;
}
