'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAiQuota,
  useAiSessions,
  useSessionMessages,
  useMyLearning,
  useAuthStore,
} from '@shared/hooks';
import { SessionSidebar } from '@/components/ai-tutor/session-sidebar';
import { ChatPanel } from '@/components/ai-tutor/chat-panel';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
}

interface SessionItem {
  id: string;
  courseId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

const DEFAULT_DAILY_LIMIT = 10;

export default function AiTutorPage() {
  const t = useTranslations('aiTutor');
  const user = useAuthStore((s) => s.user);

  // Course selection
  const { data: learningRaw } = useMyLearning();
  const learningData = learningRaw as
    | { data?: Array<{ course: { id: string; title: string } }> }
    | undefined;
  const enrolledCourses = (learningData?.data ?? []).map((e) => e.course);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Sessions
  const { data: sessionsRaw } = useAiSessions(selectedCourseId || undefined);
  const sessions = ((sessionsRaw as { data?: SessionItem[] } | undefined)?.data ??
    (sessionsRaw as SessionItem[] | undefined)) as SessionItem[] | undefined;
  const sessionList = Array.isArray(sessions) ? sessions : [];

  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Messages
  const { data: messagesRaw } = useSessionMessages(activeSessionId ?? '');
  const sessionMessages = ((messagesRaw as { data?: ChatMsg[] } | undefined)?.data ??
    (messagesRaw as ChatMsg[] | undefined)) as ChatMsg[] | undefined;

  // Quota
  const { data: quotaRaw } = useAiQuota();
  const quota = (
    quotaRaw as { data?: { used: number; limit: number; remaining: number } } | undefined
  )?.data;
  const usageCount = quota?.used ?? 0;
  const dailyLimit = quota?.limit ?? DEFAULT_DAILY_LIMIT;

  // State
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // Sync session messages
  useEffect(() => {
    if (sessionMessages) {
      setLocalMessages(
        sessionMessages.map((m, i) => ({
          id: m.id ?? `msg-${i}`,
          role: m.role,
          content: m.content,
        })),
      );
    }
  }, [sessionMessages]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      setLocalMessages([]);
      setStreamingContent('');
      setShowSidebar(false);
    },
    [activeSessionId],
  );

  const handleNewConversation = useCallback(() => {
    setActiveSessionId(null);
    setLocalMessages([]);
    setStreamingContent('');
    setShowSidebar(false);
  }, []);

  const handleCourseChange = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveSessionId(null);
    setLocalMessages([]);
  }, []);

  return (
    <div className="flex h-full">
      <div className="bg-background flex w-full overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'border-border flex w-full shrink-0 flex-col border-r sm:w-72',
            !showSidebar ? 'hidden sm:flex' : 'flex',
          )}
        >
          <SessionSidebar
            courses={enrolledCourses}
            selectedCourseId={selectedCourseId}
            onCourseChange={handleCourseChange}
            sessions={sessionList}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewConversation={handleNewConversation}
            usageCount={usageCount}
            dailyLimit={dailyLimit}
          />
        </div>

        {/* Chat */}
        <div className={cn('flex flex-1 flex-col', showSidebar ? 'hidden sm:flex' : 'flex')}>
          {selectedCourseId ? (
            <ChatPanel
              messages={localMessages}
              setMessages={setLocalMessages}
              selectedCourseId={selectedCourseId}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
              input={input}
              setInput={setInput}
              isStreaming={isStreaming}
              setIsStreaming={setIsStreaming}
              streamingContent={streamingContent}
              setStreamingContent={setStreamingContent}
              isThinking={isThinking}
              setIsThinking={setIsThinking}
              usageCount={usageCount}
              dailyLimit={dailyLimit}
              userAvatar={user?.avatarUrl}
              userName={user?.fullName}
              onShowSidebar={() => setShowSidebar(true)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
              <div className="text-primary/30 mb-4 h-16 w-16">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 8V4m0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-6 8h12M6 20h12" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold">{t('welcomeTitle')}</h2>
              <p className="text-muted-foreground max-w-md text-sm">{t('welcomeDesc')}</p>
              <button
                className="text-primary mt-4 text-sm underline sm:hidden"
                onClick={() => setShowSidebar(true)}
              >
                {t('selectCourse')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
