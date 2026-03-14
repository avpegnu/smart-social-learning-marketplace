'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

// === Composable API (Avatar + AvatarImage + AvatarFallback) ===

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  ),
);
Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, alt, ...props }, ref) => (
    <img
      ref={ref}
      className={cn('aspect-square h-full w-full object-cover', className)}
      alt={alt}
      {...props}
    />
  ),
);
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-full text-sm font-medium',
        className,
      )}
      {...props}
    />
  ),
);
AvatarFallback.displayName = 'AvatarFallback';

// === Simple API (AvatarSimple) — single component with src/alt/fallback/size ===

interface AvatarSimpleProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

const avatarSizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

function AvatarSimple({ className, src, alt, fallback, size = 'md', ...props }: AvatarSimpleProps) {
  const initials =
    fallback ||
    (alt
      ? alt
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : '??');

  return (
    <div
      className={cn(
        'bg-muted relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        avatarSizeClasses[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt || ''} className="aspect-square h-full w-full object-cover" />
      ) : (
        <span className="text-muted-foreground font-medium">{initials}</span>
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarSimple };
