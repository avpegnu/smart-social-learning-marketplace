'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback } from '@shared/ui';
import type { ChatMsg } from '@shared/hooks';
import { cn } from '@/lib/utils';
import { ChatMessage } from './chat-message';
import { StreamingIndicator } from './streaming-indicator';
import { MarkdownRenderer } from './markdown-renderer';

interface AiTutorMessagesProps {
  messages: ChatMsg[];
  streamingContent: string;
  isThinking: boolean;
  isStreaming: boolean;
  userAvatar?: string | null;
  userName?: string;
  /** Rendered when there are no messages and nothing is streaming. */
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Scrollable conversation view shared by the fullscreen AI Tutor page and the
 * inline learning-screen widget. Owns auto-scroll: pins to the bottom while the
 * assistant is generating a reply, and leaves the scroll position untouched
 * when browsing an existing conversation.
 */
export function AiTutorMessages({
  messages,
  streamingContent,
  isThinking,
  isStreaming,
  userAvatar,
  userName,
  emptyState,
  className,
}: AiTutorMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isThinking || isStreaming) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingContent, isThinking, isStreaming]);

  return (
    <div ref={containerRef} className={cn('flex-1 space-y-4 overflow-y-auto p-4', className)}>
      {messages.length === 0 && !isThinking && !streamingContent && emptyState}

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
  );
}
