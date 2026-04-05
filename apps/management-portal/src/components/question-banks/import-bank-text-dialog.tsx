'use client';

import { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button, Label, Select, Badge, cn } from '@shared/ui';
import type { SelectOption } from '@shared/ui';
import { parseQuizText } from '@/lib/validations/course';
import type { BankQuestionPayload } from '@shared/hooks';

interface BankTag {
  id: string;
  name: string;
}

interface ImportBankTextDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (questions: BankQuestionPayload[]) => void;
  bankTags: BankTag[];
}

const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

const DIFFICULTY_VARIANT: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  BEGINNER: 'secondary',
  INTERMEDIATE: 'default',
  ADVANCED: 'destructive',
};

const EXAMPLE_TEXT = `1. What is React?
a) A library *
b) A framework
c) A language

2. JSX stands for?
a) Java XML
b) JavaScript XML *
c) JSON XML`;

export function ImportBankTextDialog({
  open,
  onClose,
  onImport,
  bankTags,
}: ImportBankTextDialogProps) {
  const t = useTranslations('questionBanks');
  const tWizard = useTranslations('courseWizard');

  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState(0);

  // Step 2: difficulty + tags
  const [importDifficulty, setImportDifficulty] = useState<string>('');
  const [importTagIds, setImportTagIds] = useState<string[]>([]);

  const levelOptions: SelectOption[] = DIFFICULTY_LEVELS.map((l) => ({
    value: l,
    label: t(`difficulty_${l.toLowerCase()}` as 'difficulty_beginner'),
  }));

  useEffect(() => {
    if (open) {
      setStep(1);
      setText('');
      setError(null);
      setParsedCount(0);
      setImportDifficulty('');
      setImportTagIds([]);
    }
  }, [open]);

  const handleNext = () => {
    setError(null);
    const parsed = parseQuizText(text);
    if (parsed.length === 0) {
      setError(tWizard('parseError'));
      return;
    }
    setParsedCount(parsed.length);
    setStep(2);
  };

  const toggleTag = (tagId: string) => {
    setImportTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleImport = () => {
    const parsed = parseQuizText(text);
    const mapped: BankQuestionPayload[] = parsed.map((q) => ({
      question: q.question,
      explanation: q.explanation ?? undefined,
      difficulty: importDifficulty || undefined,
      tagIds: importTagIds.length > 0 ? importTagIds : undefined,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    }));
    onImport(mapped);
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
          'mx-4 max-h-[80vh] overflow-y-auto',
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

        {/* Step 1: Paste text */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{t('importTextDesc')}</p>

            <div className="bg-muted rounded-md p-3">
              <pre className="text-muted-foreground text-xs whitespace-pre-wrap">
                {EXAMPLE_TEXT}
              </pre>
            </div>

            <div className="space-y-1">
              <Label>{t('importPasteText')}</Label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                placeholder={t('importTextPlaceholder')}
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                {tWizard('cancel')}
              </Button>
              <Button type="button" onClick={handleNext} disabled={!text.trim()}>
                {t('importNext')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Assign difficulty + tags */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t('importAssignMeta', { count: parsedCount })}
            </p>

            {/* Difficulty */}
            <div className="space-y-1">
              <Label>{t('difficulty')}</Label>
              <Select
                options={levelOptions}
                value={importDifficulty}
                onChange={(e) => setImportDifficulty(e.target.value)}
                placeholder={t('selectDifficulty')}
              />
              {importDifficulty && (
                <Badge variant={DIFFICULTY_VARIANT[importDifficulty]} className="mt-1">
                  {t(`difficulty_${importDifficulty.toLowerCase()}` as 'difficulty_beginner')}
                </Badge>
              )}
            </div>

            {/* Tags */}
            {bankTags.length > 0 && (
              <div className="space-y-1">
                <Label>{t('questionTags')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {bankTags.map((tag) => {
                    const isSelected = importTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                {t('importBack')}
              </Button>
              <Button type="button" onClick={handleImport}>
                {t('importSubmit', { count: parsedCount })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
