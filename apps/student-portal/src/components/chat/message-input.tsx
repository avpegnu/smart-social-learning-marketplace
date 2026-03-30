'use client';

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Send, ImagePlus, X, Loader2 } from 'lucide-react';
import { Button } from '@shared/ui';
import { cn } from '@/lib/utils';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface MessageInputProps {
  onSend: (content: string) => void;
  onSendImage: (imageUrl: string, fileName: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onSendImage,
  onTyping,
  onStopTyping,
  disabled,
}: MessageInputProps) {
  const t = useTranslations('chat');
  const [value, setValue] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const resetTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const handleSend = useCallback(async () => {
    // Send image if selected
    if (imageFile) {
      setUploading(true);
      try {
        const result = await uploadToCloudinary(imageFile, 'image');
        onSendImage(result.secure_url, result.original_filename);
        setImagePreview(null);
        setImageFile(null);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Send text
    const trimmed = value.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setValue('');
    resetTextareaHeight();

    if (isTypingRef.current) {
      isTypingRef.current = false;
      onStopTyping();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [value, imageFile, onSend, onSendImage, onStopTyping, resetTextareaHeight]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);

      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping();
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onStopTyping();
        typingTimeoutRef.current = null;
      }, 2000);
    },
    [onTyping, onStopTyping],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleImageSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    // Reset file input
    e.target.value = '';
  }, []);

  const clearImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
  }, [imagePreview]);

  const isEmpty = value.trim().length === 0 && !imageFile;

  return (
    <div className="border-border border-t p-3">
      {/* Image preview */}
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-h-32 rounded-lg border object-contain"
          />
          <button
            type="button"
            onClick={clearImage}
            className="bg-background/80 absolute -top-1.5 -right-1.5 rounded-full p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Image attach button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <ImagePlus className="text-muted-foreground h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('messagePlaceholder')}
          disabled={disabled || uploading || !!imageFile}
          rows={1}
          className={cn(
            'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring',
            'flex-1 resize-none rounded-lg border px-3 py-2 text-sm',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'max-h-[120px]',
          )}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={isEmpty || disabled || uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="sr-only">{t('send')}</span>
        </Button>
      </div>
    </div>
  );
}
