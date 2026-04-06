'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Play,
  Heart,
  Share2,
  Monitor,
  FileText,
  Award,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Card, CardContent, Separator } from '@shared/ui';
import { PriceDisplay } from '@/components/course/price-display';
import { formatDuration } from '@shared/utils';
import { useAuthStore, useWishlist, useAddToWishlist, useRemoveFromWishlist } from '@shared/hooks';
import { useRouter, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface WishlistItemShape {
  courseId: string;
}

interface PurchaseCardProps {
  courseId: string;
  thumbnailUrl: string | null;
  title: string;
  price: number;
  originalPrice?: number;
  totalDuration: number;
  totalLessons: number;
  ctaButton: ReactNode;
}

export function PurchaseCard({
  courseId,
  thumbnailUrl,
  title,
  price,
  originalPrice,
  totalDuration,
  totalLessons,
  ctaButton,
}: PurchaseCardProps) {
  const t = useTranslations('courseDetail');
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: wishlistData } = useWishlist();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const wishlistItems = (wishlistData?.data as WishlistItemShape[] | undefined) ?? [];
  const isInWishlist = wishlistItems.some((item) => item.courseId === courseId);
  const isWishlistPending = addToWishlist.isPending || removeFromWishlist.isPending;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyFailed'));
    }
  };

  const handleWishlistToggle = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isWishlistPending) return;
    if (isInWishlist) {
      removeFromWishlist.mutate(courseId, {
        onSuccess: () => toast.success(t('removedFromWishlist')),
      });
    } else {
      addToWishlist.mutate(courseId, {
        onSuccess: () => toast.success(t('addedToWishlist')),
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="mb-4 aspect-video w-full rounded-lg object-cover"
          />
        ) : (
          <div className="from-primary/20 to-primary/5 mb-4 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br">
            <Play className="text-primary/50 h-12 w-12" />
          </div>
        )}

        <PriceDisplay price={price} originalPrice={originalPrice} size="lg" className="mb-4" />

        <div className="space-y-3">{ctaButton}</div>

        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleWishlistToggle}
            disabled={isWishlistPending}
            className={cn(
              'flex cursor-pointer items-center gap-1 text-sm transition-colors disabled:opacity-50',
              isInWishlist
                ? 'text-destructive hover:text-destructive/80'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Heart className={cn('h-4 w-4', isInWishlist && 'fill-current')} />
            {t('wishlist')}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm transition-colors"
          >
            <Share2 className="h-4 w-4" />
            {t('share')}
          </button>
        </div>

        <Separator className="my-4" />

        <h4 className="mb-3 text-sm font-semibold">{t('includes')}</h4>
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            {formatDuration(totalDuration)} video
          </li>
          <li className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {totalLessons} {t('lessons')}
          </li>
          <li className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            {t('certificate')}
          </li>
          <li className="flex items-center gap-2">
            <InfinityIcon className="h-4 w-4" />
            {t('lifetime')}
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
