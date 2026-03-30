'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, CheckCircle2, Circle, Upload, Database } from 'lucide-react';
import { Button, Input, Label } from '@shared/ui';

import { ImportQuizDialog } from './import-quiz-dialog';
import { ImportFromBankDialog } from './import-from-bank-dialog';
import type { ParsedQuizQuestion } from '@/lib/validations/course';
import type { LocalQuizData } from './course-wizard';

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  question: string;
  explanation: string;
  options: QuizOption[];
}

interface QuizBuilderProps {
  initialData?: LocalQuizData;
  onChange: (data: LocalQuizData) => void;
}

export function QuizBuilder({ initialData, onChange }: QuizBuilderProps) {
  const t = useTranslations('courseWizard');

  const [passingScore, setPassingScore] = useState(initialData?.passingScore ?? 70);
  const [maxAttempts, setMaxAttempts] = useState<number | undefined>(initialData?.maxAttempts ?? 3);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | undefined>(
    initialData?.timeLimitSeconds,
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialData?.questions ?? []);
  const [importOpen, setImportOpen] = useState(false);
  const [importBankOpen, setImportBankOpen] = useState(false);

  // Notify parent of changes
  const notifyChange = useCallback(
    (qs: QuizQuestion[], ps: number, ma?: number, tl?: number) => {
      onChange({
        passingScore: ps / 100,
        maxAttempts: ma,
        timeLimitSeconds: tl,
        questions: qs,
      });
    },
    [onChange],
  );

  // Init from existing data
  useEffect(() => {
    if (initialData) {
      setPassingScore(Math.round((initialData.passingScore ?? 0.7) * 100));
      setMaxAttempts(initialData.maxAttempts ?? 3);
      setTimeLimitSeconds(initialData.timeLimitSeconds);
      setQuestions(initialData.questions ?? []);
    }
  }, []); // Only on mount

  const addQuestion = () => {
    const newQs = [
      ...questions,
      {
        question: '',
        explanation: '',
        options: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
        ],
      },
    ];
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const removeQuestion = (qIndex: number) => {
    const newQs = questions.filter((_, i) => i !== qIndex);
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const updateQuestion = (qIndex: number, field: keyof QuizQuestion, value: string) => {
    const newQs = questions.map((q, i) => (i === qIndex ? { ...q, [field]: value } : q));
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const addOption = (qIndex: number) => {
    const newQs = questions.map((q, i) =>
      i === qIndex ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q,
    );
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const newQs = questions.map((q, i) =>
      i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q,
    );
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const updateOptionText = (qIndex: number, oIndex: number, text: string) => {
    const newQs = questions.map((q, i) =>
      i === qIndex
        ? {
            ...q,
            options: q.options.map((o, j) => (j === oIndex ? { ...o, text } : o)),
          }
        : q,
    );
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const setCorrectOption = (qIndex: number, oIndex: number) => {
    const newQs = questions.map((q, i) =>
      i === qIndex
        ? {
            ...q,
            options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })),
          }
        : q,
    );
    setQuestions(newQs);
    notifyChange(newQs, passingScore, maxAttempts, timeLimitSeconds);
  };

  const handleImport = (imported: ParsedQuizQuestion[]) => {
    const newQuestions: QuizQuestion[] = imported.map((q) => ({
      question: q.question,
      explanation: q.explanation ?? '',
      options: q.options.map((o) => ({
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    }));
    const merged = [...questions, ...newQuestions];
    setQuestions(merged);
    notifyChange(merged, passingScore, maxAttempts, timeLimitSeconds);
    setImportOpen(false);
  };

  const handlePassingScoreChange = (val: number) => {
    setPassingScore(val);
    notifyChange(questions, val, maxAttempts, timeLimitSeconds);
  };

  const handleMaxAttemptsChange = (val: number) => {
    setMaxAttempts(val);
    notifyChange(questions, passingScore, val, timeLimitSeconds);
  };

  const handleTimeLimitChange = (val: string) => {
    const parsed = val ? Number(val) : undefined;
    setTimeLimitSeconds(parsed);
    notifyChange(questions, passingScore, maxAttempts, parsed);
  };

  return (
    <div className="space-y-4">
      {/* Settings */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('passingScorePercent')}</Label>
          <Input
            type="number"
            value={passingScore}
            onChange={(e) => handlePassingScoreChange(Number(e.target.value))}
            min={0}
            max={100}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('maxAttempts')}</Label>
          <Input
            type="number"
            value={maxAttempts ?? ''}
            onChange={(e) => handleMaxAttemptsChange(Number(e.target.value))}
            min={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('timeLimitSeconds')}</Label>
          <Input
            type="number"
            value={timeLimitSeconds ?? ''}
            onChange={(e) => handleTimeLimitChange(e.target.value)}
            min={0}
            placeholder={t('noLimit')}
          />
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="border-border space-y-3 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground mt-2 text-sm font-medium">{qIdx + 1}.</span>
            <Input
              value={q.question}
              onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
              placeholder={t('questionPlaceholder')}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive h-8 w-8"
              onClick={() => removeQuestion(qIdx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Options */}
          <div className="space-y-2 pl-6">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectOption(qIdx, oIdx)}
                  className="shrink-0"
                >
                  {opt.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="text-muted-foreground h-5 w-5" />
                  )}
                </button>
                <Input
                  value={opt.text}
                  onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                  placeholder={`${t('option')} ${String.fromCharCode(65 + oIdx)}`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-7 w-7"
                  onClick={() => removeOption(qIdx, oIdx)}
                  disabled={q.options.length <= 2}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addOption(qIdx)}
              className="ml-7"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('addOption')}
            </Button>
          </div>

          {/* Explanation */}
          <div className="pl-6">
            <Input
              value={q.explanation}
              onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)}
              placeholder={t('explanationPlaceholder')}
            />
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('addQuestion')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-3.5 w-3.5" />
          {t('importFromText')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setImportBankOpen(true)}>
          <Database className="mr-1 h-3.5 w-3.5" />
          {t('importFromBank')}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">{t('quizSavedNote')}</p>

      <ImportQuizDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      <ImportFromBankDialog
        open={importBankOpen}
        onClose={() => setImportBankOpen(false)}
        onImport={(imported) => {
          const merged = [...questions, ...imported];
          setQuestions(merged);
          notifyChange(merged, passingScore, maxAttempts, timeLimitSeconds);
          setImportBankOpen(false);
        }}
      />
    </div>
  );
}
