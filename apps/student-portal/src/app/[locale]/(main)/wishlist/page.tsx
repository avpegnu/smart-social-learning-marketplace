'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Heart, Trash2, ShoppingCart, BookOpen } from 'lucide-react';
import { Button, Card, CardContent, Skeleton } from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import {
  useWishlist,
  useRemoveFromWishlist,
  useAddCartItem,
  useCartStore,
  useAuthStore,
} from '@shared/hooks';
import { formatPrice } from '@shared/utils';
import { useRouter } from '@/i18n/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface WishlistItem {
  id: string;
  courseId: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    price: number;
    avgRating: number;
    totalStudents: number;
    instructor: { fullName: string };
  };
}

export default function WishlistPage() {
  const t = useTranslations('wishlist');
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const addToCart = useCartStore((s) => s.addItem);

  const { data, isLoading } = useWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const addCartItem = useAddCartItem();

  const items = (data?.data as WishlistItem[]) ?? [];

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState icon={Heart} title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">
        {t('title')} ({items.length})
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            {/* Thumbnail */}
            <Link href={`/courses/${item.course.slug}`}>
              {item.course.thumbnailUrl ? (
                <img
                  src={item.course.thumbnailUrl}
                  alt={item.course.title}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="from-primary/20 to-primary/5 flex aspect-video items-center justify-center bg-gradient-to-br">
                  <BookOpen className="text-primary/30 h-10 w-10" />
                </div>
              )}
            </Link>

            <CardContent className="p-4">
              <Link href={`/courses/${item.course.slug}`}>
                <h3 className="hover:text-primary mb-1 line-clamp-2 text-sm font-semibold transition-colors">
                  {item.course.title}
                </h3>
              </Link>
              <p className="text-muted-foreground mb-2 text-xs">
                {item.course.instructor.fullName}
              </p>
              <p className="mb-3 font-bold">
                {item.course.price === 0 ? t('free') : formatPrice(item.course.price)}
              </p>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={addCartItem.isPending}
                  onClick={() => {
                    addCartItem.mutate(
                      { courseId: item.course.id },
                      {
                        onSuccess: () => {
                          addToCart({
                            courseId: item.course.id,
                            title: item.course.title,
                            instructorName: item.course.instructor.fullName,
                            thumbnailUrl: item.course.thumbnailUrl ?? '',
                            price: item.course.price,
                            type: 'FULL_COURSE',
                          });
                          toast.success(t('addedToCart'));
                        },
                      },
                    );
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {t('addToCart')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromWishlist.mutate(item.courseId)}
                  disabled={removeFromWishlist.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
