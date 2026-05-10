'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatPrice } from '@shared/utils';

interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceDisplay({ price, originalPrice, size = 'sm', className }: PriceDisplayProps) {
  const t = useTranslations('course');
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const isFree = price === 0;

  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const originalSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span
        className={cn('font-bold', isFree ? 'text-success' : 'text-foreground', sizeClasses[size])}
      >
        {isFree ? t('free') : formatPrice(price)}
      </span>
      {!isFree && originalPrice && originalPrice > price && (
        <>
          <span className={cn('text-muted-foreground line-through', originalSizeClasses[size])}>
            {formatPrice(originalPrice)}
          </span>
          <span className={cn('text-success font-semibold', originalSizeClasses[size])}>
            -{discount}%
          </span>
        </>
      )}
    </div>
  );
}
