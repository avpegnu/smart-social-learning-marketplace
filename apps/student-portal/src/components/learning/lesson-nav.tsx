'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@shared/ui';

interface LessonNavProps {
  prevLessonId: string | null;
  nextLessonId: string | null;
  onNavigate: (lessonId: string) => void;
}

export function LessonNav({ prevLessonId, nextLessonId, onNavigate }: LessonNavProps) {
  const t = useTranslations('learning');

  return (
    <div className="border-border flex items-center justify-between border-t px-6 py-4">
      <Button
        variant="outline"
        className="gap-2"
        disabled={!prevLessonId}
        onClick={() => prevLessonId && onNavigate(prevLessonId)}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('previousLesson')}
      </Button>
      <Button
        className="gap-2"
        disabled={!nextLessonId}
        onClick={() => nextLessonId && onNavigate(nextLessonId)}
      >
        {t('nextLesson')}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
