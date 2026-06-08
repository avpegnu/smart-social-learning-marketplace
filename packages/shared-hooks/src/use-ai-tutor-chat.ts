'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiTutorService } from './services/ai-tutor.service';
import { useAiQuota, useSessionMessages } from './queries/use-ai-tutor';

export interface ChatMsg {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
}

interface SseEvent {
  type: string;
  sessionId?: string;
  content?: string;
  messageId?: string;
  code?: string;
}

const DEFAULT_DAILY_LIMIT = 10;

interface UseAiTutorChatOptions {
  /** Course the conversation is scoped to. Changing it resets the chat. */
  courseId: string;
}

/**
 * Single source of truth for an AI Tutor conversation scoped to one course:
 * session selection, message state, daily quota and the SSE streaming loop.
 *
 * Shared by the fullscreen `/ai-tutor` page and the inline learning-screen
 * widget so the streaming logic lives in exactly one place.
 */
export function useAiTutorChat({ courseId }: UseAiTutorChatOptions) {
  const t = useTranslations('aiTutor');
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');

  // Daily quota
  const { data: quotaRaw } = useAiQuota();
  const quota = (
    quotaRaw as { data?: { used: number; limit: number; remaining: number } } | undefined
  )?.data;
  const usageCount = quota?.used ?? 0;
  const dailyLimit = quota?.limit ?? DEFAULT_DAILY_LIMIT;

  // Server-persisted messages for the active session
  const { data: messagesRaw } = useSessionMessages(activeSessionId ?? '');
  const sessionMessages = ((messagesRaw as { data?: ChatMsg[] } | undefined)?.data ??
    (messagesRaw as ChatMsg[] | undefined)) as ChatMsg[] | undefined;

  // Skip server-sync while a response is streaming so the optimistic user
  // message is preserved until the assistant reply is committed.
  const streamingRef = useRef(false);
  streamingRef.current = isStreaming || isThinking;

  useEffect(() => {
    if (sessionMessages && !streamingRef.current) {
      setMessages(
        sessionMessages.map((m, i) => ({
          id: m.id ?? `msg-${i}`,
          role: m.role,
          content: m.content,
        })),
      );
    }
  }, [sessionMessages]);

  // Reset the conversation when switching courses.
  const prevCourseRef = useRef(courseId);
  useEffect(() => {
    if (prevCourseRef.current !== courseId) {
      prevCourseRef.current = courseId;
      setActiveSessionId(null);
      setMessages([]);
      setStreamingContent('');
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [courseId]);

  const selectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      setMessages([]);
      setStreamingContent('');
    },
    [activeSessionId],
  );

  const newSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent('');
  }, []);

  const canSend = input.trim().length > 0 && !!courseId && !isStreaming && usageCount < dailyLimit;

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || !courseId || isStreaming) return;

    if (usageCount >= dailyLimit) {
      toast.error(t('usageLimitReached'));
      return;
    }

    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'USER', content: question },
    ]);
    setIsThinking(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await aiTutorService.askStream({
        courseId,
        sessionId: activeSessionId ?? undefined,
        question,
      });

      if (!response.ok) {
        const error = (await response.json()) as { code?: string };
        setIsThinking(false);
        setIsStreaming(false);
        toast.error(t(`errors.${error.code ?? 'INTERNAL_ERROR'}`));
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
            const event = JSON.parse(line.slice(6)) as SseEvent;

            switch (event.type) {
              case 'start':
                // New session created server-side — capture its id for follow-ups.
                if (!activeSessionId && event.sessionId) {
                  setActiveSessionId(event.sessionId);
                }
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
                void queryClient.invalidateQueries({ queryKey: ['ai-tutor'] });
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
  }, [input, courseId, isStreaming, usageCount, dailyLimit, activeSessionId, t, queryClient]);

  return {
    activeSessionId,
    selectSession,
    newSession,
    messages,
    streamingContent,
    isThinking,
    isStreaming,
    input,
    setInput,
    send,
    canSend,
    usageCount,
    dailyLimit,
  };
}
