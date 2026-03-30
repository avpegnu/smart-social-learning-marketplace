'use client';

import { useState, useEffect, useMemo } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { X, ArrowLeft, ArrowRight, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { Button, Label, Input, Select, cn } from '@shared/ui';
import { useQuestionBanks, useQuestionBankDetail } from '@shared/hooks';

interface ImportedQuestion {
  question: string;
  explanation: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

interface ImportFromBankDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (questions: ImportedQuestion[]) => void;
}

type ImportMode = 'manual' | 'random';

interface BankQuestion {
  id: string;
  question: string;
  explanation?: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function ImportFromBankDialog({ open, onClose, onImport }: ImportFromBankDialogProps) {
  const t = useTranslations('importFromBank');
  const tWizard = useTranslations('courseWizard');

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [mode, setMode] = useState<ImportMode>('manual');
  const [randomCount, setRandomCount] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [randomQuestions, setRandomQuestions] = useState<BankQuestion[]>([]);

  const { data: banksData, isLoading: banksLoading } = useQuestionBanks();
  const { data: bankDetail, isLoading: detailLoading } = useQuestionBankDetail(selectedBankId);

  const banks = useMemo(() => {
    if (!banksData) return [];
    const data = banksData as {
      data: Array<{ id: string; name: string; _count?: { questions: number } }>;
    };
    return data.data ?? [];
  }, [banksData]);

  const questions: BankQuestion[] = useMemo(() => {
    if (!bankDetail) return [];
    const detail = bankDetail as { data: { questions?: BankQuestion[] } };
    return detail.data?.questions ?? [];
  }, [bankDetail]);

  const selectedBank = banks.find((b) => b.id === selectedBankId);
  const questionCount = selectedBank?._count?.questions ?? questions.length;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedBankId('');
      setMode('manual');
      setRandomCount(10);
      setSelectedIds(new Set());
      setRandomQuestions([]);
    }
  }, [open]);

  // Clamp randomCount to available questions
  useEffect(() => {
    if (questionCount > 0 && randomCount > questionCount) {
      setRandomCount(questionCount);
    }
  }, [questionCount, randomCount]);

  const bankOptions = banks.map((b) => ({
    value: b.id,
    label: `${b.name} (${b._count?.questions ?? 0})`,
  }));

  const handleNext = () => {
    if (mode === 'random') {
      const count = Math.min(randomCount, questions.length);
      setRandomQuestions(shuffleAndPick(questions, count));
    }
    setStep(2);
  };

  const handleReRandom = () => {
    const count = Math.min(randomCount, questions.length);
    setRandomQuestions(shuffleAndPick(questions, count));
  };

  const toggleQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const mapToImportFormat = (qs: BankQuestion[]): ImportedQuestion[] =>
    qs.map((q) => ({
      question: q.question,
      explanation: q.explanation ?? '',
      options: q.options.map((o) => ({
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    }));

  const handleImport = () => {
    if (mode === 'manual') {
      const selected = questions.filter((q) => selectedIds.has(q.id));
      onImport(mapToImportFormat(selected));
    } else {
      onImport(mapToImportFormat(randomQuestions));
    }
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
          'relative z-10 w-full max-w-2xl',
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

        <h2 className="mb-4 text-lg font-semibold">{t('title')}</h2>

        {step === 1 && (
          <div className="space-y-4">
            {/* Bank selection */}
            <div className="space-y-2">
              <Label>{t('selectBank')}</Label>
              {banksLoading ? (
                <div className="text-muted-foreground text-sm">{t('loading')}</div>
              ) : banks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('noBanks')}</p>
              ) : (
                <Select
                  options={bankOptions}
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  placeholder={t('selectBank')}
                />
              )}
              {selectedBankId && questionCount > 0 && (
                <p className="text-muted-foreground text-sm">
                  {t('available', { count: questionCount })}
                </p>
              )}
              {selectedBankId && questionCount === 0 && !detailLoading && (
                <p className="text-muted-foreground text-sm">{t('noQuestions')}</p>
              )}
            </div>

            {/* Mode selection */}
            <div className="space-y-2">
              <Label>{t('mode')}</Label>
              <div className="space-y-2">
                <label className="border-border hover:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
                  <input
                    type="radio"
                    name="importMode"
                    value="manual"
                    checked={mode === 'manual'}
                    onChange={() => setMode('manual')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{t('manualPick')}</div>
                    <div className="text-muted-foreground text-xs">{t('manualPickDesc')}</div>
                  </div>
                </label>
                <label className="border-border hover:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
                  <input
                    type="radio"
                    name="importMode"
                    value="random"
                    checked={mode === 'random'}
                    onChange={() => setMode('random')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{t('random')}</div>
                    <div className="text-muted-foreground text-xs">{t('randomDesc')}</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Number of questions (random mode) */}
            {mode === 'random' && (
              <div className="space-y-1">
                <Label>{t('numberOfQuestions')}</Label>
                <Input
                  type="number"
                  value={randomCount}
                  onChange={(e) => setRandomCount(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={questionCount || 100}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {tWizard('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!selectedBankId || questionCount === 0 || detailLoading}
              >
                {t('next')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && mode === 'manual' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t('selected', { count: selectedIds.size })} / {questions.length}
            </p>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => toggleQuestion(q.id)}
                  className={cn(
                    'border-border hover:bg-accent w-full rounded-lg border p-3 text-left transition-colors',
                    selectedIds.has(q.id) && 'border-primary bg-primary/5',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {selectedIds.has(q.id) ? (
                      <CheckSquare className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Square className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Q{idx + 1}: {q.question}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {q.options.map((o, oIdx) => (
                          <span
                            key={o.id}
                            className={cn(
                              'text-xs',
                              o.isCorrect
                                ? 'font-medium text-green-600 dark:text-green-400'
                                : 'text-muted-foreground',
                            )}
                          >
                            {String.fromCharCode(65 + oIdx)}) {o.text}
                            {o.isCorrect && ' \u2713'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t('back')}
              </Button>
              <Button type="button" onClick={handleImport} disabled={selectedIds.size === 0}>
                {t('import', { count: selectedIds.size })}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && mode === 'random' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t('randomPreview', { count: randomQuestions.length })}
            </p>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {randomQuestions.map((q, idx) => (
                <div key={q.id} className="border-border rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {q.options.map((o, oIdx) => (
                      <span
                        key={o.id}
                        className={cn(
                          'text-xs',
                          o.isCorrect
                            ? 'font-medium text-green-600 dark:text-green-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        {String.fromCharCode(65 + oIdx)}) {o.text}
                        {o.isCorrect && ' \u2713'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t('back')}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleReRandom}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  {t('reRandom')}
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={randomQuestions.length === 0}
                >
                  {t('import', { count: randomQuestions.length })}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
