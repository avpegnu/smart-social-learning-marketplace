'use client';

import { useLocale } from 'next-intl';
import { Users } from 'lucide-react';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '../../lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '../avatar';
import { Badge } from '../badge';
import {
  type ChatConversationData,
  getConversationDisplayName,
  getOtherParticipant,
} from './types';

interface ChatPopoverItemProps {
  conversation: ChatConversationData;
  currentUserId: string | undefined;
  unknownLabel: string;
  groupLabel: string;
  youLabel: string;
  onClick: (conversationId: string) => void;
}

export function ChatPopoverItem({
  conversation,
  currentUserId,
  unknownLabel,
  groupLabel,
  youLabel,
  onClick,
}: ChatPopoverItemProps) {
  const locale = useLocale();
  const { isGroup, lastMessage, unreadCount } = conversation;

  const displayName = getConversationDisplayName(
    conversation,
    currentUserId,
    isGroup ? groupLabel : unknownLabel,
  );
  const other = getOtherParticipant(conversation, currentUserId);
  const isOnline = !isGroup && other?.isOnline;

  let preview = '';
  if (lastMessage) {
    if (isGroup) {
      const senderName =
        lastMessage.senderId === currentUserId ? youLabel : lastMessage.sender.fullName;
      preview = `${senderName}: ${lastMessage.content}`;
    } else if (lastMessage.senderId === currentUserId) {
      preview = `${youLabel}: ${lastMessage.content}`;
    } else {
      preview = lastMessage.content;
    }
  }

  return (
    <button
      type="button"
      onClick={() => onClick(conversation.id)}
      className={cn(
        'hover:bg-accent/60 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
      )}
    >
      <div className="relative shrink-0">
        {isGroup ? (
          <div className="bg-muted flex h-11 w-11 items-center justify-center rounded-full">
            <Users className="text-muted-foreground h-5 w-5" />
          </div>
        ) : (
          <Avatar className="h-11 w-11">
            {other?.avatarUrl && <AvatarImage src={other.avatarUrl} alt={displayName} />}
            <AvatarFallback>{displayName[0]?.toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
        )}
        {isOnline && (
          <span className="ring-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-green-500 ring-2" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn('truncate text-sm', unreadCount > 0 ? 'font-semibold' : 'font-medium')}
          >
            {displayName}
          </span>
          {lastMessage && (
            <span className="text-muted-foreground shrink-0 text-[11px]">
              {formatRelativeTime(lastMessage.createdAt, locale)}
            </span>
          )}
        </div>
        {preview && (
          <p
            className={cn(
              'mt-0.5 truncate text-xs',
              unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {preview}
          </p>
        )}
      </div>

      {unreadCount > 0 && (
        <Badge className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px]">
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </button>
  );
}
