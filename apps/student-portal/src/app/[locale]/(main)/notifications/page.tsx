'use client';

import { useTranslations } from 'next-intl';
import { Bell, BookOpen, Star, MessageCircle, Settings, Trophy, CheckCheck } from 'lucide-react';
import { Button, Card, CardContent } from '@shared/ui';
import { mockNotifications } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const [notifications, setNotifications] = useState(mockNotifications);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const iconMap: Record<string, LucideIcon> = {
    enrollment: BookOpen,
    review: Star,
    comment: MessageCircle,
    system: Settings,
    achievement: Trophy,
  };

  const colorMap: Record<string, string> = {
    enrollment: 'text-blue-500 bg-blue-500/10',
    review: 'text-yellow-500 bg-yellow-500/10',
    comment: 'text-green-500 bg-green-500/10',
    system: 'text-blue-500 bg-blue-500/10',
    achievement: 'text-orange-500 bg-orange-500/10',
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4" />
          {t('markAllRead')}
        </Button>
      </div>

      <div className="space-y-2">
        {notifications.map((notif) => {
          const Icon = iconMap[notif.type] || Bell;
          const color = colorMap[notif.type] || 'text-muted-foreground bg-muted';

          return (
            <Card
              key={notif.id}
              className={cn('transition-colors', !notif.isRead && 'bg-accent/50')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      color,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', !notif.isRead && 'font-semibold')}>
                      {notif.message}
                    </p>
                    {notif.description && (
                      <p className="text-muted-foreground mt-0.5 text-xs">{notif.description}</p>
                    )}
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {notif.createdAt}
                    </span>
                  </div>
                  {!notif.isRead && (
                    <div className="bg-primary mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
