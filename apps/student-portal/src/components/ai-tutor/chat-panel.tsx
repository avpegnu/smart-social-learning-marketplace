'use client';

import { type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Send, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { Button, Avatar, AvatarFallback } from '@shared/ui';
import type { ChatMsg } from '@shared/hooks';
import { AiTutorMessages } from './ai-tutor-messages';

interface ChatPanelProps {
  messages: ChatMsg[];
  streamingContent: string;
  isThinking: boolean;
  isStreaming: boolean;
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  usageCount: number;
  dailyLimit: number;
  userAvatar?: string | null;
  userName?: string;
  onShowSidebar: () => void;
}

export function ChatPanel({
  messages,
  streamingContent,
  isThinking,
  isStreaming,
  input,
  setInput,
  onSend,
  canSend,
  usageCount,
  dailyLimit,
  userAvatar,
  userName,
  onShowSidebar,
}: ChatPanelProps) {
  const t = useTranslations('aiTutor');

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <>
      {/* Header */}
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <button
          onClick={onShowSidebar}
          className="text-muted-foreground hover:text-foreground cursor-pointer sm:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/20 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            {t('poweredBy')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <AiTutorMessages
        messages={messages}
        streamingContent={streamingContent}
        isThinking={isThinking}
        isStreaming={isStreaming}
        userAvatar={userAvatar}
        userName={userName}
        emptyState={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="text-primary/30 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">{t('welcomeTitle')}</h3>
            <p className="text-muted-foreground max-w-md text-sm">{t('welcomeDesc')}</p>
          </div>
        }
      />

      {/* Usage banner */}
      {usageCount >= dailyLimit && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 text-center text-xs">
          {t('usageLimitReached')}
        </div>
      )}

      {/* Input */}
      <div className="border-border border-t p-4">
        <div className="flex items-end gap-2">
          <textarea
            placeholder={t('askPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring max-h-32 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <Button size="icon" className="h-10 w-10 shrink-0" disabled={!canSend} onClick={onSend}>
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-center text-[11px]">
          {t('usageRemaining', {
            count: Math.max(0, dailyLimit - usageCount),
            limit: dailyLimit,
          })}
        </p>
      </div>
    </>
  );
}
