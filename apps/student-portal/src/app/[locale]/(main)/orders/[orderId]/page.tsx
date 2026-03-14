'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Separator } from '@shared/ui';
import { mockOrders, formatPrice } from '@/lib/mock-data';

export default function OrderDetailPage() {
  const t = useTranslations('orderDetail');
  const order = mockOrders[0];

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

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            {t('title')}
            <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.orderNumber} &bull; {new Date(order.date).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </div>

      {/* Order Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('orderItems')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="from-primary/20 to-primary/5 flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br">
                  <BookOpen className="text-primary/40 h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-sm font-semibold">{item.courseTitle}</h3>
                </div>
                <span className="text-sm font-medium">{formatPrice(item.price)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('paymentInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('paymentMethod')}</span>
              <span>{order.paymentMethod}</span>
            </div>
            {order.transactionId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('transactionId')}</span>
                <span className="font-mono">{order.transactionId}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Total Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('totalBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('subtotal')}</span>
              <span>{formatPrice(order.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('discount')}</span>
              <span className="text-success">-{formatPrice(0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>{t('total')}</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
