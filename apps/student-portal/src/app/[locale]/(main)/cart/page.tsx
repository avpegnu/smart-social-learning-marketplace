'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Trash2, Heart, BookOpen, Tag, ShoppingCart } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator } from '@shared/ui';
import { PriceDisplay } from '@/components/course/price-display';
import { EmptyState } from '@/components/feedback/empty-state';
import { mockCartItems, formatPrice } from '@/lib/mock-data';
import { useState } from 'react';

export default function CartPage() {
  const t = useTranslations('cart');
  const [items, setItems] = useState(mockCartItems);
  const [coupon, setCoupon] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.course.price, 0);
  const originalTotal = items.reduce((sum, item) => sum + item.course.originalPrice, 0);
  const discount = originalTotal - subtotal;

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState
          icon={ShoppingCart}
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          actionLabel={t('browseCourses')}
          onAction={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">
        {t('title')} ({items.length} {t('courses')})
      </h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Cart Items */}
        <div className="flex-1 space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* Thumbnail */}
                  <div className="from-primary/20 to-primary/5 flex h-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-auto sm:w-40">
                    <BookOpen className="text-primary/40 h-8 w-8" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link href={`/courses/${item.course.slug}`}>
                      <h3 className="hover:text-primary line-clamp-2 text-sm font-semibold transition-colors">
                        {item.course.title}
                      </h3>
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.course.instructor.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-warning text-sm font-bold">{item.course.rating}</span>
                      <span className="text-muted-foreground text-xs">
                        ({item.course.totalRatings})
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {item.course.totalDuration} &bull; {item.course.totalLessons} {t('lessons')}{' '}
                      &bull; {t(item.course.level)}
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
                    <PriceDisplay
                      price={item.course.price}
                      originalPrice={item.course.originalPrice}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-destructive flex cursor-pointer items-center gap-1 text-sm hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('remove')}
                      </button>
                      <button className="text-muted-foreground flex cursor-pointer items-center gap-1 text-sm hover:underline">
                        <Heart className="h-3.5 w-3.5" />
                        {t('wishlist')}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="w-full shrink-0 lg:w-80">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-lg">{t('orderSummary')}</CardTitle>
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

                {/* Coupon */}
                <div className="flex gap-2">
                  <Input
                    placeholder={t('couponPlaceholder')}
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>{t('total')}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <Button className="mt-2 w-full" size="lg">
                  {t('checkout')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
