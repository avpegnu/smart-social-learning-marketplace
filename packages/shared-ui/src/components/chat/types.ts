export interface ChatParticipant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  isOnline?: boolean;
}

export interface ChatLastMessage {
  content: string;
  senderId: string;
  sender: { fullName: string };
  createdAt: string;
}

export interface ChatConversationData {
  id: string;
  isGroup: boolean;
  name: string | null;
  isOnline?: boolean;
  unreadCount: number;
  lastMessage: ChatLastMessage | null;
  participants?: ChatParticipant[];
  members?: Array<{
    userId: string;
    user: { id: string; fullName: string; avatarUrl: string | null };
  }>;
}

export interface ChatMessageData {
  id: string;
  content: string;
  type: string;
  fileUrl?: string;
  senderId: string;
  sender: { id: string; fullName: string; avatarUrl: string | null };
  createdAt: string;
}

export function normalizeParticipants(conversation: ChatConversationData): ChatParticipant[] {
  if (conversation.participants && conversation.participants.length > 0) {
    return conversation.participants;
  }
  return (conversation.members ?? []).map((m) => ({
    id: m.user.id,
    fullName: m.user.fullName,
    avatarUrl: m.user.avatarUrl,
    isOnline: conversation.isOnline,
  }));
}

export function getOtherParticipant(
  conversation: ChatConversationData,
  currentUserId: string | undefined,
): ChatParticipant | null {
  if (conversation.isGroup) return null;
  const participants = normalizeParticipants(conversation);
  return participants.find((p) => p.id !== currentUserId) ?? participants[0] ?? null;
}

export function getConversationDisplayName(
  conversation: ChatConversationData,
  currentUserId: string | undefined,
  fallback: string,
): string {
  if (conversation.isGroup) return conversation.name ?? fallback;
  const other = getOtherParticipant(conversation, currentUserId);
  return other?.fullName ?? fallback;
}
