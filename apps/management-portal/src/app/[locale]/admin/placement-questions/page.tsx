'use client';

import { useState, useMemo } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button, Input, Label, Badge, Select } from '@shared/ui';
import type { SelectOption } from '@shared/ui';
import { Plus, Pencil, Trash2, X, Search, CirclePlus, CircleMinus, FileText } from 'lucide-react';
import {
  useAdminPlacementQuestions,
  useCreatePlacementQuestion,
  useUpdatePlacementQuestion,
  useDeletePlacementQuestion,
  useCreatePlacementQuestionsBatch,
  useTags,
  useDebounce,
} from '@shared/hooks';
import { toast } from 'sonner';
import {
  ImportTextDialog,
  type ImportedPlacementQuestion,
} from '@/components/placement/import-text-dialog';

// ── Types ──

interface PlacementOption {
  id: string;
  text: string;
}

interface QuestionRow {
  id: string;
  question: string;
  options: PlacementOption[];
  answer: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  tagIds: string[];
  createdAt: string;
}

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

const LEVEL_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  BEGINNER: 'secondary',
  INTERMEDIATE: 'default',
  ADVANCED: 'destructive',
};

// ── Component ──

export default function PlacementQuestionsPage() {
  const t = useTranslations('placementQuestions');

  // List state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const debouncedSearch = useDebounce(search, 300);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QuestionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Form fields
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PlacementOption[]>([
    { id: 'a', text: '' },
    { id: 'b', text: '' },
    { id: 'c', text: '' },
    { id: 'd', text: '' },
  ]);
  const [answer, setAnswer] = useState('');
  const [level, setLevel] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Data
  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '15', sort, order };
    if (debouncedSearch) p.search = debouncedSearch;
    if (levelFilter) p.level = levelFilter;
    return p;
  }, [page, debouncedSearch, levelFilter, sort, order]);

  const { data, isLoading } = useAdminPlacementQuestions(params);
  const { data: tagsData } = useTags();
  const createMutation = useCreatePlacementQuestion();
  const updateMutation = useUpdatePlacementQuestion();
  const deleteMutation = useDeletePlacementQuestion();
  const batchMutation = useCreatePlacementQuestionsBatch();

  const meta = data?.meta as { total: number; totalPages: number } | undefined;
  const questions = (data?.data as QuestionRow[] | undefined) ?? [];
  const totalPages = meta?.totalPages ?? 1;
  const totalItems = meta?.total ?? 0;

  const allTags = (tagsData?.data as Array<{ id: string; name: string; slug: string }>) ?? [];
  const tagMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const tag of allTags) m.set(tag.id, tag.name);
    return m;
  }, [allTags]);

  // Sort options
  const sortOptions: SelectOption[] = [
    { value: 'createdAt-desc', label: t('sortNewest') },
    { value: 'createdAt-asc', label: t('sortOldest') },
    { value: 'level-asc', label: t('sortLevel') },
  ];

  // Level filter options
  const levelFilterOptions: SelectOption[] = [
    { value: '', label: t('allLevels') },
    ...LEVELS.map((l) => ({ value: l, label: t(l.toLowerCase() as 'beginner') })),
  ];

  // Answer options for form
  const answerOptions: SelectOption[] = options
    .filter((o) => o.id.trim())
    .map((o) => ({ value: o.id, label: `${o.id.toUpperCase()}: ${o.text || '...'}` }));

  // Level options for form
  const levelOptions: SelectOption[] = LEVELS.map((l) => ({
    value: l,
    label: t(l.toLowerCase() as 'beginner'),
  }));

  // Tag options for form
  const tagOptions: SelectOption[] = allTags.map((tag) => ({
    value: tag.id,
    label: tag.name,
  }));

  // ── Handlers ──

  const resetForm = () => {
    setQuestion('');
    setOptions([
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ]);
    setAnswer('');
    setLevel('');
    setSelectedTagIds([]);
  };

  const openCreate = () => {
    setEditTarget(null);
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (row: QuestionRow) => {
    setEditTarget(row);
    setQuestion(row.question);
    setOptions(
      row.options.length > 0
        ? row.options.map((o) => ({ id: o.id, text: o.text }))
        : [
            { id: 'a', text: '' },
            { id: 'b', text: '' },
          ],
    );
    setAnswer(row.answer);
    setLevel(row.level);
    setSelectedTagIds(row.tagIds);
    setFormOpen(true);
  };

  const handleSave = () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !answer || !level || selectedTagIds.length === 0) return;

    const validOptions = options.filter((o) => o.id.trim() && o.text.trim());
    if (validOptions.length < 2) return;

    const payload = {
      question: trimmedQuestion,
      options: validOptions,
      answer,
      level,
      tagIds: selectedTagIds,
    };

    if (editTarget) {
      updateMutation.mutate(
        { id: editTarget.id, data: payload },
        {
          onSuccess: () => {
            toast.success(t('questionUpdated'));
            setFormOpen(false);
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(t('questionCreated'));
          setFormOpen(false);
        },
      });
    }
  };

  const handleImport = (imported: ImportedPlacementQuestion[]) => {
    if (imported.length === 0) return;
    batchMutation.mutate(imported, {
      onSuccess: () => {
        toast.success(t('importSuccess', { count: imported.length }));
        setImportOpen(false);
      },
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t('questionDeleted'));
        setDeleteTarget(null);
      },
    });
  };

  const updateOption = (index: number, field: 'id' | 'text', value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  };

  const addOption = () => {
    const nextId = String.fromCharCode(97 + options.length); // a, b, c, d, e...
    setOptions((prev) => [...prev, { id: nextId, text: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const removed = options[index];
    setOptions((prev) => prev.filter((_, i) => i !== index));
    if (removed && answer === removed.id) setAnswer('');
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  // ── Columns ──

  const columns: Column<QuestionRow>[] = [
    {
      key: 'question',
      header: t('question'),
      className: 'max-w-[400px]',
      render: (row) => (
        <div className="max-w-[400px]">
          <p className="line-clamp-2 text-sm font-medium">{row.question}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.tagIds.slice(0, 3).map((tagId) => (
              <Badge key={tagId} variant="outline" className="text-xs">
                {tagMap.get(tagId) ?? tagId.slice(0, 8)}
              </Badge>
            ))}
            {row.tagIds.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{row.tagIds.length - 3}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      header: t('level'),
      render: (row) => (
        <Badge variant={LEVEL_VARIANT[row.level] ?? 'secondary'}>
          {t(row.level.toLowerCase() as 'beginner')}
        </Badge>
      ),
    },
    {
      key: 'options',
      header: t('options'),
      render: (row) => {
        const opts = row.options as PlacementOption[];
        return (
          <div className="space-y-0.5">
            {opts.map((opt) => (
              <div key={opt.id} className="flex items-center gap-1 text-xs">
                <span
                  className={
                    opt.id === row.answer
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  }
                >
                  {opt.id.toUpperCase()}.
                </span>
                <span
                  className={opt.id === row.answer ? 'text-emerald-600 dark:text-emerald-400' : ''}
                >
                  {opt.text}
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-[80px]',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ──

  const canSave =
    question.trim().length >= 5 &&
    options.filter((o) => o.id.trim() && o.text.trim()).length >= 2 &&
    answer &&
    level &&
    selectedTagIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileText className="mr-1 h-4 w-4" />
            {t('importFromText')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {t('addQuestion')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <div className="w-40">
          <Select
            options={levelFilterOptions}
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('filterLevel')}
          />
        </div>
        <div className="w-40">
          <Select
            options={sortOptions}
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSort(s!);
              setOrder(o!);
              setPage(1);
            }}
            placeholder={t('sortNewest')}
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={questions}
        isLoading={isLoading}
        pageSize={15}
        serverPage={page}
        serverTotalPages={totalPages}
        serverTotal={totalItems}
        onServerPageChange={setPage}
      />

      {/* Create/Edit Dialog */}
      {formOpen &&
        typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto py-8"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
            <div
              className="border-border bg-background relative z-10 mx-4 w-full max-w-2xl rounded-xl border p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 opacity-70 hover:opacity-100"
                onClick={() => setFormOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="mb-4 text-lg font-semibold">
                {editTarget ? t('editQuestion') : t('addQuestion')}
              </h2>

              <div className="space-y-4">
                {/* Question text */}
                <div className="space-y-1">
                  <Label>{t('questionText')} *</Label>
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t('questionPlaceholder')}
                  />
                </div>

                {/* Options */}
                <div className="space-y-1">
                  <Label>{t('options')} *</Label>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          className="w-14 text-center"
                          value={opt.id}
                          onChange={(e) => updateOption(i, 'id', e.target.value)}
                          placeholder={t('optionId')}
                        />
                        <Input
                          className="flex-1"
                          value={opt.text}
                          onChange={(e) => updateOption(i, 'text', e.target.value)}
                          placeholder={t('optionPlaceholder', { n: i + 1 })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(i)}
                          disabled={options.length <= 2}
                          className="text-muted-foreground shrink-0"
                        >
                          <CircleMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {options.length < 6 && (
                      <Button variant="outline" size="sm" onClick={addOption}>
                        <CirclePlus className="mr-1 h-4 w-4" />
                        {t('addOption')}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Correct answer + Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{t('correctAnswer')} *</Label>
                    <Select
                      options={answerOptions}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={t('selectCorrectAnswer')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('level')} *</Label>
                    <Select
                      options={levelOptions}
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder={t('selectLevel')}
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-1">
                  <Label>{t('tags')} *</Label>
                  <div className="border-border max-h-40 overflow-y-auto rounded-md border p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {tagOptions.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.value);
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => toggleTag(tag.value)}
                            className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFormOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!canSave || createMutation.isPending || updateMutation.isPending}
                >
                  {editTarget ? t('save') : t('create')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Import from Bank */}
      <ImportTextDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('confirmDelete')}
        description={t('confirmDeleteDesc')}
        confirmLabel={t('delete')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
