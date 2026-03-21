'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Trash2, Heart, BookOpen, Tag, ShoppingCart, Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import {
  useAuthStore,
  useCartStore,
  useServerCart,
  useRemoveCartItem,
  useMergeCart,
  useApplyCoupon,
  useAddToWishlist,
} from '@shared/hooks';
import { formatPrice } from '@shared/utils';
import { toast } from 'sonner';

// --- Types for server cart item ---

interface ServerCartItem {
  id: string;
  courseId: string;
  chapterId: string | null;
  price: number;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    price: number;
    instructor: { fullName: string };
  };
  chapter: { id: string; title: string; price: number } | null;
}

// --- Cart Item Card ---

interface CartItemCardProps {
  item: ServerCartItem;
  onRemove: (itemId: string) => void;
  onAddToWishlist: (courseId: string) => void;
  isRemoving: boolean;
}

function CartItemCard({ item, onRemove, onAddToWishlist, isRemoving }: CartItemCardProps) {
  const t = useTranslations('cart');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Thumbnail */}
          {item.course.thumbnailUrl ? (
            <img
              src={item.course.thumbnailUrl}
              alt={item.course.title}
              className="h-24 shrink-0 rounded-lg object-cover sm:h-auto sm:w-40"
            />
          ) : (
            <div className="from-primary/20 to-primary/5 flex h-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-auto sm:w-40">
              <BookOpen className="text-primary/40 h-8 w-8" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <Link href={`/courses/${item.course.slug}`}>
              <h3 className="hover:text-primary line-clamp-2 text-sm font-semibold transition-colors">
                {item.chapter ? item.chapter.title : item.course.title}
              </h3>
            </Link>
            <p className="text-muted-foreground mt-1 text-xs">{item.course.instructor.fullName}</p>
            {item.chapter && (
              <p className="text-muted-foreground mt-1 text-xs italic">{item.course.title}</p>
            )}
          </div>

          {/* Actions & Price */}
          <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
            <span className="text-foreground text-base font-bold">{formatPrice(item.price)}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRemove(item.id)}
                disabled={isRemoving}
                className="text-destructive flex cursor-pointer items-center gap-1 text-sm hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('remove')}
              </button>
              <button
                onClick={() => onAddToWishlist(item.courseId)}
                className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm hover:underline"
              >
                <Heart className="h-3.5 w-3.5" />
                {t('wishlist')}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Order Summary Sidebar ---

interface OrderSummaryProps {
  subtotal: number;
  discount: number;
  couponCode: string | null;
  onCheckout: () => void;
  isCheckingOut: boolean;
  couponInput: string;
  onCouponChange: (v: string) => void;
  onApplyCoupon: () => void;
  isApplyingCoupon: boolean;
}

function OrderSummary({
  subtotal,
  discount,
  couponCode,
  onCheckout,
  isCheckingOut,
  couponInput,
  onCouponChange,
  onApplyCoupon,
  isApplyingCoupon,
}: OrderSummaryProps) {
  const t = useTranslations('cart');
  const total = Math.max(0, subtotal - discount);

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="text-lg">{t('orderSummary')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('subtotal')}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('discount')} {couponCode && `(${couponCode})`}
              </span>
              <span className="text-success">-{formatPrice(discount)}</span>
            </div>
          )}

          {/* Coupon */}
          {!couponCode && (
            <div className="flex gap-2">
              <Input
                placeholder={t('couponPlaceholder')}
                value={couponInput}
                onChange={(e) => onCouponChange(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={onApplyCoupon}
                disabled={!couponInput.trim() || isApplyingCoupon}
              >
                {isApplyingCoupon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>{t('total')}</span>
            <span>{formatPrice(total)}</span>
          </div>

          <Button className="mt-2 w-full" size="lg" onClick={onCheckout} disabled={isCheckingOut}>
            {t('checkout')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Page ---

export default function CartPage() {
  const t = useTranslations('cart');
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const localItems = useCartStore((s) => s.items);
  const removeLocalItem = useCartStore((s) => s.removeItem);

  // Server cart
  const { data: serverCartData, isLoading: cartLoading } = useServerCart();
  const mergeCart = useMergeCart();
  const removeCartItem = useRemoveCartItem();
  const applyCouponMutation = useApplyCoupon();

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);

  // Merge localStorage → server on mount (once)
  const hasMerged = useRef(false);
  useEffect(() => {
    if (isAuthenticated && localItems.length > 0 && !hasMerged.current) {
      hasMerged.current = true;
      mergeCart.mutate(localItems.map((i) => ({ courseId: i.courseId, chapterId: i.chapterId })));
    }
  }, [isAuthenticated, localItems, mergeCart]);

  // Determine items to display
  const serverCart = serverCartData?.data as
    | { items: ServerCartItem[]; subtotal: number }
    | undefined;
  const isAuth = isAuthenticated;

  // If authenticated → show server cart; if guest → show local store
  const displayItems: ServerCartItem[] = isAuth
    ? (serverCart?.items ?? [])
    : localItems.map((i, idx) => ({
        id: `local-${idx}`,
        courseId: i.courseId,
        chapterId: i.chapterId ?? null,
        price: i.price,
        course: {
          id: i.courseId,
          title: i.title,
          slug: '',
          thumbnailUrl: i.thumbnailUrl || null,
          price: i.price,
          instructor: { fullName: i.instructorName },
        },
        chapter: null,
      }));

  const subtotal = isAuth
    ? (serverCart?.subtotal ?? 0)
    : localItems.reduce((s, i) => s + i.price, 0);

  const handleRemove = (itemId: string) => {
    if (isAuth) {
      removeCartItem.mutate(itemId);
    } else {
      const item = localItems.find((_, idx) => `local-${idx}` === itemId);
      if (item) removeLocalItem(item.courseId, item.chapterId);
    }
  };

  const handleApplyCoupon = () => {
    if (!isAuth) {
      toast.error(t('loginRequired'));
      return;
    }
    applyCouponMutation.mutate(couponInput.trim(), {
      onSuccess: (res) => {
        const data = res.data as { coupon: { code: string }; discount: number };
        setCouponCode(data.coupon.code);
        setDiscount(data.discount);
        toast.success(t('couponApplied'));
      },
    });
  };

  const addToWishlistMutation = useAddToWishlist();
  const handleAddToWishlist = (courseId: string) => {
    if (!isAuth) {
      toast.error(t('loginRequired'));
      return;
    }
    addToWishlistMutation.mutate(courseId, {
      onSuccess: () => toast.success(t('addedToWishlist')),
    });
  };

  const handleCheckout = () => {
    if (!isAuth) {
      router.push('/login');
      return;
    }
    // Pass coupon via sessionStorage so checkout page can read it
    if (couponCode) {
      sessionStorage.setItem('sslm-coupon', JSON.stringify({ code: couponCode, discount }));
    }
    router.push('/checkout');
  };

  // Loading state
  if (isAuth && cartLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="w-full lg:w-80">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState
          icon={ShoppingCart}
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          actionLabel={t('browseCourses')}
          onAction={() => router.push('/courses')}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">
        {t('title')} ({displayItems.length} {t('courses')})
      </h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Cart Items */}
        <div className="flex-1 space-y-4">
          {displayItems.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
              onAddToWishlist={handleAddToWishlist}
              isRemoving={removeCartItem.isPending}
            />
          ))}
        </div>

        {/* Order Summary */}
        <div className="w-full shrink-0 lg:w-80">
          <OrderSummary
            subtotal={subtotal}
            discount={discount}
            couponCode={couponCode}
            onCheckout={handleCheckout}
            isCheckingOut={false}
            couponInput={couponInput}
            onCouponChange={setCouponInput}
            onApplyCoupon={handleApplyCoupon}
            isApplyingCoupon={applyCouponMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
