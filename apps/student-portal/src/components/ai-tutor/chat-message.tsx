'use client';

import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { MarkdownRenderer } from './markdown-renderer';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'USER' | 'ASSISTANT';
  content: string;
  userAvatar?: string | null;
  userName?: string;
}

export function ChatMessage({ role, content, userAvatar, userName }: ChatMessageProps) {
  const isUser = role === 'USER';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className="flex max-w-[85%] items-start gap-2">
        {!isUser && (
          <Avatar className="mt-1 h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary">
              <Bot className="h-3.5 w-3.5" />
            </AvatarFallback>
          </Avatar>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md',
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>
        {isUser && (
          <Avatar className="mt-1 h-7 w-7 shrink-0">
            {userAvatar && <AvatarImage src={userAvatar} />}
            <AvatarFallback className="text-[9px]">{userName?.[0] ?? 'U'}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
