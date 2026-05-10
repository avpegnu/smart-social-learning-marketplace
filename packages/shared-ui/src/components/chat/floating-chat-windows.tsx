'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore, useChatSocket, useChatWindowsStore, useConversations } from '@shared/hooks';
import { FloatingChatWindow } from './floating-chat-window';
import { type ChatConversationData, normalizeParticipants } from './types';

export function FloatingChatWindows() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);
  const openWindows = useChatWindowsStore((s) => s.openWindows);
  const closeAllWindows = useChatWindowsStore((s) => s.closeAll);

  // Reset open windows whenever the authenticated user changes (login/logout/account switch).
  // Without this, the module-level Zustand store leaks windows from a previous user's session.
  const lastUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextUserId = isAuthenticated ? (currentUser?.id ?? null) : null;
    if (lastUserIdRef.current !== nextUserId) {
      if (lastUserIdRef.current !== null) {
        closeAllWindows();
      }
      lastUserIdRef.current = nextUserId;
    }
  }, [isAuthenticated, currentUser?.id, closeAllWindows]);

  // Track typing users per conversation (state lives in container so it's shared
  // across all windows and survives re-mounts within the same layout)
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());

  const handleTyping = useCallback(
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

  const handleStopTyping = useCallback((data: { userId: string; conversationId: string }) => {
    setTypingUsers((prev) => {
      const next = new Map(prev);
      const users = new Set(next.get(data.conversationId) ?? []);
      users.delete(data.userId);
      if (users.size === 0) next.delete(data.conversationId);
      else next.set(data.conversationId, users);
      return next;
    });
  }, []);

  const { sendMessage, joinConversation, sendTyping, stopTyping, markRead } = useChatSocket({
    onTyping: handleTyping,
    onStopTyping: handleStopTyping,
  });

  const { data: conversationsRaw } = useConversations();
  const conversations = useMemo<ChatConversationData[]>(() => {
    const raw =
      (conversationsRaw as { data?: ChatConversationData[] })?.data ??
      (Array.isArray(conversationsRaw) ? (conversationsRaw as ChatConversationData[]) : []);
    return raw ?? [];
  }, [conversationsRaw]);

  // Resolve typing user IDs → display names per conversation
  const typingNamesByConversation = useMemo(() => {
    const result = new Map<string, string[]>();
    typingUsers.forEach((userIds, conversationId) => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;
      const participants = normalizeParticipants(conv);
      const names = Array.from(userIds)
        .map((uid) => participants.find((p) => p.id === uid)?.fullName)
        .filter((n): n is string => Boolean(n));
      if (names.length > 0) result.set(conversationId, names);
    });
    return result;
  }, [typingUsers, conversations]);

  if (!isAuthenticated || openWindows.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-0 z-40 hidden items-end gap-2 sm:flex">
      {openWindows.map((window) => (
        <FloatingChatWindow
          key={window.conversationId}
          conversationId={window.conversationId}
          minimized={window.minimized}
          typingUserNames={typingNamesByConversation.get(window.conversationId) ?? []}
          sendMessage={sendMessage}
          joinConversation={joinConversation}
          sendTyping={sendTyping}
          stopTyping={stopTyping}
          markRead={markRead}
        />
      ))}
    </div>
  );
}
