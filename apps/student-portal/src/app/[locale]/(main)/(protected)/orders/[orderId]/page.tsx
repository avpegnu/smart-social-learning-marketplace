'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, BookOpen, CreditCard } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
  Skeleton,
} from '@shared/ui';
import { useOrderDetail } from '@shared/hooks';
import { RecommendationSection } from '@/components/course/recommendation-section';
import { formatPrice, formatDate } from '@shared/utils';

interface OrderItem {
  id: string;
  type: string;
  courseId: string;
  title: string;
  price: number;
}

interface OrderData {
  id: string;
  orderCode: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive'> = {
  COMPLETED: 'default',
  PENDING: 'outline',
  EXPIRED: 'destructive',
};

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const t = useTranslations('orderDetail');
  const router = useRouter();

  const { data: orderData, isLoading } = useOrderDetail(orderId);
  const order = orderData?.data as OrderData | undefined;

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
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Link href="/orders">
          <Button variant="outline" className="mt-4">
            {t('backToOrders')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            {t('title')}
            <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>
              {statusLabel(order.status)}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.orderCode} &bull; {formatDate(order.createdAt)}
          </p>
        </div>
      </div>

      {/* PENDING — continue payment */}
      {order.status === 'PENDING' && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="text-warning h-5 w-5" />
              <span className="text-sm font-medium">{t('pendingPayment')}</span>
            </div>
            <Button size="sm" onClick={() => router.push(`/payment/${order.id}`)}>
              {t('continuePayment')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('orderItems')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="from-primary/20 to-primary/5 flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br">
                  <BookOpen className="text-primary/40 h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-sm font-semibold">{item.title}</h3>
                </div>
                <span className="text-sm font-medium">{formatPrice(item.price)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* COMPLETED — continue learning */}
      {order.status === 'COMPLETED' && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <Button className="w-full" onClick={() => router.push('/my-learning')}>
              {t('continueLearning')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Total Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('totalBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('subtotal')}</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('discount')}</span>
                <span className="text-success">-{formatPrice(order.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>{t('total')}</span>
              <span>{formatPrice(order.finalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Post-purchase recommendations */}
      <RecommendationSection
        context="post_purchase"
        limit={4}
        title={t('alsoLiked')}
        subtitle={t('alsoLikedSubtitle')}
        requireAuth
      />
    </div>
  );
}
