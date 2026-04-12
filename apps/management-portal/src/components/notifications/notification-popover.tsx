'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@shared/ui';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useAuthStore,
} from '@shared/hooks';
import { NotificationItem } from './notification-item';
import type { NotificationData } from './notification-item';

export function NotificationPopover() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: countRaw } = useUnreadNotificationCount(isAuthenticated);
  const unreadCount =
    (countRaw as { data?: { count?: number }; count?: number })?.data?.count ??
    (countRaw as { count?: number })?.count ??
    0;

  const { data: notifData, isLoading } = useNotifications(open ? { page: 1, limit: 8 } : undefined);
  const notifications = (open ? (notifData as { data?: NotificationData[] })?.data : []) ?? [];

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleItemClick = (notification: NotificationData) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-accent relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-popover border-border absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl sm:w-96">
          {/* Header */}
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t('title')}</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto px-2 py-1 text-xs"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  {t('markAllRead')}
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">{t('empty')}</div>
            ) : (
              <div className="p-1">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    compact
                    onClick={() => handleItemClick(n)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2">
            <button
              onClick={() => markAllRead.mutate()}
              className="text-primary block w-full text-center text-sm font-medium hover:underline"
            >
              {t('markAllRead')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
