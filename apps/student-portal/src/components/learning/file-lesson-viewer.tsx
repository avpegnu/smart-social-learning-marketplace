'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Button, Badge, FileViewer } from '@shared/ui';
import type { FileViewerLabels } from '@shared/ui';
import { useCompleteLesson } from '@shared/hooks';

interface FileLessonViewerProps {
  lessonId: string;
  fileUrl: string;
  fileMimeType: string;
  fileName: string;
  isCompleted: boolean;
}

export function FileLessonViewer({
  lessonId,
  fileUrl,
  fileMimeType,
  fileName,
  isCompleted,
}: FileLessonViewerProps) {
  const t = useTranslations('learning');
  const completeMutation = useCompleteLesson();

  const labels: FileViewerLabels = {
    download: t('download'),
    openInNewTab: t('openInNewTab'),
    unsupportedFile: t('unsupportedFile'),
    loadingViewer: t('loadingViewer'),
  };

  return (
    <div className="flex h-full flex-col">
      {/* Completion badge */}
      {isCompleted && (
        <div className="shrink-0 px-4 pt-3">
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('completed')}
          </Badge>
        </div>
      )}

      {/* File viewer — occupies remaining space */}
      <div className="min-h-0 flex-1">
        <FileViewer
          url={fileUrl}
          mimeType={fileMimeType}
          fileName={fileName}
          labels={labels}
          mode="inline"
          className="h-full"
        />
      </div>

      {/* Mark complete */}
      {!isCompleted && (
        <div className="border-border flex shrink-0 justify-end border-t px-4 py-3">
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
