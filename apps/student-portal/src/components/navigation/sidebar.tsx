'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  FileText,
  Bot,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle2,
  Clock,
  FileQuestion,
} from 'lucide-react';
import { useState } from 'react';

interface SidebarSection {
  id: string;
  title: string;
  lessons: {
    id: string;
    title: string;
    duration: string;
    type: 'video' | 'quiz' | 'exercise' | 'reading';
    isCompleted?: boolean;
    isActive?: boolean;
  }[];
}

interface LearningSidebarProps {
  sections: SidebarSection[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onLessonClick?: (lessonId: string) => void;
}

const lessonIcons = {
  video: Play,
  quiz: FileQuestion,
  exercise: FileText,
  reading: BookOpen,
};

export function LearningSidebar({
  sections,
  activeTab = 'curriculum',
  onTabChange,
  onLessonClick,
}: LearningSidebarProps) {
  const t = useTranslations('learning');
  const [expandedSections, setExpandedSections] = useState<string[]>([sections[0]?.id]);

  const tabs = [
    { key: 'curriculum', label: t('curriculum'), icon: BookOpen },
    { key: 'notes', label: t('notes'), icon: FileText },
    { key: 'aiTutor', label: t('aiTutor'), icon: Bot },
    { key: 'resources', label: t('resources'), icon: FolderOpen },
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  return (
    <div className="border-border bg-background flex h-full flex-col border-l">
      {/* Tabs */}
      <div className="border-border flex overflow-x-auto border-b">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange?.(key)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'curriculum' && (
          <div>
            {sections.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="hover:bg-accent/50 flex w-full cursor-pointer items-center px-4 py-3 text-sm font-medium transition-colors"
                >
                  {expandedSections.includes(section.id) ? (
                    <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  <span className="text-left">{section.title}</span>
                </button>
                {expandedSections.includes(section.id) && (
                  <div className="bg-muted/30">
                    {section.lessons.map((lesson) => {
                      const LessonIcon = lessonIcons[lesson.type];
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => onLessonClick?.(lesson.id)}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                            lesson.isActive
                              ? 'bg-primary/10 text-primary border-primary border-l-2'
                              : 'hover:bg-accent/50 border-l-2 border-transparent',
                          )}
                        >
                          {lesson.isCompleted ? (
                            <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                          ) : (
                            <LessonIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                          )}
                          <span className="line-clamp-1 flex-1 text-left">{lesson.title}</span>
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {lesson.duration}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {activeTab === 'notes' && (
          <div className="text-muted-foreground mt-8 p-4 text-center text-sm">{t('noNotes')}</div>
        )}
        {activeTab === 'aiTutor' && (
          <div className="text-muted-foreground mt-8 p-4 text-center text-sm">
            {t('aiTutorPrompt')}
          </div>
        )}
        {activeTab === 'resources' && (
          <div className="text-muted-foreground mt-8 p-4 text-center text-sm">
            {t('noResources')}
          </div>
        )}
      </div>
    </div>
  );
}
