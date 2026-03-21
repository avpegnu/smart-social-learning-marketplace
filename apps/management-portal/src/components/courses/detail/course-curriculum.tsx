'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Video, FileText, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@shared/ui';
import { formatPrice } from '@shared/utils';
import { LessonDetailDialog } from './lesson-detail-dialog';

const LESSON_TYPE_ICONS = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: HelpCircle,
} as const;

const LESSON_TYPE_COLORS = {
  VIDEO: 'text-blue-500',
  TEXT: 'text-green-500',
  QUIZ: 'text-orange-500',
} as const;

interface CourseCurriculumProps {
  sections: Array<Record<string, unknown>>;
}

export function CourseCurriculum({ sections }: CourseCurriculumProps) {
  const t = useTranslations('courseDetail');
  const [selectedLesson, setSelectedLesson] = useState<Record<string, unknown> | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  const toggleSection = (idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleChapter = (key: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="border-border space-y-4 rounded-lg border p-6">
      <h2 className="text-lg font-semibold">{t('curriculum')}</h2>

      {sections.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noCurriculum')}</p>
      ) : (
        <div className="space-y-3">
          {sections.map((section, sIdx) => {
            const chapters = (section.chapters as Array<Record<string, unknown>>) ?? [];
            const sectionCollapsed = collapsedSections.has(sIdx);

            return (
              <div key={section.id as string} className="border-border rounded-md border">
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="bg-muted/50 hover:bg-muted flex w-full items-center justify-between px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {sectionCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <h3 className="text-sm font-semibold">
                      {t('sectionN', { n: sIdx + 1 })}: {section.title as string}
                    </h3>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {chapters.length} {t('chapters')}
                  </span>
                </button>

                {/* Chapters */}
                {!sectionCollapsed && (
                  <div className="divide-border divide-y">
                    {chapters.map((chapter, chIdx) => {
                      const lessons = (chapter.lessons as Array<Record<string, unknown>>) ?? [];
                      const chapterKey = `${sIdx}-${chIdx}`;
                      const chapterCollapsed = collapsedChapters.has(chapterKey);
                      const chapterPrice = (chapter.price as number) ?? 0;
                      const isFreePreview = chapter.isFreePreview as boolean;

                      return (
                        <div key={chapter.id as string} className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleChapter(chapterKey)}
                            className="flex w-full items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {chapterCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              <h4 className="text-sm font-medium">
                                {t('chapterN', { n: chIdx + 1 })}: {chapter.title as string}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2">
                              {isFreePreview && (
                                <Badge variant="outline" className="text-xs">
                                  {t('freePreview')}
                                </Badge>
                              )}
                              {chapterPrice > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  {formatPrice(chapterPrice)}
                                </span>
                              )}
                              <span className="text-muted-foreground text-xs">
                                {lessons.length} {t('lessons')}
                              </span>
                            </div>
                          </button>

                          {/* Lessons */}
                          {!chapterCollapsed && lessons.length > 0 && (
                            <div className="mt-2 space-y-0.5 pl-6">
                              {lessons.map((lesson) => {
                                const type = lesson.type as keyof typeof LESSON_TYPE_ICONS;
                                const TypeIcon = LESSON_TYPE_ICONS[type] ?? FileText;
                                const color = LESSON_TYPE_COLORS[type] ?? '';
                                const duration = (lesson.estimatedDuration as number) ?? 0;

                                return (
                                  <button
                                    key={lesson.id as string}
                                    type="button"
                                    onClick={() => setSelectedLesson(lesson)}
                                    className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
                                  >
                                    <TypeIcon className={`h-4 w-4 ${color}`} />
                                    <span className="flex-1 text-sm">{lesson.title as string}</span>
                                    {duration > 0 && (
                                      <span className="text-muted-foreground text-xs">
                                        {Math.floor(duration / 60)}:
                                        {String(duration % 60).padStart(2, '0')}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {type.toLowerCase()}
                                    </Badge>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lesson Detail Dialog */}
      <LessonDetailDialog lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
    </div>
  );
}
