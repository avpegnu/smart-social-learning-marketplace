'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Video,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Button, Input } from '@shared/ui';
import {
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useUpsertQuiz,
} from '@shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { LocalSection, LocalChapter, LocalLesson } from './course-wizard';
import { LessonDialog } from './lesson-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

// ── Types ──

let tempIdCounter = 0;
function generateTempId(): string {
  return `temp-${Date.now()}-${++tempIdCounter}`;
}

const LESSON_TYPE_ICONS = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: HelpCircle,
} as const;

const LESSON_TYPE_COLORS = {
  VIDEO: 'text-blue-500',
  TEXT: 'text-green-500',
  QUIZ: 'text-amber-500',
} as const;

// ── Props ──

interface StepCurriculumProps {
  courseId: string;
  sections: LocalSection[];
  onSectionsChange: (sections: LocalSection[]) => void;
  onPrevious: () => void;
  onNext: () => void;
  isReadOnly?: boolean;
}

// ── Component ──

export function StepCurriculum({
  courseId,
  sections,
  onSectionsChange,
  onPrevious,
  onNext,
  isReadOnly = false,
}: StepCurriculumProps) {
  const t = useTranslations('courseWizard');
  const [saving, setSaving] = useState(false);

  // Mutations
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const createChapter = useCreateChapter();
  const updateChapter = useUpdateChapter();
  const deleteChapter = useDeleteChapter();
  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const upsertQuiz = useUpsertQuiz();

  // Editing state
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  // Lesson dialog
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean;
    sectionId: string;
    chapterId: string;
    lesson?: LocalLesson;
  }>({ open: false, sectionId: '', chapterId: '' });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'section' | 'chapter' | 'lesson';
    sectionId: string;
    chapterId?: string;
    lessonId?: string;
  } | null>(null);

  // ── Section operations ──

  const addSection = useCallback(() => {
    const newSection: LocalSection = {
      tempId: generateTempId(),
      title: t('newSection'),
      order: sections.filter((s) => !s.isDeleted).length,
      chapters: [],
      isNew: true,
    };
    onSectionsChange([...sections, newSection]);
  }, [sections, onSectionsChange, t]);

  const startEditing = useCallback((id: string, currentValue: string) => {
    setEditingId(id);
    setEditValue(currentValue);
  }, []);

  const confirmEdit = useCallback(
    (tempId: string, type: 'section' | 'chapter') => {
      if (!editValue.trim()) {
        setEditingId(null);
        return;
      }
      onSectionsChange(
        sections.map((s) => {
          if (type === 'section' && s.tempId === tempId) {
            return { ...s, title: editValue, isModified: !s.isNew ? true : s.isModified };
          }
          if (type === 'chapter') {
            return {
              ...s,
              chapters: s.chapters.map((ch) =>
                ch.tempId === tempId
                  ? { ...ch, title: editValue, isModified: !ch.isNew ? true : ch.isModified }
                  : ch,
              ),
            };
          }
          return s;
        }),
      );
      setEditingId(null);
    },
    [editValue, sections, onSectionsChange],
  );

  const markDeleteSection = useCallback(
    (tempId: string) => {
      const section = sections.find((s) => s.tempId === tempId);
      if (!section) return;

      if (section.isNew) {
        // Remove from array (never created on server)
        onSectionsChange(sections.filter((s) => s.tempId !== tempId));
      } else {
        onSectionsChange(
          sections.map((s) => (s.tempId === tempId ? { ...s, isDeleted: true } : s)),
        );
      }
      setDeleteTarget(null);
    },
    [sections, onSectionsChange],
  );

  // ── Reorder operations ──

  const moveSection = useCallback(
    (tempId: string, direction: 'up' | 'down') => {
      const visible = sections.filter((s) => !s.isDeleted);
      const idx = visible.findIndex((s) => s.tempId === tempId);
      if (idx < 0) return;
      if (direction === 'up' && idx === 0) return;
      if (direction === 'down' && idx === visible.length - 1) return;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      const reordered = [...visible];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

      const deleted = sections.filter((s) => s.isDeleted);
      const updated = reordered.map((s, i) => ({
        ...s,
        order: i,
        isModified: s.isModified || !s.isNew,
      }));
      onSectionsChange([...updated, ...deleted]);
    },
    [sections, onSectionsChange],
  );

  const moveChapter = useCallback(
    (sectionTempId: string, chapterTempId: string, direction: 'up' | 'down') => {
      onSectionsChange(
        sections.map((s) => {
          if (s.tempId !== sectionTempId) return s;
          const visible = s.chapters.filter((ch) => !ch.isDeleted);
          const idx = visible.findIndex((ch) => ch.tempId === chapterTempId);
          if (idx < 0) return s;
          if (direction === 'up' && idx === 0) return s;
          if (direction === 'down' && idx === visible.length - 1) return s;

          const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
          const reordered = [...visible];
          [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

          const deleted = s.chapters.filter((ch) => ch.isDeleted);
          const updated = reordered.map((ch, i) => ({
            ...ch,
            order: i,
            isModified: ch.isModified || !ch.isNew,
          }));
          return { ...s, chapters: [...updated, ...deleted] };
        }),
      );
    },
    [sections, onSectionsChange],
  );

  const moveLesson = useCallback(
    (
      sectionTempId: string,
      chapterTempId: string,
      lessonTempId: string,
      direction: 'up' | 'down',
    ) => {
      onSectionsChange(
        sections.map((s) => {
          if (s.tempId !== sectionTempId) return s;
          return {
            ...s,
            chapters: s.chapters.map((ch) => {
              if (ch.tempId !== chapterTempId) return ch;
              const visible = ch.lessons.filter((l) => !l.isDeleted);
              const idx = visible.findIndex((l) => l.tempId === lessonTempId);
              if (idx < 0) return ch;
              if (direction === 'up' && idx === 0) return ch;
              if (direction === 'down' && idx === visible.length - 1) return ch;

              const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
              const reordered = [...visible];
              [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

              const deleted = ch.lessons.filter((l) => l.isDeleted);
              const updated = reordered.map((l, i) => ({
                ...l,
                order: i,
                isModified: l.isModified || !l.isNew,
              }));
              return { ...ch, lessons: [...updated, ...deleted] };
            }),
          };
        }),
      );
    },
    [sections, onSectionsChange],
  );

  // ── Chapter operations ──

  const addChapter = useCallback(
    (sectionTempId: string) => {
      onSectionsChange(
        sections.map((s) => {
          if (s.tempId !== sectionTempId) return s;
          const newChapter: LocalChapter = {
            tempId: generateTempId(),
            title: t('newChapter'),
            order: s.chapters.filter((ch) => !ch.isDeleted).length,
            sectionId: s.id,
            lessons: [],
            isNew: true,
          };
          return { ...s, chapters: [...s.chapters, newChapter] };
        }),
      );
    },
    [sections, onSectionsChange, t],
  );

  const markDeleteChapter = useCallback(
    (sectionTempId: string, chapterTempId: string) => {
      onSectionsChange(
        sections.map((s) => {
          if (s.tempId !== sectionTempId) return s;
          const chapter = s.chapters.find((ch) => ch.tempId === chapterTempId);
          if (!chapter) return s;

          if (chapter.isNew) {
            return { ...s, chapters: s.chapters.filter((ch) => ch.tempId !== chapterTempId) };
          }
          return {
            ...s,
            chapters: s.chapters.map((ch) =>
              ch.tempId === chapterTempId ? { ...ch, isDeleted: true } : ch,
            ),
          };
        }),
      );
      setDeleteTarget(null);
    },
    [sections, onSectionsChange],
  );

  // ── Lesson operations ──

  const handleLessonSave = useCallback(
    (lesson: LocalLesson) => {
      const { sectionId, chapterId } = lessonDialog;
      onSectionsChange(
        sections.map((s) => {
          if (s.tempId !== sectionId && s.id !== sectionId) return s;
          return {
            ...s,
            chapters: s.chapters.map((ch) => {
              if (ch.tempId !== chapterId && ch.id !== chapterId) return ch;

              // Edit existing lesson
              if (lesson.id || !lesson.isNew) {
                return {
                  ...ch,
                  lessons: ch.lessons.map((l) =>
                    l.tempId === lesson.tempId ? { ...lesson, isModified: !lesson.isNew } : l,
                  ),
                };
              }

              // New lesson
              return {
                ...ch,
                lessons: [
                  ...ch.lessons,
                  { ...lesson, order: ch.lessons.filter((l) => !l.isDeleted).length },
                ],
              };
            }),
          };
        }),
      );
      setLessonDialog({ open: false, sectionId: '', chapterId: '' });
    },
    [lessonDialog, sections, onSectionsChange],
  );

  const markDeleteLesson = useCallback(
    (sectionTempId: string, chapterTempId: string, lessonTempId: string) => {
      onSectionsChange(
        sections.map((s) => {
          if (s.tempId !== sectionTempId) return s;
          return {
            ...s,
            chapters: s.chapters.map((ch) => {
              if (ch.tempId !== chapterTempId) return ch;
              const lesson = ch.lessons.find((l) => l.tempId === lessonTempId);
              if (!lesson) return ch;

              if (lesson.isNew) {
                return { ...ch, lessons: ch.lessons.filter((l) => l.tempId !== lessonTempId) };
              }
              return {
                ...ch,
                lessons: ch.lessons.map((l) =>
                  l.tempId === lessonTempId ? { ...l, isDeleted: true } : l,
                ),
              };
            }),
          };
        }),
      );
      setDeleteTarget(null);
    },
    [sections, onSectionsChange],
  );

  // ── Batch save ──

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      // 1. Delete marked items (from server only, deepest first: lessons → chapters → sections)
      for (const section of sections) {
        for (const chapter of section.chapters) {
          for (const lesson of chapter.lessons) {
            if (lesson.isDeleted && lesson.id && chapter.id) {
              await deleteLesson.mutateAsync({
                courseId,
                chapterId: chapter.id,
                lessonId: lesson.id,
              });
            }
          }
          if (chapter.isDeleted && chapter.id && section.id) {
            await deleteChapter.mutateAsync({
              courseId,
              sectionId: section.id,
              chapterId: chapter.id,
            });
          }
        }
        if (section.isDeleted && section.id) {
          await deleteSection.mutateAsync({ courseId, sectionId: section.id });
        }
      }

      // 2. Create new sections, then new chapters, then new lessons
      const updatedSections = [...sections];
      for (let si = 0; si < updatedSections.length; si++) {
        const section = updatedSections[si];
        if (section.isDeleted) continue;

        if (section.isNew) {
          const res = await createSection.mutateAsync({
            courseId,
            data: { title: section.title, order: section.order },
          });
          updatedSections[si] = {
            ...section,
            id: (res.data as Record<string, unknown>).id as string,
            isNew: false,
          };
        } else if (section.isModified && section.id) {
          await updateSection.mutateAsync({
            courseId,
            sectionId: section.id,
            data: { title: section.title },
          });
          updatedSections[si] = { ...section, isModified: false };
        }

        const sectionId = updatedSections[si].id!;

        for (let ci = 0; ci < section.chapters.length; ci++) {
          const chapter = section.chapters[ci];
          if (chapter.isDeleted) continue;

          if (chapter.isNew) {
            const res = await createChapter.mutateAsync({
              courseId,
              sectionId,
              data: {
                title: chapter.title,
                description: chapter.description,
                order: chapter.order,
              },
            });
            updatedSections[si].chapters[ci] = {
              ...chapter,
              id: (res.data as Record<string, unknown>).id as string,
              sectionId,
              isNew: false,
            };
          } else if (chapter.isModified && chapter.id) {
            await updateChapter.mutateAsync({
              courseId,
              sectionId,
              chapterId: chapter.id,
              data: { title: chapter.title, description: chapter.description },
            });
            updatedSections[si].chapters[ci] = { ...chapter, isModified: false };
          }

          const chapterId = updatedSections[si].chapters[ci].id!;

          for (let li = 0; li < chapter.lessons.length; li++) {
            const lesson = chapter.lessons[li];
            if (lesson.isDeleted) continue;

            if (lesson.isNew) {
              const res = await createLesson.mutateAsync({
                courseId,
                chapterId,
                data: {
                  title: lesson.title,
                  type: lesson.type,
                  textContent: lesson.textContent,
                  videoUrl: lesson.videoUrl,
                  estimatedDuration: lesson.estimatedDuration,
                  order: lesson.order ?? li,
                },
              });
              const newLessonId = (res.data as Record<string, unknown>).id as string;
              updatedSections[si].chapters[ci].lessons[li] = {
                ...lesson,
                id: newLessonId,
                chapterId,
                isNew: false,
              };

              // Save quiz after lesson is created
              if (
                lesson.type === 'QUIZ' &&
                lesson.quizData &&
                lesson.quizData.questions.length > 0
              ) {
                await upsertQuiz.mutateAsync({
                  courseId,
                  lessonId: newLessonId,
                  data: lesson.quizData,
                });
              }
            } else if (lesson.isModified && lesson.id) {
              await updateLesson.mutateAsync({
                courseId,
                chapterId,
                lessonId: lesson.id,
                data: {
                  title: lesson.title,
                  textContent: lesson.textContent,
                  videoUrl: lesson.videoUrl,
                  estimatedDuration: lesson.estimatedDuration,
                },
              });

              // Update quiz if modified
              if (
                lesson.type === 'QUIZ' &&
                lesson.quizData &&
                lesson.quizData.questions.length > 0
              ) {
                await upsertQuiz.mutateAsync({
                  courseId,
                  lessonId: lesson.id,
                  data: lesson.quizData,
                });
              }
              updatedSections[si].chapters[ci].lessons[li] = { ...lesson, isModified: false };
            }
          }
        }
      }

      // Remove deleted items from state
      const cleanedSections = updatedSections
        .filter((s) => !s.isDeleted)
        .map((s) => ({
          ...s,
          chapters: s.chapters
            .filter((ch) => !ch.isDeleted)
            .map((ch) => ({
              ...ch,
              lessons: ch.lessons.filter((l) => !l.isDeleted),
            })),
        }));

      onSectionsChange(cleanedSections);
      // Invalidate once after all mutations complete
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
      toast.success(t('savedSuccess'));
      return true;
    } catch {
      toast.error(t('saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    sections,
    courseId,
    onSectionsChange,
    t,
    queryClient,
    createSection,
    updateSection,
    deleteSection,
    createChapter,
    updateChapter,
    deleteChapter,
    createLesson,
    updateLesson,
    deleteLesson,
    upsertQuiz,
  ]);

  const handleNext = useCallback(async () => {
    const success = await handleSave();
    if (success) onNext();
  }, [handleSave, onNext]);

  // Toggle collapse
  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSections = sections.filter((s) => !s.isDeleted);

  return (
    <div className="space-y-4">
      <fieldset disabled={isReadOnly} className={isReadOnly ? 'space-y-4 opacity-70' : 'space-y-4'}>
        {visibleSections.length === 0 && (
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            {t('noSections')}
          </div>
        )}

        {visibleSections.map((section) => (
          <div key={section.tempId} className="border-border bg-card rounded-lg border">
            {/* Section Header */}
            <div className="border-border flex items-center gap-2 border-b p-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveSection(section.tempId, 'up')}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={visibleSections.indexOf(section) === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(section.tempId, 'down')}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={visibleSections.indexOf(section) === visibleSections.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => toggleSection(section.tempId)}
                className="text-muted-foreground"
              >
                {collapsedSections.has(section.tempId) ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {editingId === section.tempId ? (
                <div className="flex flex-1 gap-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit(section.tempId, 'section');
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirmEdit(section.tempId, 'section')}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <span
                  className="flex-1 cursor-pointer font-medium"
                  onDoubleClick={() => startEditing(section.tempId, section.title)}
                >
                  {section.title}
                </span>
              )}

              <span className="text-muted-foreground text-sm">
                {section.chapters
                  .filter((ch) => !ch.isDeleted)
                  .reduce((sum, ch) => sum + ch.lessons.filter((l) => !l.isDeleted).length, 0)}{' '}
                {t('lessons')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => startEditing(section.tempId, section.title)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDeleteTarget({ type: 'section', sectionId: section.tempId })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Section Body (chapters) */}
            {!collapsedSections.has(section.tempId) && (
              <div className="space-y-3 p-3">
                {section.chapters
                  .filter((ch) => !ch.isDeleted)
                  .map((chapter) => (
                    <div
                      key={chapter.tempId}
                      className="border-border bg-background rounded-md border"
                    >
                      {/* Chapter Header */}
                      <div className="border-border flex items-center gap-2 border-b p-2">
                        {(() => {
                          const visibleChapters = section.chapters.filter((ch) => !ch.isDeleted);
                          const chIdx = visibleChapters.indexOf(chapter);
                          return (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => moveChapter(section.tempId, chapter.tempId, 'up')}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                disabled={chIdx === 0}
                              >
                                <ArrowUp className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChapter(section.tempId, chapter.tempId, 'down')}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                disabled={chIdx === visibleChapters.length - 1}
                              >
                                <ArrowDown className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => toggleChapter(chapter.tempId)}
                          className="text-muted-foreground"
                        >
                          {collapsedChapters.has(chapter.tempId) ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        {editingId === chapter.tempId ? (
                          <div className="flex flex-1 gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEdit(chapter.tempId, 'chapter');
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              className="h-7 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmEdit(chapter.tempId, 'chapter')}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="flex-1 cursor-pointer text-sm font-medium"
                            onDoubleClick={() => startEditing(chapter.tempId, chapter.title)}
                          >
                            {chapter.title}
                          </span>
                        )}

                        <span className="text-muted-foreground text-xs">
                          {chapter.lessons.filter((l) => !l.isDeleted).length} {t('lessons')}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(chapter.tempId, chapter.title)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'chapter',
                              sectionId: section.tempId,
                              chapterId: chapter.tempId,
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Chapter Body (lessons) */}
                      {!collapsedChapters.has(chapter.tempId) && (
                        <div className="space-y-1 p-2">
                          {chapter.lessons
                            .filter((l) => !l.isDeleted)
                            .map((lesson, lessonIdx, visibleLessons) => {
                              const TypeIcon = LESSON_TYPE_ICONS[lesson.type];
                              return (
                                <div
                                  key={lesson.tempId}
                                  className="hover:bg-accent flex items-center gap-2 rounded px-2 py-1.5"
                                >
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveLesson(
                                          section.tempId,
                                          chapter.tempId,
                                          lesson.tempId,
                                          'up',
                                        )
                                      }
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                      disabled={lessonIdx === 0}
                                    >
                                      <ArrowUp className="h-2 w-2" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveLesson(
                                          section.tempId,
                                          chapter.tempId,
                                          lesson.tempId,
                                          'down',
                                        )
                                      }
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                      disabled={lessonIdx === visibleLessons.length - 1}
                                    >
                                      <ArrowDown className="h-2 w-2" />
                                    </button>
                                  </div>
                                  <TypeIcon
                                    className={`h-4 w-4 ${LESSON_TYPE_COLORS[lesson.type]}`}
                                  />
                                  <span className="flex-1 text-sm">{lesson.title}</span>
                                  {lesson.estimatedDuration ? (
                                    <span className="text-muted-foreground text-xs">
                                      {Math.floor(lesson.estimatedDuration / 60)}:
                                      {String(lesson.estimatedDuration % 60).padStart(2, '0')}
                                    </span>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setLessonDialog({
                                        open: true,
                                        sectionId: section.tempId,
                                        chapterId: chapter.tempId,
                                        lesson,
                                      })
                                    }
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: 'lesson',
                                        sectionId: section.tempId,
                                        chapterId: chapter.tempId,
                                        lessonId: lesson.tempId,
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-5"
                            onClick={() => {
                              setLessonDialog({
                                open: true,
                                sectionId: section.tempId,
                                chapterId: chapter.tempId,
                              });
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {t('addLesson')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addChapter(section.tempId)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('addChapter')}
                </Button>
              </div>
            )}
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addSection}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addSection')}
        </Button>
      </fieldset>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onPrevious}>
          {t('previous')}
        </Button>
        <div className="flex gap-2">
          {!isReadOnly && (
            <>
              <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('saveDraft')}
              </Button>
              <Button type="button" onClick={handleNext} disabled={saving}>
                {saving ? t('saving') : t('saveAndNext')}
              </Button>
            </>
          )}
          {isReadOnly && (
            <Button type="button" onClick={onNext}>
              {t('next')}
            </Button>
          )}
        </div>
      </div>

      {/* Lesson Dialog */}
      <LessonDialog
        key={lessonDialog.lesson?.tempId ?? (lessonDialog.open ? 'new' : 'closed')}
        open={lessonDialog.open}
        lesson={lessonDialog.lesson}
        onSave={handleLessonSave}
        onClose={() => setLessonDialog({ open: false, sectionId: '', chapterId: '' })}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('deleteConfirm')}
        description={t('deleteWarning')}
        confirmLabel={t('delete')}
        variant="destructive"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'section') {
            markDeleteSection(deleteTarget.sectionId);
          } else if (deleteTarget.type === 'chapter' && deleteTarget.chapterId) {
            markDeleteChapter(deleteTarget.sectionId, deleteTarget.chapterId);
          } else if (
            deleteTarget.type === 'lesson' &&
            deleteTarget.chapterId &&
            deleteTarget.lessonId
          ) {
            markDeleteLesson(deleteTarget.sectionId, deleteTarget.chapterId, deleteTarget.lessonId);
          }
        }}
      />
    </div>
  );
}
