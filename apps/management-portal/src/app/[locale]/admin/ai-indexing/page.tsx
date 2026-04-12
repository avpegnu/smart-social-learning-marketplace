'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Brain, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';
import { useIndexStatus, useIndexCourse, useBulkIndexCourses } from '@shared/hooks';
import type { IndexStatusItem } from '@shared/hooks';
import { toast } from 'sonner';

export default function AiIndexingPage() {
  const t = useTranslations('aiIndexing');

  // Local state: which course IDs are currently being indexed (for per-row spinner)
  const [indexingIds, setIndexingIds] = useState<Set<string>>(new Set());
  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useIndexStatus();
  const indexCourseMutation = useIndexCourse();
  const bulkIndexMutation = useBulkIndexCourses();

  const items: IndexStatusItem[] = (data as { data?: IndexStatusItem[] })?.data ?? [];

  const indexedCount = useMemo(() => items.filter((i) => i.chunkCount > 0).length, [items]);
  const unindexedCount = useMemo(() => items.filter((i) => i.chunkCount === 0).length, [items]);

  // ── Selection helpers ──

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const handleSelectAll = (checked: boolean) =>
    setSelectedIds(checked ? new Set(items.map((i) => i.courseId)) : new Set());

  const handleSelectOne = (courseId: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(courseId);
      else next.delete(courseId);
      return next;
    });

  // ── Index helpers ──

  const addIndexing = (ids: string[]) => setIndexingIds((prev) => new Set([...prev, ...ids]));

  const removeIndexing = (ids: string[]) =>
    setIndexingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  const handleIndexOne = async (courseId: string) => {
    addIndexing([courseId]);
    try {
      await indexCourseMutation.mutateAsync(courseId);
      toast.success(t('indexSuccess'));
    } finally {
      removeIndexing([courseId]);
    }
  };

  const handleBulkIndex = async (ids: string[]) => {
    if (ids.length === 0) return;
    addIndexing(ids);
    try {
      const result = await bulkIndexMutation.mutateAsync(ids);
      if (result.failed === 0) {
        toast.success(t('bulkIndexSuccess', { count: result.indexed }));
      } else {
        toast.warning(t('bulkIndexPartial', { indexed: result.indexed, failed: result.failed }));
      }
      setSelectedIds(new Set());
    } finally {
      removeIndexing(ids);
    }
  };

  const unindexedIds = items.filter((i) => i.chunkCount === 0).map((i) => i.courseId);
  const someSelected = selectedIds.size > 0;
  const isBulkRunning = bulkIndexMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <Brain className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>

          {unindexedCount > 0 && (
            <Button onClick={() => handleBulkIndex(unindexedIds)} disabled={isBulkRunning}>
              {isBulkRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-2 h-4 w-4" />
              )}
              {t('indexAllUnindexed', { count: unindexedCount })}
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('totalCourses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{items.length}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('indexedCourses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {indexedCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('notIndexedCount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-destructive text-2xl font-bold">{unindexedCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-lg border px-4 py-2">
          <span className="text-sm font-medium">
            {t('selectedCount', { count: selectedIds.size })}
          </span>
          <Button
            size="sm"
            onClick={() => handleBulkIndex(Array.from(selectedIds))}
            disabled={isBulkRunning}
          >
            {isBulkRunning ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Brain className="mr-2 h-3 w-3" />
            )}
            {t('indexSelected', { count: selectedIds.size })}
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={isLoading || items.length === 0}
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('course')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('status')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('chunks')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                  {t('lastIndexed')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium tracking-wide uppercase">
                  {t('action')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3" colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : items.map((item) => (
                    <CourseIndexRow
                      key={item.courseId}
                      item={item}
                      selected={selectedIds.has(item.courseId)}
                      indexing={indexingIds.has(item.courseId)}
                      onSelect={(checked) => handleSelectOne(item.courseId, checked)}
                      onIndex={() => handleIndexOne(item.courseId)}
                      t={t}
                    />
                  ))}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-4 py-10 text-center">
                    {t('noCourses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Sub-component: single course row ──

interface CourseIndexRowProps {
  item: IndexStatusItem;
  selected: boolean;
  indexing: boolean;
  onSelect: (checked: boolean) => void;
  onIndex: () => void;
  t: ReturnType<typeof useTranslations<'aiIndexing'>>;
}

function CourseIndexRow({ item, selected, indexing, onSelect, onIndex, t }: CourseIndexRowProps) {
  const isIndexed = item.chunkCount > 0;

  const lastIndexedLabel = item.lastIndexed
    ? new Date(item.lastIndexed).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('never');

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          disabled={indexing}
          className="cursor-pointer"
        />
      </td>

      <td className="px-4 py-3">
        <p className="leading-snug font-medium">{item.title}</p>
        <p className="text-muted-foreground font-mono text-xs">{item.courseId}</p>
      </td>

      <td className="px-4 py-3">
        {indexing ? (
          <Badge variant="outline" className="gap-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('indexing')}
          </Badge>
        ) : isIndexed ? (
          <Badge
            variant="outline"
            className="gap-1 border-0 bg-emerald-500/12 text-xs text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-3 w-3" />
            {t('indexed')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-destructive border-destructive/40 gap-1 text-xs">
            <AlertCircle className="h-3 w-3" />
            {t('notIndexed')}
          </Badge>
        )}
      </td>

      <td className="px-4 py-3">
        {isIndexed ? (
          <span className="font-medium">{item.chunkCount.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="text-muted-foreground px-4 py-3">{lastIndexedLabel}</td>

      <td className="px-4 py-3 text-right">
        <Button size="sm" variant="outline" onClick={onIndex} disabled={indexing}>
          {indexing ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          {isIndexed ? t('reIndex') : t('indexNow')}
        </Button>
      </td>
    </tr>
  );
}
