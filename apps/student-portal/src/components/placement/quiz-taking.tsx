'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronLeft, ChevronRight, SendHorizontal, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress } from '@shared/ui';
import type { PlacementQuestion, PlacementAnswer } from '@shared/hooks';
import { cn } from '@/lib/utils';

interface QuizTakingProps {
  questions: PlacementQuestion[];
  onSubmit: (answers: PlacementAnswer[]) => void;
  onQuit: () => void;
  isPending: boolean;
}

const LEVEL_CONFIG = {
  BEGINNER: { variant: 'success' as const },
  INTERMEDIATE: { variant: 'warning' as const },
  ADVANCED: { variant: 'destructive' as const },
};

export function QuizTaking({ questions, onSubmit, onQuit, isPending }: QuizTakingProps) {
  const t = useTranslations('placementTest');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const allAnswered = answeredCount === totalQuestions;

  // Warn before leaving page during test
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  if (!currentQuestion) return null;

  const handleSelect = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const handleSubmit = () => {
    const answerPayload: PlacementAnswer[] = Object.entries(answers).map(
      ([questionId, selectedOptionId]) => ({ questionId, selectedOptionId }),
    );
    onSubmit(answerPayload);
  };

  const levelConfig = LEVEL_CONFIG[currentQuestion.level];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setShowQuitConfirm(true)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('quit')}
        </Button>
        <span className="text-muted-foreground text-sm">
          {t('questionOf', { current: currentIndex + 1, total: totalQuestions })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <Progress value={(answeredCount / totalQuestions) * 100} className="h-2" />
        <p className="text-muted-foreground mt-1 text-right text-xs">
          {answeredCount}/{totalQuestions}
        </p>
      </div>

      {/* Question card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">
              {t('question', { current: currentIndex + 1 })}
            </span>
            <Badge variant={levelConfig.variant}>
              {t(
                `level${currentQuestion.level.charAt(0)}${currentQuestion.level.slice(1).toLowerCase()}`,
              )}
            </Badge>
          </div>

          <p className="mb-6 text-lg font-medium">{currentQuestion.question}</p>

          <div className="space-y-2.5">
            {(currentQuestion.options as Array<{ id: string; text: string }>).map((option) => {
              const isSelected = currentAnswer === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                    )}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm">{option.text}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unanswered warning */}
      {isLastQuestion && !allAnswered && (
        <p className="text-warning mb-4 text-center text-sm">
          {t('unanswered', { count: totalQuestions - answeredCount })}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => i - 1)}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('previous')}
        </Button>

        {isLastQuestion ? (
          <Button onClick={handleSubmit} disabled={!allAnswered || isPending} className="gap-2">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
            {isPending ? t('submitting') : t('submit')}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={!currentAnswer}
            className="gap-1"
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quit confirm dialog */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowQuitConfirm(false)} />
          <div className="bg-background border-border relative z-10 mx-4 w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">{t('confirmQuit')}</h3>
            <p className="text-muted-foreground mb-4 text-sm">{t('confirmQuitDesc')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowQuitConfirm(false)}>
                {t('confirmQuitNo')}
              </Button>
              <Button variant="destructive" onClick={onQuit}>
                {t('confirmQuitYes')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
