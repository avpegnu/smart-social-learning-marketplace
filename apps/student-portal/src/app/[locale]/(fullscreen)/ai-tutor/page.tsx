'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAiSessions, useMyLearning, useAuthStore, useAiTutorChat } from '@shared/hooks';
import { SessionSidebar } from '@/components/ai-tutor/session-sidebar';
import { ChatPanel } from '@/components/ai-tutor/chat-panel';
import { cn } from '@/lib/utils';

interface SessionItem {
  id: string;
  courseId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

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

  // Sessions for the selected course
  const { data: sessionsRaw } = useAiSessions(selectedCourseId || undefined);
  const sessions = ((sessionsRaw as { data?: SessionItem[] } | undefined)?.data ??
    (sessionsRaw as SessionItem[] | undefined)) as SessionItem[] | undefined;
  const sessionList = Array.isArray(sessions) ? sessions : [];

  // Conversation state (sessions, messages, streaming, quota) — shared hook
  const chat = useAiTutorChat({ courseId: selectedCourseId });

  const [showSidebar, setShowSidebar] = useState(true);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      chat.selectSession(sessionId);
      setShowSidebar(false);
    },
    [chat.selectSession],
  );

  const handleNewConversation = useCallback(() => {
    chat.newSession();
    setShowSidebar(false);
  }, [chat.newSession]);

  const handleCourseChange = useCallback((courseId: string) => {
    // The conversation resets automatically when the hook's courseId changes.
    setSelectedCourseId(courseId);
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
            activeSessionId={chat.activeSessionId}
            onSelectSession={handleSelectSession}
            onNewConversation={handleNewConversation}
            usageCount={chat.usageCount}
            dailyLimit={chat.dailyLimit}
          />
        </div>

        {/* Chat */}
        <div className={cn('flex flex-1 flex-col', showSidebar ? 'hidden sm:flex' : 'flex')}>
          {selectedCourseId ? (
            <ChatPanel
              messages={chat.messages}
              streamingContent={chat.streamingContent}
              isThinking={chat.isThinking}
              isStreaming={chat.isStreaming}
              input={chat.input}
              setInput={chat.setInput}
              onSend={chat.send}
              canSend={chat.canSend}
              usageCount={chat.usageCount}
              dailyLimit={chat.dailyLimit}
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
