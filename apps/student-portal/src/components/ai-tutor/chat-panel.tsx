'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Send, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { Button, Avatar, AvatarFallback } from '@shared/ui';
import { aiTutorService } from '@shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChatMessage } from './chat-message';
import { StreamingIndicator } from './streaming-indicator';
import { MarkdownRenderer } from './markdown-renderer';

interface ChatMsg {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
}

interface ChatPanelProps {
  messages: ChatMsg[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  selectedCourseId: string;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  input: string;
  setInput: (value: string) => void;
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;
  streamingContent: string;
  setStreamingContent: (value: string) => void;
  isThinking: boolean;
  setIsThinking: (value: boolean) => void;
  usageCount: number;
  dailyLimit: number;
  userAvatar?: string | null;
  userName?: string;
  onShowSidebar: () => void;
}

export function ChatPanel({
  messages,
  setMessages,
  selectedCourseId,
  activeSessionId,
  setActiveSessionId,
  input,
  setInput,
  isStreaming,
  setIsStreaming,
  streamingContent,
  setStreamingContent,
  isThinking,
  setIsThinking,
  usageCount,
  dailyLimit,
  userAvatar,
  userName,
  onShowSidebar,
}: ChatPanelProps) {
  const t = useTranslations('aiTutor');
  const queryClient = useQueryClient();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);

  // Auto-scroll only when triggered by send/stream, reset when streaming ends
  useEffect(() => {
    if (shouldScrollRef.current && messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
      // Reset after streaming completes so user can scroll freely
      if (!isStreaming && !isThinking) {
        shouldScrollRef.current = false;
      }
    }
  }, [messages, streamingContent, isThinking, isStreaming]);

  const canSend =
    input.trim().length > 0 && selectedCourseId && !isStreaming && usageCount < dailyLimit;

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || !selectedCourseId || isStreaming) return;

    if (usageCount >= dailyLimit) {
      toast.error(t('usageLimitReached'));
      return;
    }

    setInput('');
    shouldScrollRef.current = true;

    const userMsg: ChatMsg = { id: `local-${Date.now()}`, role: 'USER', content: question };
    setMessages((prev) => [...prev, userMsg]);

    setIsThinking(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await aiTutorService.askStream({
        courseId: selectedCourseId,
        sessionId: activeSessionId ?? undefined,
        question,
      });

      if (!response.ok) {
        const error = await response.json();
        setIsThinking(false);
        setIsStreaming(false);
        toast.error(t(`errors.${(error as { code?: string }).code ?? 'INTERNAL_ERROR'}`));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setIsThinking(false);
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              sessionId?: string;
              content?: string;
              messageId?: string;
              code?: string;
            };

            switch (event.type) {
              case 'start':
                if (!activeSessionId && event.sessionId) {
                  setActiveSessionId(event.sessionId);
                }
                // Keep thinking dots until first token arrives
                break;
              case 'token':
                setIsThinking(false);
                fullContent += event.content ?? '';
                setStreamingContent(fullContent);
                break;
              case 'done':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: event.messageId ?? `ai-${Date.now()}`,
                    role: 'ASSISTANT',
                    content: fullContent,
                  },
                ]);
                setStreamingContent('');
                setIsStreaming(false);
                queryClient.invalidateQueries({ queryKey: ['ai-tutor'] });
                break;
              case 'error':
                setIsThinking(false);
                setIsStreaming(false);
                toast.error(t(`errors.${event.code ?? 'INTERNAL_ERROR'}`));
                break;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch {
      setIsThinking(false);
      setIsStreaming(false);
      toast.error(t('errors.NETWORK_ERROR'));
    }
  }, [
    input,
    selectedCourseId,
    activeSessionId,
    isStreaming,
    usageCount,
    dailyLimit,
    t,
    queryClient,
    setMessages,
    setInput,
    setIsThinking,
    setIsStreaming,
    setStreamingContent,
    setActiveSessionId,
  ]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="text-primary/30 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">{t('welcomeTitle')}</h3>
            <p className="text-muted-foreground max-w-md text-sm">{t('welcomeDesc')}</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            userAvatar={userAvatar}
            userName={userName}
          />
        ))}

        {streamingContent && (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] items-start gap-2">
              <Avatar className="mt-1 h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                <MarkdownRenderer content={streamingContent} />
              </div>
            </div>
          </div>
        )}

        {isThinking && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <Avatar className="mt-1 h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <StreamingIndicator />
              </div>
            </div>
          </div>
        )}
      </div>

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
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!canSend}
            onClick={handleSend}
          >
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
