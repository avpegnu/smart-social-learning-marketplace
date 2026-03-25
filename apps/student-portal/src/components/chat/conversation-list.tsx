'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Users } from 'lucide-react';
import { Input, Button } from '@shared/ui';
import {
  useConversations,
  useSearchUsers,
  useGetOrCreateConversation,
  useDebounce,
  useAuthStore,
} from '@shared/hooks';
import { ConversationItem } from './conversation-item';
import { UserSearchItem } from './user-search-item';
import { NewGroupDialog } from './new-group-dialog';

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

interface UserResult {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ConversationListProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const t = useTranslations('chat');
  const currentUser = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const { data: conversationsRaw } = useConversations();
  const rawConversations = ((conversationsRaw as { data?: unknown[] })?.data ??
    (Array.isArray(conversationsRaw) ? conversationsRaw : [])) as Array<{
    id: string;
    isGroup: boolean;
    name: string | null;
    isOnline?: boolean;
    unreadCount: number;
    lastMessage: LastMessage | null;
    members?: Array<{
      userId: string;
      user: { id: string; fullName: string; avatarUrl: string | null };
    }>;
    participants?: Participant[];
  }>;

  // Transform members → participants
  const conversations: ConversationData[] = rawConversations.map((conv) => ({
    id: conv.id,
    isGroup: conv.isGroup,
    name: conv.name,
    lastMessage: conv.lastMessage,
    unreadCount: conv.unreadCount,
    participants:
      conv.participants ??
      (conv.members ?? []).map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        isOnline: conv.isOnline,
      })),
  }));
  const { data: usersRaw } = useSearchUsers(debouncedQuery);
  const searchedUsers = ((usersRaw as { data?: UserResult[] })?.data ?? []) as UserResult[];

  const getOrCreate = useGetOrCreateConversation();
  const isSearching = searchQuery.trim().length > 0;
  const query = searchQuery.toLowerCase();

  const filteredConversations = isSearching
    ? conversations.filter((conv) => {
        if (conv.isGroup && conv.name) return conv.name.toLowerCase().includes(query);
        return conv.participants.some(
          (p) => p.id !== currentUser?.id && p.fullName.toLowerCase().includes(query),
        );
      })
    : conversations;

  const handleMutateSuccess = useCallback(
    (result: unknown) => {
      const conv = (result as { data?: { id: string } })?.data;
      if (conv?.id) {
        onSelectConversation(conv.id);
        setSearchQuery('');
      }
    },
    [onSelectConversation],
  );

  const handleUserClick = useCallback(
    (userId: string) => {
      getOrCreate.mutate({ participantId: userId }, { onSuccess: handleMutateSuccess });
    },
    [getOrCreate, handleMutateSuccess],
  );

  const handleCreateGroup = useCallback(
    (name: string, participantIds: string[]) => {
      getOrCreate.mutate(
        { participantId: participantIds[0], participantIds, isGroup: true, name },
        {
          onSuccess: (result) => {
            const conv = (result as { data?: { id: string } })?.data;
            if (conv?.id) {
              onSelectConversation(conv.id);
              setShowNewGroup(false);
            }
          },
        },
      );
    },
    [getOrCreate, onSelectConversation],
  );

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('title')}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowNewGroup(true)}
              title={t('newGroup')}
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="bg-muted/50 pl-9"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <>
              {/* Filtered conversations */}
              {filteredConversations.length > 0 && (
                <div>
                  <p className="text-muted-foreground px-4 py-1.5 text-xs font-semibold uppercase">
                    {t('conversations')}
                  </p>
                  {filteredConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === activeConversationId}
                      currentUserId={currentUser?.id ?? ''}
                      onClick={onSelectConversation}
                    />
                  ))}
                </div>
              )}

              {/* People search results */}
              {searchedUsers.length > 0 && (
                <div>
                  <p className="text-muted-foreground px-4 py-1.5 text-xs font-semibold uppercase">
                    {t('searchUsers')}
                  </p>
                  {searchedUsers.map((user) => (
                    <UserSearchItem key={user.id} user={user} onClick={handleUserClick} />
                  ))}
                </div>
              )}

              {filteredConversations.length === 0 && searchedUsers.length === 0 && (
                <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                  {t('noConversations')}
                </div>
              )}
            </>
          ) : (
            <>
              {conversations.length > 0 ? (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    currentUserId={currentUser?.id ?? ''}
                    onClick={onSelectConversation}
                  />
                ))
              ) : (
                <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                  {t('noConversations')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Group Dialog */}
      <NewGroupDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        onCreate={handleCreateGroup}
        isCreating={getOrCreate.isPending}
      />
    </>
  );
}
