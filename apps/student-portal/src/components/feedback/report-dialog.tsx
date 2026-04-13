'use client';

import { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2, X } from 'lucide-react';
import { Button, Label } from '@shared/ui';
import { useCreateReport } from '@shared/hooks';
import type { ReportTargetType } from '@shared/hooks';
import { toast } from 'sonner';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
}

const REASON_KEYS = [
  'spam',
  'inappropriate',
  'harassment',
  'misinformation',
  'copyright',
  'other',
] as const;

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const t = useTranslations('report');
  const tc = useTranslations('common');
  const createReport = useCreateReport();

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setReason('');
      setDescription('');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function handleSubmit() {
    if (!reason) return;

    createReport.mutate(
      { targetType, targetId, reason, description: description || undefined },
      {
        onSuccess: () => {
          toast.success(t('submitted'));
          onOpenChange(false);
        },
      },
    );
  }

  if (!open) return null;

  const typeLabel = t(`types.${targetType}`);

  const content = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !createReport.isPending && onOpenChange(false)}
      />
      <div
        className="border-border bg-background relative z-10 mx-4 w-full max-w-md rounded-xl border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={() => !createReport.isPending && onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 space-y-1.5">
          <h2 className="text-lg font-semibold">{t('title', { type: typeLabel })}</h2>
        </div>

        {/* Reason selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('selectReason')}</Label>
          <div className="space-y-2">
            {REASON_KEYS.map((key) => (
              <label
                key={key}
                className="border-border hover:bg-accent has-[:checked]:border-primary flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={t(`reasons.${key}`)}
                  checked={reason === t(`reasons.${key}`)}
                  onChange={(e) => setReason(e.target.value)}
                  className="accent-primary h-4 w-4"
                />
                <span className="text-sm">{t(`reasons.${key}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mt-4 space-y-2">
          <Label className="text-sm font-medium">{t('additionalDetails')}</Label>
          <textarea
            className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('detailsPlaceholder')}
            maxLength={1000}
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createReport.isPending}
          >
            {tc('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={createReport.isPending || !reason}>
            {createReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tc('submit')}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
