'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Image as ImageIcon } from 'lucide-react';
import { cn, Button, Progress } from '@shared/ui';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
}

export function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
  const t = useTranslations('courseWizard');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError(t('invalidImageType'));
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError(t('fileTooLarge'));
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        const result = await uploadToCloudinary(file, 'image', setProgress);
        onChange(result.secure_url);
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
      <div className="relative w-full max-w-md">
        <div className="border-border aspect-video overflow-hidden rounded-lg border">
          <img src={value} alt="Thumbnail" className="h-full w-full object-cover" />
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {t('changeThumbnail')}
          </Button>
          {onRemove && (
            <Button type="button" variant="outline" size="sm" onClick={onRemove}>
              <X className="mr-1 h-3 w-3" />
              {t('remove')}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
            <p className="text-muted-foreground text-sm">{t('uploading')}...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-muted-foreground text-xs">{progress}%</p>
          </div>
        ) : (
          <>
            <ImageIcon className="text-muted-foreground mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('dropOrClick')}</p>
            <p className="text-muted-foreground text-xs">PNG, JPG, WebP (max 25MB)</p>
          </>
        )}
      </div>
      {error && <p className="text-destructive mt-1 text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
