'use client';

import { useLocale } from 'next-intl';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '../../lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '../avatar';
import type { ChatMessageData } from './types';

interface FloatingChatMessageProps {
  message: ChatMessageData;
  isOwn: boolean;
  isGroup: boolean;
  showSenderInfo: boolean;
}

export function FloatingChatMessage({
  message,
  isOwn,
  isGroup,
  showSenderInfo,
}: FloatingChatMessageProps) {
  const locale = useLocale();
  const isImage = message.type === 'IMAGE';

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[80%] gap-1.5', isOwn && 'flex-row-reverse')}>
        {isGroup && !isOwn && (
          <div className="mt-auto flex-shrink-0">
            {showSenderInfo ? (
              <Avatar className="h-5 w-5">
                {message.sender.avatarUrl && (
                  <AvatarImage src={message.sender.avatarUrl} alt={message.sender.fullName} />
                )}
                <AvatarFallback className="text-[9px]">{message.sender.fullName[0]}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-5" />
            )}
          </div>
        )}

        <div className="min-w-0">
          {isGroup && !isOwn && showSenderInfo && (
            <p className="text-muted-foreground mb-0.5 ml-1 text-[10px] font-medium">
              {message.sender.fullName}
            </p>
          )}

          <div
            className={cn(
              'rounded-2xl',
              isImage ? 'overflow-hidden' : 'px-3 py-1.5',
              isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md',
            )}
          >
            {isImage ? (
              <a
                href={message.fileUrl ?? message.content}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={message.fileUrl ?? message.content}
                  alt=""
                  className="max-h-48 max-w-full rounded-2xl object-contain"
                />
              </a>
            ) : (
              <p className="text-sm wrap-break-word whitespace-pre-wrap">{message.content}</p>
            )}
            <p
              className={cn(
                'text-[9px]',
                isImage ? 'px-3 pb-1' : 'mt-0.5',
                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground',
              )}
            >
              {formatRelativeTime(message.createdAt, locale)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
