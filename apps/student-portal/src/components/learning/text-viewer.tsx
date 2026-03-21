'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Button, Badge } from '@shared/ui';
import { useCompleteLesson } from '@shared/hooks';

interface TextViewerProps {
  lessonId: string;
  textContent: string;
  isCompleted: boolean;
}

export function TextViewer({ lessonId, textContent, isCompleted }: TextViewerProps) {
  const t = useTranslations('learning');
  const completeMutation = useCompleteLesson();

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Completion status */}
      {isCompleted && (
        <Badge variant="default" className="mb-4 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t('completed')}
        </Badge>
      )}

      {/* Content */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: textContent }}
      />

      {/* Mark Complete button */}
      {!isCompleted && (
        <div className="mt-8 flex justify-center">
          <Button
            onClick={() => completeMutation.mutate(lessonId)}
            disabled={completeMutation.isPending}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {completeMutation.isPending ? t('completing') : t('markComplete')}
          </Button>
        </div>
      )}
    </div>
  );
}
