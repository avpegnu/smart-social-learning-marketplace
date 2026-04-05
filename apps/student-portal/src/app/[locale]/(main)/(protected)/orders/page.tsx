'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, Badge, Skeleton } from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import { Pagination } from '@/components/course/pagination';
import { useOrders } from '@shared/hooks';
import { formatPrice, formatDate } from '@shared/utils';

interface OrderItem {
  id: string;
  title: string;
  price: number;
}

interface OrderRow {
  id: string;
  orderCode: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive'> = {
  COMPLETED: 'default',
  PENDING: 'outline',
  EXPIRED: 'destructive',
};

export default function OrdersPage() {
  const t = useTranslations('orders');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useOrders({ page: String(page), limit: '10' });
  const orders = (data?.data as OrderRow[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const statusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return t('statusCompleted');
      case 'PENDING':
        return t('statusPending');
      case 'EXPIRED':
        return t('statusExpired');
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
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
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold">{order.orderCode}</span>
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>
                      {statusLabel(order.status)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(order.createdAt)} &bull; {order.items.length} {t('items')}
                  </p>
                  <div className="mt-2">
                    {order.items.slice(0, 3).map((item) => (
                      <p key={item.id} className="text-muted-foreground line-clamp-1 text-sm">
                        {item.title}
                      </p>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-muted-foreground text-sm">
                        +{order.items.length - 3} {t('items')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-bold">{formatPrice(order.finalAmount)}</span>
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

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
    </div>
  );
}
