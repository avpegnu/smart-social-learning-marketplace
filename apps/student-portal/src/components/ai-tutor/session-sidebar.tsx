'use client';

import { useTranslations } from 'next-intl';
import { Bot, Plus, Zap, AlertTriangle } from 'lucide-react';
import { Button, Progress } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '@/lib/utils';

interface SessionItem {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

interface Course {
  id: string;
  title: string;
}

interface SessionSidebarProps {
  courses: Course[];
  selectedCourseId: string;
  onCourseChange: (courseId: string) => void;
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewConversation: () => void;
  usageCount: number;
  dailyLimit: number;
}

export function SessionSidebar({
  courses,
  selectedCourseId,
  onCourseChange,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewConversation,
  usageCount,
  dailyLimit,
}: SessionSidebarProps) {
  const t = useTranslations('aiTutor');
  const usagePercent = (usageCount / dailyLimit) * 100;

  return (
    <>
      {/* Course Selector */}
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Bot className="text-primary h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold">{t('title')}</h2>
        </div>

        <select
          className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
        >
          <option value="">{t('selectCourse')}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        {selectedCourseId && (
          <Button variant="outline" className="w-full gap-2" size="sm" onClick={onNewConversation}>
            <Plus className="h-4 w-4" />
            {t('newSession')}
          </Button>
        )}
      </div>

      {/* Usage Counter */}
      <div className="px-4 py-2">
        <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {t('usage')}
          </span>
          <span>
            {usageCount}/{dailyLimit}
          </span>
        </div>
        <Progress value={usagePercent} className="h-1.5" />
      </div>

      {/* Session List */}
      <div className="mt-2 flex-1 overflow-y-auto">
        {!selectedCourseId ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            {courses.length === 0 ? t('noCourses') : t('selectCourseHint')}
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">{t('noSessions')}</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                'hover:bg-accent/50 w-full cursor-pointer px-4 py-3 text-left transition-colors',
                activeSessionId === session.id && 'bg-accent',
              )}
            >
              <span className="line-clamp-1 text-sm font-medium">
                {session.title ?? t('newSession')}
              </span>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                <span>
                  {session._count.messages} {t('messageCount')}
                </span>
                <span>{formatRelativeTime(session.updatedAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Disclaimer */}
      <div className="border-border border-t p-3">
        <p className="text-muted-foreground flex items-start gap-1.5 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {t('disclaimer')}
        </p>
      </div>
    </>
  );
}
