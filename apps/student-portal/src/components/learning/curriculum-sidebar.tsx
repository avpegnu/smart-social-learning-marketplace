'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Play,
  FileText,
  FileQuestion,
  BookOpen,
} from 'lucide-react';
import { Badge } from '@shared/ui';
import { formatDuration } from '@shared/utils';
import { cn } from '@/lib/utils';

// --- Types ---

interface SidebarLesson {
  id: string;
  title: string;
  type: string;
  estimatedDuration: number | null;
  isCompleted: boolean;
}

interface SidebarChapter {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  lessons: SidebarLesson[];
}

interface SidebarSection {
  id: string;
  title: string;
  order: number;
  chapters: SidebarChapter[];
}

const LESSON_ICONS: Record<string, typeof Play> = {
  VIDEO: Play,
  TEXT: FileText,
  QUIZ: FileQuestion,
};

interface CurriculumSidebarProps {
  curriculum: SidebarSection[];
  currentLessonId: string;
  onLessonClick: (lessonId: string) => void;
}

export function CurriculumSidebar({
  curriculum,
  currentLessonId,
  onLessonClick,
}: CurriculumSidebarProps) {
  const t = useTranslations('learning');

  // Auto-expand section containing current lesson
  const currentSectionId = curriculum.find((s) =>
    s.chapters.some((c) => c.lessons.some((l) => l.id === currentLessonId)),
  )?.id;
  const [expandedSections, setExpandedSections] = useState<string[]>(
    currentSectionId ? [currentSectionId] : curriculum.length > 0 ? [curriculum[0].id] : [],
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  return (
    <div className="border-border bg-background flex h-full flex-col border-l">
      <div className="border-border border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t('curriculum')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {curriculum.map((section) => (
          <div key={section.id} className="border-border border-b last:border-0">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left transition-colors"
            >
              {expandedSections.includes(section.id) ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="flex-1 text-xs font-semibold">{section.title}</span>
            </button>

            {/* Chapters + Lessons */}
            {expandedSections.includes(section.id) &&
              section.chapters.map((chapter) => (
                <div key={chapter.id}>
                  {/* Chapter header */}
                  <div className="text-muted-foreground flex items-center gap-2 px-6 py-1.5">
                    <span className="flex-1 text-xs font-medium">{chapter.title}</span>
                    {chapter.isFreePreview && (
                      <Badge variant="outline" className="h-4 text-[10px]">
                        {t('free')}
                      </Badge>
                    )}
                  </div>
                  {/* Lessons */}
                  {chapter.lessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLessonId;
                    const Icon = LESSON_ICONS[lesson.type] ?? BookOpen;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onLessonClick(lesson.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 px-8 py-2 text-left transition-colors',
                          isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50',
                        )}
                      >
                        {lesson.isCompleted ? (
                          <CheckCircle2 className="text-success h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Circle className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        )}
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="flex-1 text-xs">{lesson.title}</span>
                        {lesson.estimatedDuration && (
                          <span className="text-muted-foreground text-[10px]">
                            {formatDuration(lesson.estimatedDuration)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
