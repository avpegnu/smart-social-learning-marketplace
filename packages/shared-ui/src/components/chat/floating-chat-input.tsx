'use client';

import { type ChangeEvent, type KeyboardEvent, useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../button';

interface FloatingChatInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}

export function FloatingChatInput({
  onSend,
  onTyping,
  onStopTyping,
  disabled,
}: FloatingChatInputProps) {
  const t = useTranslations('chat');
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const resetTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const stopTypingNow = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onStopTyping();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [onStopTyping]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    resetTextareaHeight();
    stopTypingNow();
  }, [value, disabled, onSend, resetTextareaHeight, stopTypingNow]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);

      const ta = e.target;
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping();
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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

  const isEmpty = value.trim().length === 0;

  return (
    <div className="border-border flex items-end gap-1.5 border-t p-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('messagePlaceholder')}
        disabled={disabled}
        rows={1}
        className={cn(
          'placeholder:text-muted-foreground focus-visible:ring-ring bg-muted/60',
          'flex-1 resize-none rounded-2xl border-0 px-3 py-1.5 text-sm',
          'focus-visible:ring-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'max-h-[96px]',
        )}
      />
      <Button
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleSend}
        disabled={isEmpty || disabled}
        aria-label={t('send')}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
