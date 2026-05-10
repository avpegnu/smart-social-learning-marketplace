'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MessageCircle, Search, X } from 'lucide-react';
import { useAuthStore, useChatWindowsStore, useConversations } from '@shared/hooks';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { ChatPopoverItem } from './chat-popover-item';
import {
  type ChatConversationData,
  getConversationDisplayName,
  normalizeParticipants,
} from './types';

interface ChatPopoverProps {
  /** If provided, shows a "See all in Messenger" footer link that opens this href in a new tab. */
  seeAllHref?: string;
  /** Wrapper className — controls visibility (e.g. `hidden sm:inline-flex`). */
  className?: string;
}

const MAX_VISIBLE_CONVERSATIONS = 8;

export function ChatPopover({ seeAllHref, className }: ChatPopoverProps) {
  const t = useTranslations('chat');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);
  const openWindow = useChatWindowsStore((s) => s.openWindow);

  const { data: conversationsRaw, isLoading } = useConversations();
  const conversations = useMemo<ChatConversationData[]>(() => {
    const raw =
      (conversationsRaw as { data?: ChatConversationData[] })?.data ??
      (Array.isArray(conversationsRaw) ? (conversationsRaw as ChatConversationData[]) : []);
    return raw ?? [];
  }, [conversationsRaw]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    [conversations],
  );

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return conversations.slice(0, MAX_VISIBLE_CONVERSATIONS);
    return conversations.filter((conv) => {
      if (conv.isGroup && conv.name) return conv.name.toLowerCase().includes(trimmed);
      return normalizeParticipants(conv).some(
        (p) => p.id !== currentUser?.id && p.fullName.toLowerCase().includes(trimmed),
      );
    });
  }, [conversations, query, currentUser?.id]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!isAuthenticated) return null;

  const handleItemClick = (conversationId: string) => {
    openWindow(conversationId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        title={t('popoverTitle')}
        aria-label={t('popoverTitle')}
      >
        <MessageCircle className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </Button>

      {open && (
        <div className="bg-popover border-border absolute top-full right-0 z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-xl border shadow-xl sm:w-96">
          {/* Header */}
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{t('popoverTitle')}</h3>
            </div>
            {/* Search */}
            <div className="relative mt-3">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="bg-muted/60 placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-full border-0 py-1.5 pr-8 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                {t('noConversations')}
              </div>
            ) : (
              filtered.map((conv) => (
                <ChatPopoverItem
                  key={conv.id}
                  conversation={conv}
                  currentUserId={currentUser?.id}
                  unknownLabel={getConversationDisplayName(conv, currentUser?.id, '?')}
                  groupLabel={t('directMessage')}
                  youLabel={t('you')}
                  onClick={handleItemClick}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {seeAllHref && (
            <div className="border-t px-4 py-2">
              <a
                href={seeAllHref}
                className="text-primary block text-center text-sm font-medium hover:underline"
                onClick={() => setOpen(false)}
              >
                {t('seeAllInMessenger')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
