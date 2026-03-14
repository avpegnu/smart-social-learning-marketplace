'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'bg-background/80 fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm',
        className,
      )}
    >
      <Loader2 className="text-primary h-10 w-10 animate-spin" />
      {message && <p className="text-muted-foreground mt-4 text-sm">{message}</p>}
    </div>
  );
}
