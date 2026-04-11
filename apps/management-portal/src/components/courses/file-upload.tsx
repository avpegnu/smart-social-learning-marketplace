'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { File, X } from 'lucide-react';
import { cn, Button, Progress } from '@shared/ui';
import { uploadToCloudinary } from '@/lib/cloudinary';

const ACCEPTED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'text/plain',
  'text/markdown',
]);
const ACCEPTED_EXTENSIONS = '.docx,.doc,.txt,.md';
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export interface FileUploadResult {
  url: string;
  mimeType: string;
  fileName: string;
  size: number;
}

interface FileUploadProps {
  value?: FileUploadResult;
  onChange: (result: FileUploadResult) => void;
  onRemove?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ value, onChange, onRemove }: FileUploadProps) {
  const t = useTranslations('courseWizard');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        setError(t('invalidFileType'));
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(t('fileTooLarge', { max: MAX_SIZE_MB }));
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        // Use 'auto' so Cloudinary auto-detects type — avoids raw delivery restrictions on free tier
        const result = await uploadToCloudinary(file, 'auto', setProgress);
        onChange({
          url: result.secure_url,
          mimeType: file.type,
          fileName: file.name,
          size: file.size,
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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  if (value) {
    return (
      <div className="border-border w-full max-w-md rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 shrink-0 rounded-lg p-2">
            <File className="text-primary h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.fileName}</p>
            <p className="text-muted-foreground text-xs">{formatBytes(value.size)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              {t('changeFile')}
            </Button>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleInputChange}
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
          'border-border hover:border-primary flex w-full max-w-md cursor-pointer flex-col items-center',
          'justify-center rounded-lg border-2 border-dashed py-8 transition-colors',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        {uploading ? (
          <div className="w-3/4 space-y-2 text-center">
            <p className="text-muted-foreground text-sm">{t('uploadingFile')}...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-muted-foreground text-xs">{progress}%</p>
          </div>
        ) : (
          <>
            <File className="text-muted-foreground mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('dropOrClickFile')}</p>
            <p className="text-muted-foreground mt-1 text-xs">DOCX, TXT (max {MAX_SIZE_MB}MB)</p>
          </>
        )}
      </div>
      {error && <p className="text-destructive mt-1 text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
