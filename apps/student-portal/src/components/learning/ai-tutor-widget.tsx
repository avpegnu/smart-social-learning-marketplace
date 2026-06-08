'use client';

import { useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bot, X, ArrowLeft, Plus, Send, Loader2, Zap, Lock, AlertTriangle } from 'lucide-react';
import { Button, Avatar, AvatarFallback } from '@shared/ui';
import { useAiSessions, useAuthStore, useAiTutorChat } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { useRouter } from '@/i18n/navigation';
import { AiTutorMessages } from '@/components/ai-tutor/ai-tutor-messages';

interface SessionItem {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

interface AiTutorWidgetProps {
  courseId: string;
  courseSlug: string;
  isEnrolled: boolean;
  onClose: () => void;
}

type View = 'list' | 'chat';

/**
 * Inline AI Tutor chat surfaced on the learning screen. Mirrors the fullscreen
 * `/ai-tutor` page (session list ↔ conversation) but scoped to the current
 * course and rendered as a floating panel.
 */
export function AiTutorWidget({ courseId, courseSlug, isEnrolled, onClose }: AiTutorWidgetProps) {
  const t = useTranslations('aiTutor');
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<View>('list');

  const chat = useAiTutorChat({ courseId });

  // Only fetch sessions for enrolled users — the endpoint is enrollment-gated.
  const { data: sessionsRaw } = useAiSessions(isEnrolled ? courseId : undefined);
  const sessions = ((sessionsRaw as { data?: SessionItem[] } | undefined)?.data ??
    (sessionsRaw as SessionItem[] | undefined)) as SessionItem[] | undefined;
  const sessionList = Array.isArray(sessions) ? sessions : [];

  function handleSelectSession(sessionId: string) {
    chat.selectSession(sessionId);
    setView('chat');
  }

  function handleNewSession() {
    chat.newSession();
    setView('chat');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chat.send();
    }
  }

  return (
    <div className="bg-card border-border fixed right-4 bottom-20 z-50 flex h-128 max-h-[calc(100vh-9rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border shadow-2xl lg:bottom-6">
      {/* Header */}
      <div className="border-border flex items-center gap-2 border-b px-3 py-2.5">
        {view === 'chat' && isEnrolled && (
          <button
            onClick={() => setView('list')}
            aria-label={t('back')}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-primary/20 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{t('title')}</h3>
          {isEnrolled && (
            <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Zap className="h-2.5 w-2.5" />
              {chat.usageCount}/{chat.dailyLimit}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {!isEnrolled ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <Lock className="text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-muted-foreground text-sm">{t('enrollPrompt')}</p>
          <Button size="sm" onClick={() => router.push(`/courses/${courseSlug}`)}>
            {t('enrollCta')}
          </Button>
        </div>
      ) : view === 'list' ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="p-3">
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleNewSession}>
              <Plus className="h-4 w-4" />
              {t('newSession')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessionList.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                {t('noSessions')}
              </p>
            ) : (
              sessionList.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className="hover:bg-accent/50 w-full cursor-pointer px-4 py-3 text-left transition-colors"
                >
                  <span className="line-clamp-1 text-sm font-medium">
                    {session.title ?? t('newSession')}
                  </span>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    <span>
                      {session._count.messages} {t('messageCount')}
                    </span>
                    <span>{formatRelativeTime(session.updatedAt, locale)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-border border-t p-2.5">
            <p className="text-muted-foreground flex items-start gap-1.5 text-[11px]">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {t('disclaimer')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <AiTutorMessages
            messages={chat.messages}
            streamingContent={chat.streamingContent}
            isThinking={chat.isThinking}
            isStreaming={chat.isStreaming}
            userAvatar={user?.avatarUrl}
            userName={user?.fullName}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="text-primary/30 mb-3 h-10 w-10" />
                <p className="text-muted-foreground max-w-56 text-sm">{t('widgetWelcome')}</p>
              </div>
            }
          />

          {chat.usageCount >= chat.dailyLimit && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 text-center text-xs">
              {t('usageLimitReached')}
            </div>
          )}

          <div className="border-border border-t p-3">
            <div className="flex items-end gap-2">
              <textarea
                placeholder={t('askPlaceholder')}
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring max-h-24 min-h-9 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!chat.canSend}
                onClick={chat.send}
              >
                {chat.isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
