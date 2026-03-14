'use client';

import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/mock-data';

interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceDisplay({ price, originalPrice, size = 'sm', className }: PriceDisplayProps) {
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

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
      <span className={cn('text-foreground font-bold', sizeClasses[size])}>
        {formatPrice(price)}
      </span>
      {originalPrice && originalPrice > price && (
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
