'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Trophy, RotateCcw, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress } from '@shared/ui';
import { useSubmitQuiz, useQuizAttempts } from '@shared/hooks';
import { cn } from '@/lib/utils';

// --- Types ---

interface QuizOption {
  id: string;
  text: string;
  order: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  type: string;
  order: number;
  options: QuizOption[];
}

interface Quiz {
  id: string;
  title: string;
  passingScore: number;
  maxAttempts: number;
  questions: QuizQuestion[];
}

// API response shape from POST /learning/lessons/:lessonId/quiz/submit
interface QuizResult {
  attempt: { id: string; score: number; passed: boolean };
  correctCount: number;
  totalQuestions: number;
  results: Array<{
    questionId: string;
    correct: boolean;
    correctAnswer: string | null;
    explanation: string | null;
  }>;
  lessonCompleted: boolean;
  courseProgress: number;
}

interface QuizPlayerProps {
  lessonId: string;
  quiz: Quiz;
  isCompleted: boolean;
}

type QuizState = 'READY' | 'TAKING' | 'SUBMITTED' | 'HISTORY';

// --- Quiz Info (READY state) ---

function QuizInfo({
  quiz,
  attemptCount,
  onStart,
  onViewHistory,
}: {
  quiz: Quiz;
  attemptCount: number;
  onStart: () => void;
  onViewHistory: () => void;
}) {
  const t = useTranslations('learning');
  const attemptsRemaining = quiz.maxAttempts > 0 ? quiz.maxAttempts - attemptCount : Infinity;

  return (
    <Card>
      <CardContent className="space-y-4 p-6 text-center">
        <Trophy className="text-warning mx-auto h-12 w-12" />
        <h3 className="text-lg font-semibold">{quiz.title}</h3>
        <div className="text-muted-foreground space-y-1 text-sm">
          <p>
            {quiz.questions.length} {t('questions')}
          </p>
          <p>
            {t('passingScore')}: {Math.round(quiz.passingScore * 100)}%
          </p>
          {quiz.maxAttempts > 0 && (
            <p>
              {t('attemptsRemaining')}: {attemptsRemaining}
            </p>
          )}
        </div>
        <div className="flex justify-center gap-3">
          <Button onClick={onStart} disabled={attemptsRemaining <= 0}>
            {t('startQuiz')}
          </Button>
          {attemptCount > 0 && (
            <Button variant="outline" onClick={onViewHistory}>
              {t('viewHistory')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Question Card (TAKING state) ---

function QuestionCard({
  question,
  index,
  total,
  selectedOptionId,
  onSelect,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}) {
  return (
    <Card className="mb-4">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <Badge variant="outline">
            {index + 1} / {total}
          </Badge>
        </div>
        <p className="mb-4 font-medium">{question.text}</p>
        <div className="space-y-2">
          {question.options
            .sort((a, b) => a.order - b.order)
            .map((option) => (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                  selectedOptionId === option.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50',
                )}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={selectedOptionId === option.id}
                  onChange={() => onSelect(option.id)}
                  className="border-input h-4 w-4"
                />
                <span className="text-sm">{option.text}</span>
              </label>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Results (SUBMITTED state) ---

function QuizResults({
  result,
  questions,
  onRetry,
  onContinue,
  canRetry,
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  onRetry: () => void;
  onContinue: () => void;
  canRetry: boolean;
}) {
  const t = useTranslations('learning');
  const { score, passed } = result.attempt;

  return (
    <div className="space-y-6">
      {/* Score card */}
      <Card>
        <CardContent className="p-6 text-center">
          {passed ? (
            <CheckCircle2 className="text-success mx-auto mb-3 h-12 w-12" />
          ) : (
            <XCircle className="text-destructive mx-auto mb-3 h-12 w-12" />
          )}
          <h3 className="text-lg font-semibold">{passed ? t('quizPassed') : t('quizFailed')}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('score')}: {score}% ({result.correctCount}/{result.totalQuestions})
          </p>
          <Progress value={score} className="mx-auto mt-4 h-2 max-w-xs" />
          <div className="mt-6 flex justify-center gap-3">
            {canRetry && !passed && (
              <Button variant="outline" onClick={onRetry} className="gap-1">
                <RotateCcw className="h-4 w-4" />
                {t('retryQuiz')}
              </Button>
            )}
            <Button onClick={onContinue} className="gap-1">
              {t('continueLesson')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-question results */}
      <div className="space-y-3">
        {result.results.map((r, i) => (
          <Card
            key={r.questionId}
            className={r.correct ? 'border-success/30' : 'border-destructive/30'}
          >
            <CardContent className="p-4">
              <div className="mb-2 flex items-start gap-2">
                {r.correct ? (
                  <CheckCircle2 className="text-success mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <XCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                )}
                <p className="text-sm font-medium">
                  {i + 1}. {questions.find((q) => q.id === r.questionId)?.text ?? ''}
                </p>
              </div>
              {r.explanation && (
                <p className="text-muted-foreground ml-7 text-xs">{r.explanation}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Main QuizPlayer ---

export function QuizPlayer({ lessonId, quiz, isCompleted }: QuizPlayerProps) {
  const t = useTranslations('learning');
  const [state, setState] = useState<QuizState>(isCompleted ? 'READY' : 'READY');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const submitQuiz = useSubmitQuiz();
  const { data: attemptsData } = useQuizAttempts(lessonId);
  const attempts = (attemptsData?.data as unknown[]) ?? [];
  const attemptCount = attempts.length;
  const canRetry = quiz.maxAttempts === 0 || attemptCount < quiz.maxAttempts;

  const handleStart = () => {
    setAnswers({});
    setResult(null);
    setState('TAKING');
  };

  const handleSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = () => {
    const answerList = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));
    submitQuiz.mutate(
      { lessonId, answers: answerList },
      {
        onSuccess: (res) => {
          setResult(res.data as QuizResult);
          setState('SUBMITTED');
        },
      },
    );
  };

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  // READY
  if (state === 'READY') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        {isCompleted && (
          <Badge variant="default" className="mb-4 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('completed')}
          </Badge>
        )}
        <QuizInfo
          quiz={quiz}
          attemptCount={attemptCount}
          onStart={handleStart}
          onViewHistory={() => setState('HISTORY')}
        />
      </div>
    );
  }

  // TAKING
  if (state === 'TAKING') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{quiz.title}</h3>
          <Badge variant="outline">
            {Object.keys(answers).length}/{quiz.questions.length}
          </Badge>
        </div>

        {quiz.questions
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((question, i) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={i}
              total={quiz.questions.length}
              selectedOptionId={answers[question.id]}
              onSelect={(optionId) => handleSelect(question.id, optionId)}
            />
          ))}

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || submitQuiz.isPending}
            className="gap-1"
          >
            {submitQuiz.isPending ? t('submitting') : t('submitQuiz')}
          </Button>
        </div>
      </div>
    );
  }

  // SUBMITTED
  if (state === 'SUBMITTED' && result) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <QuizResults
          result={result}
          questions={quiz.questions}
          onRetry={handleStart}
          onContinue={() => setState('READY')}
          canRetry={canRetry}
        />
      </div>
    );
  }

  // HISTORY
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t('attemptHistory')}</h3>
        <Button variant="outline" size="sm" onClick={() => setState('READY')}>
          {t('back')}
        </Button>
      </div>
      {attempts.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noAttempts')}</p>
      ) : (
        <div className="space-y-3">
          {(
            attempts as Array<{ id: string; score: number; passed: boolean; createdAt: string }>
          ).map((attempt, i) => (
            <Card key={attempt.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">
                    {t('attempt')} #{attempts.length - i}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(attempt.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{Math.round(attempt.score * 100)}%</span>
                  <Badge variant={attempt.passed ? 'default' : 'destructive'}>
                    {attempt.passed ? t('passed') : t('failed')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
