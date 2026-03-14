'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@shared/ui';
import { cn } from '@/lib/utils';
import {
  Plus,
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { curriculumSections, type Section, type Lesson } from '@/lib/mock-data';

const lessonTypeIcon: Record<string, React.ElementType> = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: HelpCircle,
};

const lessonTypeColor: Record<string, string> = {
  VIDEO: 'bg-info/10 text-info',
  TEXT: 'bg-success/10 text-success',
  QUIZ: 'bg-warning/10 text-warning',
};

export default function CurriculumPage() {
  const t = useTranslations('curriculum');
  const [sections, setSections] = React.useState<Section[]>(curriculumSections);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(
    curriculumSections.map((s) => s.id),
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const addSection = () => {
    const newSection: Section = {
      id: `s${Date.now()}`,
      title: `${t('section')} ${sections.length + 1}`,
      order: sections.length + 1,
      lessons: [],
    };
    setSections([...sections, newSection]);
    setExpandedSections([...expandedSections, newSection.id]);
  };

  const addLesson = (sectionId: string) => {
    setSections(
      sections.map((s) => {
        if (s.id === sectionId) {
          const newLesson: Lesson = {
            id: `l${Date.now()}`,
            title: `${t('lessonTitle')} ${s.lessons.length + 1}`,
            type: 'VIDEO',
            duration: '0:00',
            order: s.lessons.length + 1,
          };
          return { ...s, lessons: [...s.lessons, newLesson] };
        }
        return s;
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">React & Next.js Toan Dien 2025</p>
        </div>
        <Button onClick={addSection}>
          <Plus className="h-4 w-4" />
          {t('addSection')}
        </Button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);

          return (
            <Card key={section.id}>
              <CardHeader
                className="cursor-pointer py-3 select-none"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="text-muted-foreground h-5 w-5 cursor-grab" />
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="text-muted-foreground text-xs font-bold">
                    {t('section')} {section.order}
                  </span>
                  <CardTitle className="flex-1 text-base">{section.title}</CardTitle>
                  <span className="text-muted-foreground text-xs">
                    {section.lessons.length} lessons
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {section.lessons.map((lesson) => {
                      const Icon = lessonTypeIcon[lesson.type] || FileText;
                      return (
                        <div
                          key={lesson.id}
                          className="hover:bg-muted/50 flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors"
                        >
                          <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-md',
                              lessonTypeColor[lesson.type],
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1 text-sm font-medium">{lesson.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {t(lesson.type.toLowerCase() as 'video' | 'text' | 'quiz')}
                          </Badge>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {lesson.duration}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="text-destructive h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full border-dashed"
                      onClick={() => addLesson(section.id)}
                    >
                      <Plus className="h-4 w-4" />
                      {t('addLesson')}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
