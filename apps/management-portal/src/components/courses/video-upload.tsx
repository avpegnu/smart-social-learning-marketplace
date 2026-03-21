'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Video } from 'lucide-react';
import { cn, Button, Progress } from '@shared/ui';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface VideoUploadResult {
  url: string;
  duration: number;
}

interface VideoUploadProps {
  value?: VideoUploadResult;
  onChange: (result: VideoUploadResult) => void;
  onRemove?: () => void;
}

export function VideoUpload({ value, onChange, onRemove }: VideoUploadProps) {
  const t = useTranslations('courseWizard');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        setError(t('invalidVideoType'));
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        setError(t('videoTooLarge'));
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        const result = await uploadToCloudinary(file, 'video', setProgress);
        onChange({
          url: result.secure_url,
          duration: Math.round(result.duration ?? 0),
        });
      } catch {
        setError(t('uploadFailed'));
      } finally {
        setUploading(false);
      }
    },
    [onChange, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (value) {
    return (
      <div className="w-full max-w-md space-y-2">
        <div className="border-border aspect-video overflow-hidden rounded-lg border bg-black">
          <video src={value.url} controls className="h-full w-full object-contain" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t('duration')}: {Math.floor(value.duration / 60)}:
            {String(value.duration % 60).padStart(2, '0')}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              {t('changeVideo')}
            </Button>
            {onRemove && (
              <Button type="button" variant="outline" size="sm" onClick={onRemove}>
                <X className="mr-1 h-3 w-3" />
                {t('remove')}
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'border-border hover:border-primary flex aspect-video w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        {uploading ? (
          <div className="w-3/4 space-y-2 text-center">
            <p className="text-muted-foreground text-sm">{t('uploadingVideo')}...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-muted-foreground text-xs">{progress}%</p>
          </div>
        ) : (
          <>
            <Video className="text-muted-foreground mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('dropOrClickVideo')}</p>
            <p className="text-muted-foreground text-xs">MP4, WebM, MOV (max 500MB)</p>
          </>
        )}
      </div>
      {error && <p className="text-destructive mt-1 text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
