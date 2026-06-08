'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { useMyLearning } from '@shared/hooks';
import { AiTutorWidget } from './ai-tutor-widget';

interface AiTutorLauncherProps {
  courseId: string;
  courseSlug: string;
}

/**
 * Floating launcher for the inline AI Tutor on the learning screen. Toggles the
 * chat widget and resolves whether the viewer is enrolled (non-enrolled
 * preview viewers get an "enroll" prompt instead of the chat).
 */
export function AiTutorLauncher({ courseId, courseSlug }: AiTutorLauncherProps) {
  const t = useTranslations('aiTutor');
  const [open, setOpen] = useState(false);

  const { data: myLearningRaw } = useMyLearning();
  const enrolled = (
    (myLearningRaw as { data?: Array<{ course: { id: string } }> } | undefined)?.data ?? []
  ).some((e) => e.course.id === courseId);

  if (open) {
    return (
      <AiTutorWidget
        courseId={courseId}
        courseSlug={courseSlug}
        isEnrolled={enrolled}
        onClose={() => setOpen(false)}
      />
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      aria-label={t('launcherLabel')}
      title={t('launcherLabel')}
      className="bg-primary text-primary-foreground fixed right-4 bottom-20 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 lg:bottom-6"
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
