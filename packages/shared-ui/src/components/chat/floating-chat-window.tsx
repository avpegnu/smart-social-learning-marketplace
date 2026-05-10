'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Minus, Users, X } from 'lucide-react';
import { useAuthStore, useChatWindowsStore, useConversations, useMessages } from '@shared/hooks';
import { cn } from '../../lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '../avatar';
import { FloatingChatMessage } from './floating-chat-message';
import { FloatingChatInput } from './floating-chat-input';
import {
  type ChatConversationData,
  type ChatMessageData,
  getConversationDisplayName,
  getOtherParticipant,
} from './types';

interface FloatingChatWindowProps {
  conversationId: string;
  minimized: boolean;
  typingUserNames: string[];
  sendMessage: (
    conversationId: string,
    content: string,
    options?: { type?: string; fileUrl?: string; fileName?: string },
  ) => void;
  joinConversation: (conversationId: string) => void;
  sendTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  markRead: (conversationId: string) => void;
}

export function FloatingChatWindow({
  conversationId,
  minimized,
  typingUserNames,
  sendMessage,
  joinConversation,
  sendTyping,
  stopTyping,
  markRead,
}: FloatingChatWindowProps) {
  const t = useTranslations('chat');
  const currentUser = useAuthStore((s) => s.user);
  const closeWindow = useChatWindowsStore((s) => s.closeWindow);
  const toggleMinimize = useChatWindowsStore((s) => s.toggleMinimize);

  const { data: conversationsRaw } = useConversations();
  const conversation = useMemo<ChatConversationData | null>(() => {
    const list =
      (conversationsRaw as { data?: ChatConversationData[] })?.data ??
      (Array.isArray(conversationsRaw) ? (conversationsRaw as ChatConversationData[]) : []);
    return list?.find((c) => c.id === conversationId) ?? null;
  }, [conversationsRaw, conversationId]);

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingMessages,
  } = useMessages(minimized ? '' : conversationId);

  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const [localMessages, setLocalMessages] = useState<ChatMessageData[]>([]);

  // Reset local messages when conversation changes (defensive — id is stable in this component)
  useEffect(() => {
    setLocalMessages([]);
  }, [conversationId]);

  // Server messages — flatten + reverse so oldest is first
  const serverMessages = useMemo(() => {
    interface MessagePage {
      data?: ChatMessageData[];
    }
    return (messagesData?.pages ?? [])
      .flatMap((page) => (page as MessagePage).data ?? [])
      .reverse();
  }, [messagesData]);

  // Drop optimistic messages already echoed by the server
  const filteredLocal = useMemo(
    () =>
      localMessages.filter(
        (local) =>
          !serverMessages.some((s) => s.senderId === local.senderId && s.content === local.content),
      ),
    [localMessages, serverMessages],
  );

  const messages = useMemo(
    () => [...serverMessages, ...filteredLocal],
    [serverMessages, filteredLocal],
  );

  // Join conversation room + mark read on open / un-minimize
  useEffect(() => {
    if (minimized) return;
    joinConversation(conversationId);
    markRead(conversationId);
  }, [conversationId, minimized, joinConversation, markRead]);

  // Auto-scroll on new last message
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (minimized) return;
    if (shouldScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      shouldScrollRef.current = false;
    }
  }, [lastMessageId, minimized]);

  // Initial scroll after expand
  useEffect(() => {
    if (minimized) return;
    const timer = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [minimized, conversationId]);

  // Preserve scroll position after fetching older messages
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [messagesData?.pages.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollTop < 60) {
      prevScrollHeightRef.current = el.scrollHeight;
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSend = useCallback(
    (content: string) => {
      if (!currentUser) return;
      shouldScrollRef.current = true;
      const optimistic: ChatMessageData = {
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
      setLocalMessages((prev) => [...prev, optimistic]);
      sendMessage(conversationId, content, { type: 'TEXT' });
    },
    [currentUser, conversationId, sendMessage],
  );

  const handleTyping = useCallback(() => sendTyping(conversationId), [conversationId, sendTyping]);
  const handleStopTyping = useCallback(
    () => stopTyping(conversationId),
    [conversationId, stopTyping],
  );

  const handleHeaderClick = () => {
    if (minimized) {
      toggleMinimize(conversationId);
    }
  };

  const handleBodyClick = () => {
    markRead(conversationId);
  };

  if (!currentUser) return null;

  // Header info
  const isGroup = conversation?.isGroup ?? false;
  const displayName = conversation
    ? getConversationDisplayName(conversation, currentUser.id, t('directMessage'))
    : '...';
  const other = conversation ? getOtherParticipant(conversation, currentUser.id) : null;
  const isOnline = !isGroup && other?.isOnline;
  const unreadCount = conversation?.unreadCount ?? 0;

  return (
    <div
      className={cn(
        'bg-popover border-border pointer-events-auto flex w-[20.5rem] flex-col overflow-hidden rounded-t-xl border border-b-0 shadow-2xl',
        minimized ? 'h-11' : 'h-[28rem]',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleHeaderClick}
        className={cn(
          'flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b px-3 text-left',
          'hover:bg-accent/40 transition-colors',
        )}
      >
        <div className="relative shrink-0">
          {isGroup ? (
            <div className="bg-muted flex h-7 w-7 items-center justify-center rounded-full">
              <Users className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          ) : (
            <Avatar className="h-7 w-7">
              {other?.avatarUrl && <AvatarImage src={other.avatarUrl} alt={displayName} />}
              <AvatarFallback className="text-[10px]">
                {displayName[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
          )}
          {isOnline && (
            <span className="ring-popover absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-green-500 ring-2" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          {!isGroup && !minimized && (
            <p
              className={cn(
                'truncate text-[10px]',
                isOnline ? 'text-green-500' : 'text-muted-foreground',
              )}
            >
              {isOnline ? t('online') : t('offline')}
            </p>
          )}
        </div>
        {minimized && unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize(conversationId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggleMinimize(conversationId);
              }
            }}
            className="hover:bg-accent inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
            aria-label={t('minimize')}
            title={t('minimize')}
          >
            <Minus className="h-4 w-4" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(conversationId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                closeWindow(conversationId);
              }
            }}
            className="hover:bg-accent inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
            aria-label={t('close')}
            title={t('close')}
          >
            <X className="h-4 w-4" />
          </span>
        </div>
      </button>

      {/* Body — only mounted when expanded */}
      {!minimized && (
        <>
          <div
            ref={containerRef}
            onScroll={handleScroll}
            onClick={handleBodyClick}
            className="flex-1 space-y-1.5 overflow-y-auto p-3"
          >
            {isFetchingNextPage && (
              <div className="flex justify-center py-1">
                <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
              </div>
            )}

            {isLoadingMessages && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                <p className="text-xs">{t('noMessages')}</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.senderId === currentUser.id;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showSenderInfo =
                  isGroup && !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId);
                return (
                  <FloatingChatMessage
                    key={msg.id}
                    message={msg}
                    isOwn={isOwn}
                    isGroup={isGroup}
                    showSenderInfo={showSenderInfo}
                  />
                );
              })
            )}
          </div>

          {typingUserNames.length > 0 && (
            <div className="flex items-center gap-2 px-3 pb-1">
              <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-1">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    <div
                      className="bg-muted-foreground/50 h-1 w-1 animate-bounce rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="bg-muted-foreground/50 h-1 w-1 animate-bounce rounded-full"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="bg-muted-foreground/50 h-1 w-1 animate-bounce rounded-full"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {typingUserNames[0]} {t('typing')}
                  </span>
                </div>
              </div>
            </div>
          )}

          <FloatingChatInput
            onSend={handleSend}
            onTyping={handleTyping}
            onStopTyping={handleStopTyping}
          />
        </>
      )}
    </div>
  );
}
