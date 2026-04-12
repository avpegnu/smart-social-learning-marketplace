'use client';

import {
  Bell,
  BookOpen,
  Star,
  MessageCircle,
  ShoppingCart,
  UserPlus,
  Trophy,
  Settings,
} from 'lucide-react';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const NOTIFICATION_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  FOLLOW: { icon: UserPlus, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  POST_LIKE: { icon: Star, color: 'text-red-500', bg: 'bg-red-500/10' },
  POST_COMMENT: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  NEW_MESSAGE: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  COURSE_ENROLLED: { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  COURSE_APPROVED: { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-500/10' },
  COURSE_REJECTED: { icon: BookOpen, color: 'text-red-500', bg: 'bg-red-500/10' },
  ORDER_COMPLETED: { icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ORDER_EXPIRED: { icon: ShoppingCart, color: 'text-red-500', bg: 'bg-red-500/10' },
  QUESTION_ANSWERED: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  ANSWER_VOTED: { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  WITHDRAWAL_COMPLETED: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  WITHDRAWAL_REJECTED: { icon: Trophy, color: 'text-red-500', bg: 'bg-red-500/10' },
  WITHDRAWAL_PENDING: { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  COURSE_PENDING_REVIEW: { icon: BookOpen, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  NEW_REPORT: { icon: Bell, color: 'text-red-500', bg: 'bg-red-500/10' },
  NEW_APPLICATION: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  SYSTEM: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-500/10' },
};

const DEFAULT_ICON = { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-500/10' };

export interface NotificationData {
  id: string;
  type: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

function getNotificationMessage(notification: NotificationData): string {
  const d = notification.data;
  const name = (d.fullName as string) || 'Someone';
  switch (notification.type) {
    case 'FOLLOW':
      return `${name} started following you`;
    case 'POST_LIKE':
      return `${name} liked your post`;
    case 'POST_COMMENT':
      return d.isReply ? `${name} replied to your comment` : `${name} commented on your post`;
    case 'NEW_MESSAGE':
      return `New message: ${(d.content as string)?.slice(0, 50) || ''}`;
    case 'COURSE_ENROLLED':
      return `A student enrolled in your course`;
    case 'COURSE_APPROVED':
      return `Your course has been approved`;
    case 'COURSE_REJECTED':
      return `Your course was rejected`;
    case 'ORDER_COMPLETED':
      return `Your order has been completed`;
    case 'ORDER_EXPIRED':
      return `Your order has expired`;
    case 'QUESTION_ANSWERED':
      return `${name} answered your question`;
    case 'ANSWER_VOTED':
      return `Your answer received a vote`;
    case 'WITHDRAWAL_COMPLETED':
      return `Your withdrawal has been processed`;
    case 'WITHDRAWAL_REJECTED':
      return `Your withdrawal was rejected`;
    case 'WITHDRAWAL_PENDING':
      return `New withdrawal request: ${d.amount ? `₫${Number(d.amount).toLocaleString()}` : ''}`;
    case 'COURSE_PENDING_REVIEW':
      return `Course "${d.courseTitle || ''}" submitted for review`;
    case 'NEW_REPORT':
      return `New ${d.targetType || 'content'} report: ${d.reason || ''}`;
    case 'NEW_APPLICATION':
      return `${name} applied to become an instructor`;
    case 'SYSTEM': {
      const subType = d.type as string;
      if (subType === 'GROUP_JOIN_REQUEST')
        return `${name} requested to join your group "${d.groupName ?? ''}"`;
      if (subType === 'GROUP_JOIN_APPROVED') return `Your group join request was approved`;
      return (d.message as string) || 'System notification';
    }
    default:
      return (d.message as string) || 'You have a new notification';
  }
}

export function NotificationItem({
  notification,
  compact,
  onClick,
}: {
  notification: NotificationData;
  compact?: boolean;
  onClick?: () => void;
}) {
  const iconConfig = NOTIFICATION_ICONS[notification.type] || DEFAULT_ICON;
  const Icon = iconConfig.icon;
  const message = getNotificationMessage(notification);

  return (
    <button
      onClick={onClick}
      className={cn(
        'hover:bg-accent flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
        !notification.isRead && 'bg-accent/50',
        compact ? 'py-2.5' : 'py-3',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          iconConfig.bg,
        )}
      >
        <Icon className={cn('h-4 w-4', iconConfig.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', !notification.isRead && 'font-medium')}>{message}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
    </button>
  );
}
