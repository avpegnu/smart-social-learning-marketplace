'use client';

import { useLocale } from 'next-intl';
import { Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback, Badge } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '@/lib/utils';

interface Participant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  isOnline?: boolean;
}

interface LastMessage {
  content: string;
  senderId: string;
  sender: { fullName: string };
  createdAt: string;
}

interface ConversationData {
  id: string;
  isGroup: boolean;
  name: string | null;
  participants: Participant[];
  lastMessage: LastMessage | null;
  unreadCount: number;
}

interface ConversationItemProps {
  conversation: ConversationData;
  isActive: boolean;
  currentUserId: string;
  onClick: (id: string) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  currentUserId,
  onClick,
}: ConversationItemProps) {
  const locale = useLocale();
  const { isGroup, name, participants, lastMessage, unreadCount } = conversation;

  // For 1-on-1: find the other participant (guard against undefined)
  const otherParticipant =
    isGroup || !participants
      ? null
      : (participants.find((p) => p.id !== currentUserId) ?? participants[0]);

  const displayName = isGroup ? (name ?? 'Group') : (otherParticipant?.fullName ?? 'Unknown');
  const isOnline = !isGroup && otherParticipant?.isOnline;

  // Last message preview
  let lastMessagePreview = '';
  if (lastMessage) {
    if (isGroup) {
      const senderName =
        lastMessage.senderId === currentUserId ? 'You' : lastMessage.sender.fullName;
      lastMessagePreview = `${senderName}: ${lastMessage.content}`;
    } else {
      lastMessagePreview = lastMessage.content;
    }
  }

  return (
    <button
      onClick={() => onClick(conversation.id)}
      className={cn(
        'hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
        isActive && 'bg-accent',
      )}
    >
      <div className="relative">
        {isGroup ? (
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <Users className="text-muted-foreground h-5 w-5" />
          </div>
        ) : (
          <Avatar className="h-12 w-12">
            {otherParticipant?.avatarUrl && (
              <AvatarImage src={otherParticipant.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback>{displayName[0]}</AvatarFallback>
          </Avatar>
        )}
        {isOnline && (
          <span className="ring-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-green-500 ring-2" />
        )}
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {lastMessage && (
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatRelativeTime(lastMessage.createdAt, locale)}
            </span>
          )}
        </div>
        {lastMessagePreview && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{lastMessagePreview}</p>
        )}
      </div>

      {unreadCount > 0 && (
        <Badge className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px]">
          {unreadCount}
        </Badge>
      )}
    </button>
  );
}
