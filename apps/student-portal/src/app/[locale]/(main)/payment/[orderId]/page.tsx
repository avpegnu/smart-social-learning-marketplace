'use client';

import { useTranslations } from 'next-intl';
import { QrCode, Copy, Loader2, Clock, BookOpen } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, Badge } from '@shared/ui';
import { mockCartItems } from '@/lib/mock-data';
import { formatPrice } from '@shared/utils';
import { useState, useEffect } from 'react';

export default function PaymentPage() {
  const t = useTranslations('payment');
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const items = mockCartItems;
  const total = items.reduce((sum, item) => sum + item.course.price, 0) - 50000;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('orderNumber')}: <span className="font-mono font-medium">ORD-20260314-006</span>
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {t('expiresIn')}: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Badge>
      </div>

      {/* QR and Bank Info */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('scanQr')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="bg-muted mb-4 flex h-56 w-56 items-center justify-center rounded-xl">
              <QrCode className="text-muted-foreground/30 h-24 w-24" />
            </div>
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
              {[
                { label: t('bankName'), value: 'MB Bank (Ngân hàng Quân đội)' },
                { label: t('accountNumber'), value: '0123456789' },
                { label: t('accountName'), value: 'CONG TY TNHH SSLM' },
                { label: t('transferContent'), value: 'ORD20260314006' },
                { label: t('amount'), value: formatPrice(total) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs">{label}</p>
                    <p className="font-mono text-sm font-medium">{value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => navigator.clipboard?.writeText(value)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t('copy')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Waiting Status */}
      <Card className="mb-8">
        <CardContent className="p-6 text-center">
          <Loader2 className="text-primary mx-auto mb-3 h-8 w-8 animate-spin" />
          <p className="font-medium">{t('waitingPayment')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('waitingPaymentDesc')}</p>
        </CardContent>
      </Card>

      {/* Order Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('orderDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="from-primary/20 to-primary/5 flex h-10 w-16 shrink-0 items-center justify-center rounded bg-gradient-to-br">
                  <BookOpen className="text-primary/40 h-4 w-4" />
                </div>
                <span className="line-clamp-1 flex-1 text-sm">{item.course.title}</span>
                <span className="text-sm font-medium">{formatPrice(item.course.price)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{t('couponDiscount')}</span>
              <span className="text-success text-sm">-{formatPrice(50000)}</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
