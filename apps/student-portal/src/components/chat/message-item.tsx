'use client';

import { useLocale } from 'next-intl';
import { Avatar, AvatarImage, AvatarFallback } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '@/lib/utils';

interface MessageSender {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface MessageData {
  id: string;
  content: string;
  type: string;
  senderId: string;
  sender: MessageSender;
  createdAt: string;
}

interface MessageItemProps {
  message: MessageData;
  isOwn: boolean;
  isGroup: boolean;
  showSenderInfo: boolean;
}

export function MessageItem({ message, isOwn, isGroup, showSenderInfo }: MessageItemProps) {
  const locale = useLocale();

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[75%] gap-2', isOwn && 'flex-row-reverse')}>
        {/* Avatar for group non-own messages */}
        {isGroup && !isOwn && (
          <div className="mt-auto flex-shrink-0">
            {showSenderInfo ? (
              <Avatar className="h-6 w-6">
                {message.sender.avatarUrl && (
                  <AvatarImage src={message.sender.avatarUrl} alt={message.sender.fullName} />
                )}
                <AvatarFallback className="text-[10px]">
                  {message.sender.fullName[0]}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-6" />
            )}
          </div>
        )}

        <div className="min-w-0">
          {/* Sender name for group */}
          {isGroup && !isOwn && showSenderInfo && (
            <p className="text-muted-foreground mb-0.5 ml-1 text-[11px] font-medium">
              {message.sender.fullName}
            </p>
          )}

          {/* Message bubble */}
          <div
            className={cn(
              'rounded-2xl px-3 py-2',
              isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md',
            )}
          >
            <p className="text-sm wrap-break-word whitespace-pre-wrap">{message.content}</p>
            <p
              className={cn(
                'mt-0.5 text-[10px]',
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
