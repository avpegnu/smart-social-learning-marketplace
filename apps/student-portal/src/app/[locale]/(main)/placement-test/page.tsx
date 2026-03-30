'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStartPlacement, useSubmitPlacement, useAuthStore } from '@shared/hooks';
import type { PlacementQuestion, PlacementAnswer, PlacementResult } from '@shared/hooks';
import { CategorySelect } from '@/components/placement/category-select';
import { QuizTaking } from '@/components/placement/quiz-taking';
import { TestResult } from '@/components/placement/test-result';

type Step = 'select' | 'taking' | 'result';

export default function PlacementTestPage() {
  const [step, setStep] = useState<Step>('select');
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const startMutation = useStartPlacement();
  const submitMutation = useSubmitPlacement();

  const questionsByLevel = useMemo(() => {
    const counts: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };
    for (const q of questions) {
      counts[q.level] = (counts[q.level] ?? 0) + 1;
    }
    return counts;
  }, [questions]);

  const handleStart = (categoryId?: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/placement-test');
      return;
    }

    startMutation.mutate(categoryId, {
      onSuccess: (data) => {
        const response = data.data as { questions: PlacementQuestion[]; totalQuestions: number };
        setQuestions(response.questions);
        setStep('taking');
      },
    });
  };

  const handleSubmit = (answers: PlacementAnswer[]) => {
    submitMutation.mutate(answers, {
      onSuccess: (data) => {
        setResult(data.data as PlacementResult);
        setStep('result');
      },
    });
  };

  const handleRetake = () => {
    setQuestions([]);
    setResult(null);
    setStep('select');
  };

  const handleQuit = () => {
    setStep('select');
  };

  if (step === 'taking' && questions.length > 0) {
    return (
      <QuizTaking
        questions={questions}
        onSubmit={handleSubmit}
        onQuit={handleQuit}
        isPending={submitMutation.isPending}
      />
    );
  }

  if (step === 'result' && result) {
    return (
      <TestResult result={result} questionsByLevel={questionsByLevel} onRetake={handleRetake} />
    );
  }

  return <CategorySelect onStart={handleStart} isPending={startMutation.isPending} />;
}
