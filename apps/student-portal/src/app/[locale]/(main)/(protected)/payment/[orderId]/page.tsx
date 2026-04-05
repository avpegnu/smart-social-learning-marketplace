'use client';

import { use, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ArrowLeft, Copy, Loader2, Clock, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Badge,
  Skeleton,
} from '@shared/ui';
import { useOrderDetail, useOrderStatus } from '@shared/hooks';
import { formatPrice } from '@shared/utils';
import { toast } from 'sonner';

// --- Types ---

interface PaymentInfo {
  bankId: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  content: string;
  qrUrl: string;
}

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
  expiresAt: string | null;
  paidAt: string | null;
  items: OrderItem[];
}

// --- Countdown Hook ---

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const calculate = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, diff);
    };

    setRemaining(calculate());
    const interval = setInterval(() => {
      const diff = calculate();
      setRemaining(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isExpired = remaining <= 0 && expiresAt !== null;

  return { minutes, seconds, remaining, isExpired };
}

// --- Bank Detail Row ---

function BankDetailRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations('payment');

  const handleCopy = () => {
    navigator.clipboard?.writeText(value);
    toast.success(t('copied'));
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-mono text-sm font-medium">{value}</p>
      </div>
      <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleCopy}>
        <Copy className="h-3.5 w-3.5" />
        {t('copy')}
      </Button>
    </div>
  );
}

// --- Payment Status Display ---

function PaymentStatus({ status }: { status: string }) {
  const t = useTranslations('payment');
  const router = useRouter();

  if (status === 'COMPLETED') {
    return (
      <Card className="mb-8">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="text-success mx-auto mb-3 h-12 w-12" />
          <p className="text-lg font-semibold">{t('paymentSuccess')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('paymentSuccessDesc')}</p>
          <Button className="mt-4" onClick={() => router.push('/my-learning')}>
            {t('goToLearning')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'EXPIRED') {
    return (
      <Card className="mb-8">
        <CardContent className="p-6 text-center">
          <XCircle className="text-destructive mx-auto mb-3 h-12 w-12" />
          <p className="text-lg font-semibold">{t('paymentExpired')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('paymentExpiredDesc')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/courses')}>
            {t('backToCourses')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // PENDING — waiting
  return (
    <Card className="mb-8">
      <CardContent className="p-6 text-center">
        <Loader2 className="text-primary mx-auto mb-3 h-8 w-8 animate-spin" />
        <p className="font-medium">{t('waitingPayment')}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t('waitingPaymentDesc')}</p>
      </CardContent>
    </Card>
  );
}

// --- Main Page ---

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const t = useTranslations('payment');
  const router = useRouter();

  // Order detail
  const { data: orderData, isLoading } = useOrderDetail(orderId);
  const order = orderData?.data as OrderData | undefined;

  // Payment info: prefer API response, fallback to sessionStorage
  const [storedPayment, setStoredPayment] = useState<PaymentInfo | null>(null);
  useEffect(() => {
    const stored = sessionStorage.getItem(`sslm-payment-${orderId}`);
    if (stored) {
      setStoredPayment(JSON.parse(stored));
    }
  }, [orderId]);

  const apiPayment = (orderData?.data as Record<string, unknown> | undefined)?.payment as
    | PaymentInfo
    | undefined;
  const payment = apiPayment ?? storedPayment;

  // Status polling
  const { data: statusData } = useOrderStatus(orderId);
  const currentStatus =
    (statusData?.data as { status: string } | undefined)?.status ?? order?.status ?? 'PENDING';

  // Countdown
  const { minutes, seconds, isExpired } = useCountdown(order?.expiresAt ?? null);

  const effectiveStatus = isExpired && currentStatus === 'PENDING' ? 'EXPIRED' : currentStatus;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-5 w-48" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground">{t('orderNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/orders/${orderId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('orderNumber')}: <span className="font-mono font-medium">{order.orderCode}</span>
            </p>
          </div>
        </div>
        {effectiveStatus === 'PENDING' && (
          <Badge variant="outline" className="gap-1.5 px-4 py-2 text-base">
            <Clock className="h-4 w-4" />
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Badge>
        )}
      </div>

      {/* Status */}
      <PaymentStatus status={effectiveStatus} />

      {/* QR and Bank Info — only show when PENDING */}
      {effectiveStatus === 'PENDING' && payment && (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('scanQr')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <img
                src={payment.qrUrl}
                alt="QR Payment"
                className="mb-4 w-full max-w-[280px] rounded-xl"
              />
              <p className="text-muted-foreground text-center text-sm">{t('scanQrDesc')}</p>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('bankInfo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <BankDetailRow label={t('bankName')} value={payment.bankId} />
                <BankDetailRow label={t('accountNumber')} value={payment.accountNumber} />
                <BankDetailRow label={t('accountName')} value={payment.accountName} />
                <BankDetailRow label={t('transferContent')} value={payment.content} />
                <BankDetailRow label={t('amount')} value={formatPrice(payment.amount)} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Order Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('orderDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="from-primary/20 to-primary/5 flex h-10 w-16 shrink-0 items-center justify-center rounded bg-gradient-to-br">
                  <BookOpen className="text-primary/40 h-4 w-4" />
                </div>
                <span className="line-clamp-1 flex-1 text-sm">{item.title}</span>
                <span className="text-sm font-medium">{formatPrice(item.price)}</span>
              </div>
            ))}
            {order.discountAmount > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{t('couponDiscount')}</span>
                  <span className="text-success text-sm">-{formatPrice(order.discountAmount)}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between font-bold">
              <span>{t('total')}</span>
              <span>{formatPrice(order.finalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
