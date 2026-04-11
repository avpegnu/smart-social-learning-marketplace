'use client';

import { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { Video, FileText, HelpCircle, File, X } from 'lucide-react';
import { Button, Input, Label, cn, FileViewer } from '@shared/ui';
import type { FileViewerLabels } from '@shared/ui';
import { toast } from 'sonner';

import type { LocalLesson, LocalQuizData } from './course-wizard';
import { RichTextEditor } from '../rich-text-editor';
import { VideoUpload } from '../video-upload';
import { FileUpload } from '../file-upload';
import type { FileUploadResult } from '../file-upload';
import { QuizBuilder } from './quiz-builder';

let tempIdCounter = 0;
function generateTempId(): string {
  return `temp-${Date.now()}-${++tempIdCounter}`;
}

function FilePreviewModal({
  fileUrl,
  mimeType,
  fileName,
  onClose,
  labels,
}: {
  fileUrl: string;
  mimeType: string;
  fileName: string;
  onClose: () => void;
  labels: FileViewerLabels;
}) {
  return (
    <FileViewer
      url={fileUrl}
      mimeType={mimeType}
      fileName={fileName}
      mode="modal"
      onClose={onClose}
      labels={labels}
    />
  );
}

interface LessonDialogProps {
  open: boolean;
  lesson?: LocalLesson;
  onSave: (lesson: LocalLesson) => void;
  onClose: () => void;
}

type LessonType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'FILE';

const TYPE_TABS: Array<{ type: LessonType; icon: typeof Video; label: string }> = [
  { type: 'VIDEO', icon: Video, label: 'video' },
  { type: 'TEXT', icon: FileText, label: 'text' },
  { type: 'FILE', icon: File, label: 'file' },
  { type: 'QUIZ', icon: HelpCircle, label: 'quiz' },
];

export function LessonDialog({ open, lesson, onSave, onClose }: LessonDialogProps) {
  const t = useTranslations('courseWizard');
  const isEditing = !!lesson;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonType>('VIDEO');
  const [textContent, setTextContent] = useState('');
  const [videoData, setVideoData] = useState<{ url: string; duration: number } | undefined>();
  const [fileData, setFileData] = useState<FileUploadResult | undefined>();
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [quizData, setQuizData] = useState<LocalQuizData | undefined>();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (lesson) {
        setTitle(lesson.title);
        setType(lesson.type);
        setTextContent(lesson.textContent ?? '');
        setQuizData(lesson.quizData);
        if (lesson.videoUrl && lesson.estimatedDuration) {
          setVideoData({ url: lesson.videoUrl, duration: lesson.estimatedDuration });
        } else {
          setVideoData(undefined);
        }
        if (lesson.fileUrl) {
          setFileData({
            url: lesson.fileUrl,
            mimeType: lesson.fileMimeType ?? 'application/octet-stream',
            fileName: lesson.title,
            size: 0,
          });
        } else {
          setFileData(undefined);
        }
      } else {
        setTitle('');
        setType('VIDEO');
        setTextContent('');
        setVideoData(undefined);
        setFileData(undefined);
        setQuizData(undefined);
      }
      setFilePreviewOpen(false);
    }
  }, [open, lesson]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error(t('lessonTitleRequired'));
      return;
    }

    const savedLesson: LocalLesson = {
      ...(lesson ?? {}),
      tempId: lesson?.tempId ?? generateTempId(),
      id: lesson?.id,
      title: title.trim(),
      type,
      textContent: type === 'TEXT' ? textContent : undefined,
      estimatedDuration: type === 'VIDEO' ? videoData?.duration : undefined,
      videoUrl: type === 'VIDEO' ? videoData?.url : undefined,
      fileUrl: type === 'FILE' ? fileData?.url : undefined,
      fileMimeType: type === 'FILE' ? fileData?.mimeType : undefined,
      quizData: type === 'QUIZ' ? quizData : undefined,
      isNew: lesson ? lesson.isNew : true,
      isModified: lesson && !lesson.isNew ? true : undefined,
    };

    onSave(savedLesson);
  };

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog panel */}
      <div
        className={cn(
          'relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto',
          'border-border bg-background rounded-xl border p-6 shadow-lg',
          'mx-4',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <h2 className="mb-4 text-lg font-semibold">
          {isEditing ? t('editLesson') : t('addLesson')}
        </h2>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>{t('title')} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('lessonTitlePlaceholder')}
            />
          </div>

          {/* Type Selector (only for new lessons) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>{t('lessonType')}</Label>
              <div className="flex gap-2">
                {TYPE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => setType(tab.type)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors',
                        type === tab.type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(tab.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Type-specific content */}
          {type === 'VIDEO' && (
            <div className="space-y-2">
              <Label>{t('uploadVideo')}</Label>
              <VideoUpload
                value={videoData}
                onChange={setVideoData}
                onRemove={() => setVideoData(undefined)}
              />
            </div>
          )}

          {type === 'TEXT' && (
            <div className="space-y-2">
              <Label>{t('textContent')}</Label>
              <RichTextEditor
                value={textContent}
                onChange={setTextContent}
                placeholder={t('textContentPlaceholder')}
                minHeight="300px"
              />
            </div>
          )}

          {type === 'FILE' && (
            <div className="space-y-3">
              <Label>{t('uploadFile')}</Label>
              <FileUpload
                value={fileData}
                onChange={setFileData}
                onRemove={() => setFileData(undefined)}
              />
              {fileData && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilePreviewOpen(true)}
                  >
                    {t('previewFile')}
                  </Button>
                  {filePreviewOpen && (
                    <FilePreviewModal
                      fileUrl={fileData.url}
                      mimeType={fileData.mimeType}
                      fileName={fileData.fileName}
                      onClose={() => setFilePreviewOpen(false)}
                      labels={
                        {
                          download: t('download'),
                          openInNewTab: t('openInNewTab'),
                          unsupportedFile: t('unsupportedFile'),
                          loadingViewer: t('loadingViewer'),
                          close: t('close'),
                        } satisfies FileViewerLabels
                      }
                    />
                  )}
                </>
              )}
            </div>
          )}

          {type === 'QUIZ' && <QuizBuilder initialData={quizData} onChange={setQuizData} />}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={handleSave}>
            {isEditing ? t('save') : t('addLesson')}
          </Button>
        </div>
      </div>
    </div>
  );

  // Render directly into document.body via portal
  return ReactDOM.createPortal(content, document.body);
}
