'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useChatSocket,
  useConversations,
  useAuthStore,
  type ChatSocketCallbacks,
} from '@shared/hooks';
import { cn } from '@/lib/utils';
import { ConversationList } from '@/components/chat/conversation-list';
import { MessagePanel } from '@/components/chat/message-panel';

interface Participant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  isOnline?: boolean;
}

interface ConversationData {
  id: string;
  isGroup: boolean;
  name: string | null;
  participants: Participant[];
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    searchParams.get('id'),
  );
  const [showList, setShowList] = useState(!searchParams.get('id'));
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());

  // Conversations data for finding active conversation info
  const { data: conversationsRaw } = useConversations();
  const rawList = ((conversationsRaw as { data?: unknown[] })?.data ??
    (Array.isArray(conversationsRaw) ? conversationsRaw : [])) as Array<{
    id: string;
    isGroup: boolean;
    name: string | null;
    isOnline?: boolean;
    members?: Array<{
      userId: string;
      user: { id: string; fullName: string; avatarUrl: string | null };
    }>;
    participants?: Participant[];
  }>;

  const conversations: ConversationData[] = rawList.map((c) => ({
    id: c.id,
    isGroup: c.isGroup,
    name: c.name,
    participants:
      c.participants ??
      (c.members ?? []).map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        isOnline: c.isOnline,
      })),
  }));

  const activeConversation = activeConversationId
    ? (conversations.find((c) => c.id === activeConversationId) ?? null)
    : null;

  // Typing callback handlers
  const handleTypingEvent = useCallback(
    (data: { userId: string; conversationId: string }) => {
      if (data.userId === currentUser?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const users = new Set(next.get(data.conversationId) ?? []);
        users.add(data.userId);
        next.set(data.conversationId, users);
        return next;
      });
    },
    [currentUser?.id],
  );

  const handleStopTypingEvent = useCallback((data: { userId: string; conversationId: string }) => {
    setTypingUsers((prev) => {
      const next = new Map(prev);
      const users = next.get(data.conversationId);
      if (users) {
        users.delete(data.userId);
        if (users.size === 0) next.delete(data.conversationId);
        else next.set(data.conversationId, users);
      }
      return next;
    });
  }, []);

  const socketCallbacks: ChatSocketCallbacks = {
    onTyping: handleTypingEvent,
    onStopTyping: handleStopTypingEvent,
  };

  const { joinConversation, sendMessage, sendTyping, stopTyping, markRead } =
    useChatSocket(socketCallbacks);

  // Select conversation handler
  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      setShowList(false);
      joinConversation(id);
      markRead(id);
    },
    [joinConversation, markRead],
  );

  // Join conversation from URL param on mount
  useEffect(() => {
    const paramId = searchParams.get('id');
    if (paramId) {
      joinConversation(paramId);
      markRead(paramId);
    }
  }, []);

  // Send message via socket
  const handleSendMessage = useCallback(
    (conversationId: string, content: string) => {
      sendMessage(conversationId, content);
    },
    [sendMessage],
  );

  // Get typing user names for active conversation
  const activeTypingUserIds = activeConversationId
    ? Array.from(typingUsers.get(activeConversationId) ?? [])
    : [];
  const typingUserNames = activeTypingUserIds
    .map((userId) => {
      const participant = activeConversation?.participants.find((p) => p.id === userId);
      return participant?.fullName ?? '';
    })
    .filter(Boolean);

  return (
    <div className="flex h-full">
      <div className="bg-background flex w-full overflow-hidden">
        {/* Conversation List */}
        <div
          className={cn(
            'border-border flex w-full shrink-0 flex-col border-r sm:w-80',
            !showList ? 'hidden sm:flex' : 'flex',
          )}
        >
          <ConversationList
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Message Panel */}
        <div className={cn('flex min-h-0 flex-1 flex-col', showList ? 'hidden sm:flex' : 'flex')}>
          <MessagePanel
            conversation={activeConversation}
            typingUserNames={typingUserNames}
            onSendMessage={handleSendMessage}
            onTyping={sendTyping}
            onStopTyping={stopTyping}
            onBack={() => setShowList(true)}
          />
        </div>
      </div>
    </div>
  );
}
