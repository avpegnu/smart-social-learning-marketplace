'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import { mockOrders, formatPrice } from '@/lib/mock-data';

export default function OrdersPage() {
  const t = useTranslations('orders');

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success' as const;
      case 'pending':
        return 'warning' as const;
      case 'expired':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return t('statusCompleted');
      case 'pending':
        return t('statusPending');
      case 'expired':
        return t('statusExpired');
      default:
        return status;
    }
  };

  if (mockOrders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState icon={ShoppingBag} title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="space-y-4">
        {mockOrders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                    <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {new Date(order.date).toLocaleDateString('vi-VN')} &bull; {order.items.length}{' '}
                    {t('items')}
                  </p>
                  <div className="mt-2">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-muted-foreground line-clamp-1 text-sm">
                        {item.courseTitle}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-bold">{formatPrice(order.total)}</span>
                  </div>
                  <Link href={`/orders/${order.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('viewDetail')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
