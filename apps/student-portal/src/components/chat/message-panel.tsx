'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@shared/ui';
import { useMessages, useAuthStore } from '@shared/hooks';
import { cn } from '@/lib/utils';
import { MessageItem } from './message-item';
import { MessageInput } from './message-input';
import { TypingIndicator } from './typing-indicator';

interface Participant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  isOnline?: boolean;
}

interface MessageData {
  id: string;
  content: string;
  type: string;
  senderId: string;
  sender: { id: string; fullName: string; avatarUrl: string | null };
  createdAt: string;
}

interface ConversationInfo {
  id: string;
  isGroup: boolean;
  name: string | null;
  participants: Participant[];
}

interface MessagePanelProps {
  conversation: ConversationInfo | null;
  typingUserNames: string[];
  onSendMessage: (conversationId: string, content: string) => void;
  onTyping: (conversationId: string) => void;
  onStopTyping: (conversationId: string) => void;
  onBack: () => void;
}

export function MessagePanel({
  conversation,
  typingUserNames,
  onSendMessage,
  onTyping,
  onStopTyping,
  onBack,
}: MessagePanelProps) {
  const t = useTranslations('chat');
  const currentUser = useAuthStore((s) => s.user);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversation?.id ?? '');

  // Flatten pages and reverse (API returns desc, we need asc)
  interface MessagePage {
    data?: MessageData[];
  }
  const serverMessages = (messagesData?.pages ?? [])
    .flatMap((page) => (page as MessagePage).data ?? [])
    .reverse();

  // Local optimistic messages
  const [localMessages, setLocalMessages] = useState<MessageData[]>([]);

  useEffect(() => {
    if (serverMessages.length > 0) setLocalMessages([]);
  }, [serverMessages.length]);

  useEffect(() => {
    setLocalMessages([]);
  }, [conversation?.id]);

  const messages = [...serverMessages, ...localMessages];

  // Scroll up to load older messages
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || isFetchingNextPage || !hasNextPage) return;
    if (container.scrollTop < 60) {
      prevScrollHeightRef.current = container.scrollHeight;
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Preserve scroll position after loading older messages
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [messagesData?.pages.length]);

  // Determine display info
  const otherParticipant =
    conversation && !conversation.isGroup
      ? (conversation.participants.find((p) => p.id !== currentUser?.id) ??
        conversation.participants[0])
      : null;

  const displayName = conversation
    ? conversation.isGroup
      ? (conversation.name ?? 'Group')
      : (otherParticipant?.fullName ?? 'Unknown')
    : '';

  const subtitle = conversation
    ? conversation.isGroup
      ? t('membersCount', { count: conversation.participants.length })
      : otherParticipant?.isOnline
        ? t('online')
        : t('offline')
    : '';

  // Auto-scroll on send
  useEffect(() => {
    if (shouldScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      shouldScrollRef.current = false;
    }
  }, [messages.length]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    if (conversation && containerRef.current) {
      // Small delay to let messages render
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [conversation?.id]);

  const handleSend = useCallback(
    (content: string) => {
      if (!conversation || !currentUser) return;
      shouldScrollRef.current = true;

      // Optimistic: show message immediately
      const optimisticMsg: MessageData = {
        id: `temp-${Date.now()}`,
        content,
        type: 'TEXT',
        senderId: currentUser.id,
        sender: {
          id: currentUser.id,
          fullName: currentUser.fullName ?? '',
          avatarUrl: currentUser.avatarUrl ?? null,
        },
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticMsg]);

      onSendMessage(conversation.id, content);
    },
    [conversation, currentUser, onSendMessage],
  );

  const handleTyping = useCallback(() => {
    if (conversation) onTyping(conversation.id);
  }, [conversation, onTyping]);

  const handleStopTyping = useCallback(() => {
    if (conversation) onStopTyping(conversation.id);
  }, [conversation, onStopTyping]);

  if (!conversation) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center">
        <p className="text-sm">{t('selectConversation')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground cursor-pointer sm:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {conversation.isGroup ? (
          <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
            <Users className="text-muted-foreground h-4 w-4" />
          </div>
        ) : (
          <div className="relative">
            <Avatar className="h-9 w-9">
              {otherParticipant?.avatarUrl && (
                <AvatarImage src={otherParticipant.avatarUrl} alt={displayName} />
              )}
              <AvatarFallback className="text-xs">{displayName[0]}</AvatarFallback>
            </Avatar>
            {otherParticipant?.isOnline && (
              <span className="ring-background absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{displayName}</h3>
          <p
            className={cn(
              'text-xs',
              !conversation.isGroup && otherParticipant?.isOnline
                ? 'text-green-500'
                : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        {/* Loading older messages */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          </div>
        )}

        {messages.length === 0 && !isFetchingNextPage ? (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <p className="text-sm">{t('noMessages')}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.senderId === currentUser?.id;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showSenderInfo =
              conversation.isGroup && !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId);

            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                isGroup={conversation.isGroup}
                showSenderInfo={showSenderInfo}
              />
            );
          })
        )}
      </div>

      {/* Typing indicator */}
      <TypingIndicator typingUserNames={typingUserNames} />

      {/* Input */}
      <MessageInput onSend={handleSend} onTyping={handleTyping} onStopTyping={handleStopTyping} />
    </div>
  );
}
