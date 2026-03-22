'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, BookOpen, ShoppingCart } from 'lucide-react';
import { Badge, Button } from '@shared/ui';
import { formatDuration, formatPrice } from '@shared/utils';
import { toast } from 'sonner';
import type { ApiSection, ApiChapter } from './types';
import { LESSON_ICONS } from './types';

interface CourseCurriculumProps {
  sections: ApiSection[];
  totalLessons: number;
  totalDuration: number;
  onAddChapterToCart?: (chapter: ApiChapter) => void;
}

export function CourseCurriculum({
  sections,
  totalLessons,
  totalDuration,
  onAddChapterToCart,
}: CourseCurriculumProps) {
  const t = useTranslations('courseDetail');
  const [expandedSections, setExpandedSections] = useState<string[]>(
    sections.length > 0 ? [sections[0].id] : [],
  );
  const [expandedChapters, setExpandedChapters] = useState<string[]>(
    sections.length > 0 && sections[0].chapters.length > 0 ? [sections[0].chapters[0].id] : [],
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    );
  };

  let totalChapters = 0;
  for (const section of sections) {
    totalChapters += section.chapters.length;
  }

  return (
    <div>
      <div className="text-muted-foreground mb-4 text-sm">
        {sections.length} {t('sections')} &bull; {totalChapters} {t('chapters')} &bull;{' '}
        {totalLessons} {t('lessons')} &bull; {formatDuration(totalDuration)}
      </div>
      <div className="border-border overflow-hidden rounded-xl border">
        {sections.map((section) => (
          <div key={section.id} className="border-border border-b last:border-0">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="hover:bg-accent/50 flex w-full cursor-pointer items-center px-4 py-3 transition-colors"
            >
              {expandedSections.includes(section.id) ? (
                <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="mr-2 h-4 w-4 shrink-0" />
              )}
              <span className="flex-1 text-left text-sm font-semibold">{section.title}</span>
              <span className="text-muted-foreground text-xs">
                {section.chapters.length} {t('chapters')}
              </span>
            </button>

            {/* Chapters + Lessons */}
            {expandedSections.includes(section.id) && (
              <div className="bg-muted/30">
                {section.chapters.map((chapter) => (
                  <div key={chapter.id}>
                    {/* Chapter header */}
                    <div className="border-border/50 flex items-center gap-2 border-t px-6 py-2.5">
                      <button
                        onClick={() => toggleChapter(chapter.id)}
                        className="flex flex-1 cursor-pointer items-center gap-2"
                      >
                        {expandedChapters.includes(chapter.id) ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="text-left text-sm font-medium">{chapter.title}</span>
                      </button>
                      {chapter.isFreePreview && (
                        <Badge variant="outline" className="text-xs">
                          {t('freePreview')}
                        </Badge>
                      )}
                      {chapter.price != null && chapter.price > 0 && !chapter.isFreePreview && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onAddChapterToCart?.(chapter)}
                        >
                          <ShoppingCart className="h-3 w-3" />
                          {formatPrice(chapter.price)}
                        </Button>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {chapter.lessons.length} {t('lessons')}
                      </span>
                    </div>
                    {/* Lessons */}
                    {expandedChapters.includes(chapter.id) &&
                      chapter.lessons.map((lesson) => {
                        const LessonIcon = LESSON_ICONS[lesson.type] ?? BookOpen;
                        return (
                          <div
                            key={lesson.id}
                            className="border-border/30 flex items-center gap-3 border-t px-8 py-2 text-sm"
                          >
                            <LessonIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                            <span className="flex-1">{lesson.title}</span>
                            {chapter.isFreePreview && (
                              <Badge
                                variant="outline"
                                className="text-primary cursor-pointer text-xs"
                                onClick={() => toast.info(t('previewComingSoon'))}
                              >
                                {t('preview')}
                              </Badge>
                            )}
                            {lesson.estimatedDuration && (
                              <span className="text-muted-foreground text-xs">
                                {formatDuration(lesson.estimatedDuration)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
