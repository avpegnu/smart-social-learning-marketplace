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
  ENROLLMENT_CONFIRMED: { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  COURSE_COMPLETED: { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  NEW_REVIEW: { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  REVIEW_REPLY: { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  NEW_COMMENT: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  POST_LIKED: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  ORDER_COMPLETED: { icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  PAYMENT_RECEIVED: { icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  NEW_FOLLOWER: { icon: UserPlus, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ACHIEVEMENT: { icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  CERTIFICATE_EARNED: { icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-500/10' },
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

interface NotificationItemProps {
  notification: NotificationData;
  compact?: boolean;
  onClick?: () => void;
}

function getNotificationMessage(notification: NotificationData): string {
  const d = notification.data;
  switch (notification.type) {
    case 'ENROLLMENT_CONFIRMED':
      return `You enrolled in "${d.courseTitle || 'a course'}"`;
    case 'ORDER_COMPLETED':
      return `Your order has been completed successfully`;
    case 'NEW_REVIEW':
      return `${d.userName || 'Someone'} reviewed your course "${d.courseTitle || ''}"`;
    case 'NEW_FOLLOWER':
      return `${d.userName || 'Someone'} started following you`;
    case 'NEW_COMMENT':
      return `${d.userName || 'Someone'} commented on your post`;
    case 'POST_LIKED':
      return `${d.userName || 'Someone'} liked your post`;
    case 'CERTIFICATE_EARNED':
      return `You earned a certificate for "${d.courseTitle || 'a course'}"`;
    case 'ACHIEVEMENT':
      return `Achievement unlocked: ${d.title || 'New achievement'}`;
    case 'PAYMENT_RECEIVED':
      return `Payment received for "${d.courseTitle || 'a course'}"`;
    default:
      return (d.message as string) || 'You have a new notification';
  }
}

export function NotificationItem({ notification, compact, onClick }: NotificationItemProps) {
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
