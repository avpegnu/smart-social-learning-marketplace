'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
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

interface PurchaseCardProps {
  thumbnailUrl: string | null;
  title: string;
  price: number;
  originalPrice?: number;
  totalDuration: number;
  totalLessons: number;
  ctaButton: ReactNode;
}

export function PurchaseCard({
  thumbnailUrl,
  title,
  price,
  originalPrice,
  totalDuration,
  totalLessons,
  ctaButton,
}: PurchaseCardProps) {
  const t = useTranslations('courseDetail');

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
          <button className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm">
            <Heart className="h-4 w-4" />
            {t('wishlist')}
          </button>
          <button className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm">
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
