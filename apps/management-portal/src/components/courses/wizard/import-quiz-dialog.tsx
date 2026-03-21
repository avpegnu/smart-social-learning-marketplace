'use client';

import { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button, Label, cn } from '@shared/ui';
import { parseQuizText } from '@/lib/validations/course';
import type { ParsedQuizQuestion } from '@/lib/validations/course';

const EXAMPLE_TEXT = `1. What is React?
a) A library *
b) A framework
c) A language
Explanation: React is a JavaScript library for building UIs.

2. JSX stands for?
a) Java XML
b) JavaScript XML *
c) JSON XML`;

interface ImportQuizDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (questions: ParsedQuizQuestion[]) => void;
}

export function ImportQuizDialog({ open, onClose, onImport }: ImportQuizDialogProps) {
  const t = useTranslations('courseWizard');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
    }
  }, [open]);

  const handleImport = () => {
    setError(null);
    const parsed = parseQuizText(text);
    if (parsed.length === 0) {
      setError(t('parseError'));
      return;
    }
    onImport(parsed);
    setText('');
  };

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg',
          'border-border bg-background rounded-xl border p-6 shadow-lg',
          'mx-4',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-4 text-lg font-semibold">{t('importFromText')}</h2>

        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{t('importQuizDesc')}</p>

          <div className="bg-muted rounded-md p-3">
            <pre className="text-muted-foreground text-xs whitespace-pre-wrap">{EXAMPLE_TEXT}</pre>
          </div>

          <div className="space-y-1">
            <Label>{t('pasteQuizText')}</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              placeholder={t('importQuizPlaceholder')}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={handleImport} disabled={!text.trim()}>
            {t('import')}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
