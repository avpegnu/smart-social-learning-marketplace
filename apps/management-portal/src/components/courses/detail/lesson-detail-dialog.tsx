'use client';

import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { X, Video, FileText, HelpCircle } from 'lucide-react';
import { Badge, Button } from '@shared/ui';

const LESSON_TYPE_ICONS = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: HelpCircle,
} as const;

interface LessonDetailDialogProps {
  lesson: Record<string, unknown> | null;
  onClose: () => void;
}

export function LessonDetailDialog({ lesson, onClose }: LessonDetailDialogProps) {
  const t = useTranslations('courseDetail');

  if (!lesson) return null;

  const type = lesson.type as string;
  const title = lesson.title as string;
  const textContent = lesson.textContent as string | undefined;
  const videoUrl = lesson.videoUrl as string | undefined;
  const duration = (lesson.estimatedDuration as number) ?? 0;
  const TypeIcon = LESSON_TYPE_ICONS[type as keyof typeof LESSON_TYPE_ICONS] ?? FileText;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog panel */}
      <div
        className="border-border bg-background relative z-10 mx-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <TypeIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="outline" className="capitalize">
            {type.toLowerCase()}
          </Badge>
          {duration > 0 && (
            <span className="text-muted-foreground text-sm">
              {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* Content by type */}
        {type === 'VIDEO' && (
          <div className="space-y-3">
            {videoUrl ? (
              <div className="overflow-hidden rounded-lg">
                <video src={videoUrl} controls className="w-full" style={{ maxHeight: '400px' }} />
              </div>
            ) : (
              <div className="border-border text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed">
                {t('noVideo')}
              </div>
            )}
          </div>
        )}

        {type === 'TEXT' && (
          <div className="space-y-3">
            {textContent ? (
              <div
                className="prose prose-sm dark:prose-invert border-border bg-card max-w-none rounded-md border p-4"
                dangerouslySetInnerHTML={{ __html: textContent }}
              />
            ) : (
              <div className="border-border text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed">
                {t('noContent')}
              </div>
            )}
          </div>
        )}

        {type === 'QUIZ' &&
          (() => {
            const quiz = lesson.quiz as Record<string, unknown> | undefined;
            const questions = (quiz?.questions as Array<Record<string, unknown>>) ?? [];

            if (!quiz || questions.length === 0) {
              return (
                <div className="border-border text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed">
                  {t('noQuizData')}
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* Quiz settings */}
                <div className="text-muted-foreground flex gap-4 text-xs">
                  <span>
                    {t('passingScore')}: {Math.round((quiz.passingScore as number) * 100)}%
                  </span>
                  {(quiz.maxAttempts as number) && (
                    <span>
                      {t('maxAttempts')}: {quiz.maxAttempts as number}
                    </span>
                  )}
                  {(quiz.timeLimitSeconds as number) && (
                    <span>
                      {t('timeLimit')}: {quiz.timeLimitSeconds as number}s
                    </span>
                  )}
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  {questions.map((q, qIdx) => {
                    const options = (q.options as Array<Record<string, unknown>>) ?? [];
                    return (
                      <div key={q.id as string} className="border-border rounded-lg border p-4">
                        <p className="mb-2 text-sm font-medium">
                          {qIdx + 1}. {q.question as string}
                        </p>
                        <div className="space-y-1.5 pl-4">
                          {options.map((opt) => (
                            <div
                              key={opt.id as string}
                              className={`flex items-center gap-2 text-sm ${(opt.isCorrect as boolean) ? 'font-medium text-green-600 dark:text-green-400' : ''}`}
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${(opt.isCorrect as boolean) ? 'border-green-500 bg-green-500/10' : 'border-border'}`}
                              >
                                {(opt.isCorrect as boolean) ? '✓' : ' '}
                              </span>
                              {opt.text as string}
                            </div>
                          ))}
                        </div>
                        {(q.explanation as string) && (
                          <p className="text-muted-foreground border-border mt-2 border-t pt-2 text-xs italic">
                            {t('explanation')}: {q.explanation as string}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(content, document.body);
}
