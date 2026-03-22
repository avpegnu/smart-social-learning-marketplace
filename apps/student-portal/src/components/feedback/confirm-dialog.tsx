'use client';

import { useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@shared/ui';
import { Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
  variant?: 'destructive' | 'default';
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isLoading = false,
  variant = 'default',
  children,
}: ConfirmDialogProps) {
  const t = useTranslations('common');

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isLoading && onOpenChange(false)}
      />
      <div
        className="border-border bg-background relative z-10 mx-4 w-full max-w-md rounded-xl border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={() => !isLoading && onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 space-y-1.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
          {children}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('cancel')}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            className={variant === 'destructive' ? 'bg-red-600 text-white hover:bg-red-700' : ''}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel ?? t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
