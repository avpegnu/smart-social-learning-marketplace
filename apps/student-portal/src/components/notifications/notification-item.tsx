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
  ShieldCheck,
} from 'lucide-react';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const NOTIFICATION_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  // Social
  FOLLOW: { icon: UserPlus, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  POST_LIKE: { icon: Star, color: 'text-red-500', bg: 'bg-red-500/10' },
  POST_COMMENT: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  // Chat
  NEW_MESSAGE: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  // Course
  COURSE_ENROLLED: { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  COURSE_APPROVED: { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-500/10' },
  COURSE_REJECTED: { icon: BookOpen, color: 'text-red-500', bg: 'bg-red-500/10' },
  // Orders
  ORDER_COMPLETED: { icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ORDER_EXPIRED: { icon: ShoppingCart, color: 'text-red-500', bg: 'bg-red-500/10' },
  // Q&A
  QUESTION_ANSWERED: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  ANSWER_VOTED: { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  // Withdrawal
  WITHDRAWAL_COMPLETED: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  WITHDRAWAL_REJECTED: { icon: Trophy, color: 'text-red-500', bg: 'bg-red-500/10' },
  WITHDRAWAL_PENDING: { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  // Admin
  COURSE_PENDING_REVIEW: { icon: BookOpen, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  NEW_REPORT: { icon: Bell, color: 'text-red-500', bg: 'bg-red-500/10' },
  NEW_APPLICATION: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  REPORT_RESOLVED: { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
  // System
  SYSTEM: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-500/10' },
};

const DEFAULT_ICON = { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-500/10' };

function getNotificationUrl(notification: NotificationData): string | null {
  const d = notification.data;

  switch (notification.type) {
    // Social
    case 'FOLLOW':
      return d.userId ? `/profile/${d.userId as string}` : null;
    case 'POST_LIKE':
    case 'POST_COMMENT':
      return d.postId ? `/social/posts/${d.postId as string}` : '/social';

    // Q&A
    case 'QUESTION_ANSWERED':
    case 'ANSWER_VOTED':
      return d.questionId ? `/qna/${d.questionId as string}` : '/qna';

    // Orders
    case 'ORDER_COMPLETED':
      return d.orderId ? `/orders/${d.orderId as string}` : '/orders';
    case 'ORDER_EXPIRED':
      return '/orders';

    // Course (navigate to my-learning as safe fallback)
    case 'COURSE_ENROLLED':
    case 'COURSE_APPROVED':
    case 'COURSE_REJECTED':
      return '/my-learning';

    // Chat
    case 'NEW_MESSAGE':
      return '/chat';

    // Groups (SYSTEM sub-types)
    case 'SYSTEM': {
      const subType = d.type as string;
      if (subType === 'GROUP_JOIN_REQUEST' || subType === 'GROUP_JOIN_APPROVED') {
        return d.groupId ? `/social/groups/${d.groupId as string}` : '/social/groups';
      }
      return null;
    }

    // Admin-only types — no route in student-portal
    default:
      return null;
  }
}

export interface NotificationData {
  id: string;
  type: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: NotificationData;
  compact?: boolean;
  onClick?: () => void;
}

function getNotificationMessage(notification: NotificationData): string {
  const d = notification.data;
  const name = (d.fullName as string) || 'Someone';
  switch (notification.type) {
    // Social
    case 'FOLLOW':
      return `${name} started following you`;
    case 'POST_LIKE':
      return `${name} liked your post`;
    case 'POST_COMMENT':
      return d.isReply ? `${name} replied to your comment` : `${name} commented on your post`;
    // Chat
    case 'NEW_MESSAGE':
      return `New message: ${(d.content as string)?.slice(0, 50) || ''}`;
    // Course
    case 'COURSE_ENROLLED':
      return `A student enrolled in your course`;
    case 'COURSE_APPROVED':
      return `Your course has been approved`;
    case 'COURSE_REJECTED':
      return `Your course was rejected`;
    // Orders
    case 'ORDER_COMPLETED':
      return `Your order has been completed`;
    case 'ORDER_EXPIRED':
      return `Your order has expired`;
    // Q&A
    case 'QUESTION_ANSWERED':
      return `${name} answered your question`;
    case 'ANSWER_VOTED':
      return `Your answer received a vote`;
    // Withdrawal
    case 'WITHDRAWAL_COMPLETED':
      return `Your withdrawal has been processed`;
    case 'WITHDRAWAL_REJECTED':
      return `Your withdrawal was rejected`;
    case 'WITHDRAWAL_PENDING':
      return `New withdrawal request: ${d.amount ? `₫${Number(d.amount).toLocaleString()}` : ''}`;
    // Admin
    case 'COURSE_PENDING_REVIEW':
      return `Course "${d.courseTitle || ''}" submitted for review`;
    case 'NEW_REPORT':
      return `New ${d.targetType || 'content'} report: ${d.reason || ''}`;
    case 'NEW_APPLICATION':
      return `${name} applied to become an instructor`;
    case 'REPORT_RESOLVED':
      return d.status === 'ACTION_TAKEN'
        ? 'Your report has been reviewed and action was taken'
        : 'Your report has been reviewed';
    // System (group join request, etc.)
    case 'SYSTEM': {
      const subType = d.type as string;
      if (subType === 'GROUP_JOIN_REQUEST')
        return `${name} requested to join your group "${d.groupName || ''}"`;
      if (subType === 'GROUP_JOIN_APPROVED') return `Your group join request was approved`;
      return (d.message as string) || 'System notification';
    }
    default:
      return (d.message as string) || 'You have a new notification';
  }
}

export function NotificationItem({ notification, compact, onClick }: NotificationItemProps) {
  const iconConfig = NOTIFICATION_ICONS[notification.type] || DEFAULT_ICON;
  const Icon = iconConfig.icon;
  const message = getNotificationMessage(notification);
  const url = getNotificationUrl(notification);

  const className = cn(
    'hover:bg-accent flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
    !notification.isRead && 'bg-accent/50',
    compact ? 'py-2.5' : 'py-3',
  );

  const content = (
    <>
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
    </>
  );

  if (url) {
    return (
      <Link href={url} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}
