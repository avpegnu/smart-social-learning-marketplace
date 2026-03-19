'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookOpen, QrCode, Shield } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, Badge } from '@shared/ui';
import { PriceDisplay } from '@/components/course/price-display';
import { mockCartItems } from '@/lib/mock-data';
import { formatPrice } from '@shared/utils';
import { useState } from 'react';

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const items = mockCartItems;
  const subtotal = items.reduce((sum, item) => sum + item.course.price, 0);
  const originalTotal = items.reduce((sum, item) => sum + item.course.originalPrice, 0);
  const discount = originalTotal - subtotal;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left - Order Details */}
        <div className="flex-1 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="from-primary/20 to-primary/5 flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br">
                      <BookOpen className="text-primary/40 h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-semibold">{item.course.title}</h3>
                      <p className="text-muted-foreground text-xs">{item.course.instructor.name}</p>
                    </div>
                    <PriceDisplay
                      price={item.course.price}
                      originalPrice={item.course.originalPrice}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coupon Applied */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t('couponApplied')}</Badge>
                  <span className="text-sm font-medium">WELCOME10</span>
                </div>
                <span className="text-success text-sm font-medium">-{formatPrice(50000)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('paymentMethod')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-accent/50 flex items-center gap-3 rounded-lg border p-4">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <QrCode className="text-primary h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {t('bankTransfer')}
                    <Badge variant="outline" className="text-xs">
                      {t('recommended')}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{t('bankTransferDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Total */}
        <div className="w-full shrink-0 lg:w-80">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">{t('total')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span>{formatPrice(originalTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('discount')}</span>
                  <span className="text-success">-{formatPrice(discount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('coupon')}</span>
                  <span className="text-success">-{formatPrice(50000)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>{t('totalAmount')}</span>
                  <span>{formatPrice(subtotal - 50000)}</span>
                </div>

                <div className="mt-4 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-muted-foreground cursor-pointer text-xs">
                    {t('agreeTerms')}{' '}
                    <Link href="#" className="text-primary hover:underline">
                      {t('termsLink')}
                    </Link>
                  </label>
                </div>

                <Button className="mt-2 w-full" size="lg" disabled={!agreeTerms}>
                  <Shield className="mr-2 h-4 w-4" />
                  {t('confirmPayment')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
