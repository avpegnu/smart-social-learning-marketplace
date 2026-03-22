'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@shared/ui';
import {
  useInfiniteNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@shared/hooks';
import { NotificationItem } from '@/components/notifications/notification-item';
import type { NotificationData } from '@/components/notifications/notification-item';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'unread';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const [filter, setFilter] = useState<FilterTab>('all');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const readParam = filter === 'unread' ? { read: false } : undefined;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteNotifications(readParam);

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const allNotifications: NotificationData[] =
    data?.pages.flatMap((page) => {
      const p = page as { data?: NotificationData[] };
      return p.data ?? [];
    }) ?? [];

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const handleItemClick = (notification: NotificationData) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'unread', label: t('filterUnread') },
  ];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || unreadCount === 0}
        >
          <CheckCheck className="h-4 w-4" />
          {t('markAllRead')}
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="bg-muted mb-4 flex gap-1 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="text-muted-foreground py-16 text-center">
          <Bell className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p className="font-medium">{t('empty')}</p>
          <p className="mt-1 text-sm">{t('emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {allNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleItemClick(notification)}
            />
          ))}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
