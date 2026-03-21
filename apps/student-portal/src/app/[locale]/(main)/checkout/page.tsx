'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { BookOpen, QrCode, Shield, Loader2 } from 'lucide-react';
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
import { useAuthStore, useAuthHydrated, useServerCart, useCreateOrder } from '@shared/hooks';
import { formatPrice } from '@shared/utils';

interface ServerCartItem {
  id: string;
  price: number;
  course: {
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    instructor: { fullName: string };
  };
  chapter: { title: string } | null;
}

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();
  const { data: cartData, isLoading, isFetched } = useServerCart();
  const createOrder = useCreateOrder();
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Read coupon from sessionStorage (set by cart page)
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  useEffect(() => {
    const stored = sessionStorage.getItem('sslm-coupon');
    if (stored) {
      setCoupon(JSON.parse(stored));
    }
  }, []);

  // Redirect if not authenticated (after hydration)
  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const cart = cartData?.data as { items: ServerCartItem[]; subtotal: number } | undefined;
  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const discountAmount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Redirect to cart only if cart is truly empty AND we haven't started ordering
  const orderInProgress = createOrder.isPending || createOrder.isSuccess;
  const cartEmpty = isFetched && items.length === 0 && !orderInProgress;
  useEffect(() => {
    if (cartEmpty) router.push('/cart');
  }, [cartEmpty, router]);

  // Show loading while auth hydrating or cart loading
  if (!hydrated || !isAuthenticated || isLoading || (!isFetched && !cartEmpty)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-24" />
          </div>
          <div className="w-full lg:w-80">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (cartEmpty) return null;

  const handlePlaceOrder = () => {
    createOrder.mutate(coupon?.code, {
      onSuccess: (res) => {
        const data = res.data as { order: { id: string }; payment: Record<string, unknown> };
        // Save payment info for payment page
        sessionStorage.setItem(`sslm-payment-${data.order.id}`, JSON.stringify(data.payment));
        sessionStorage.removeItem('sslm-coupon');
        router.push(`/payment/${data.order.id}`);
      },
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left — Order Details */}
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
                    {item.course.thumbnailUrl ? (
                      <img
                        src={item.course.thumbnailUrl}
                        alt={item.course.title}
                        className="h-14 w-20 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="from-primary/20 to-primary/5 flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br">
                        <BookOpen className="text-primary/40 h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-semibold">
                        {item.chapter ? item.chapter.title : item.course.title}
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        {item.course.instructor.fullName}
                      </p>
                    </div>
                    <span className="text-sm font-medium">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coupon Applied */}
          {coupon && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('couponApplied')}</Badge>
                    <span className="text-sm font-medium">{coupon.code}</span>
                  </div>
                  <span className="text-success text-sm font-medium">
                    -{formatPrice(coupon.discount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

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

        {/* Right — Total */}
        <div className="w-full shrink-0 lg:w-80">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">{t('total')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('coupon')}</span>
                    <span className="text-success">-{formatPrice(discountAmount)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>{t('totalAmount')}</span>
                  <span>{formatPrice(total)}</span>
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

                <Button
                  className="mt-2 w-full"
                  size="lg"
                  disabled={!agreeTerms || createOrder.isPending}
                  onClick={handlePlaceOrder}
                >
                  {createOrder.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
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
