'use client';

import { useState, useMemo } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button, Input, Label, Badge } from '@shared/ui';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { useAdminTags, useCreateTag, useUpdateTag, useDeleteTag } from '@shared/hooks';
import { toast } from 'sonner';
import { useDebounce } from '@shared/hooks';

interface TagRow {
  id: string;
  name: string;
  slug: string;
  _count?: { courseTags: number };
}

export default function TagsPage() {
  const t = useTranslations('tags');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '20' };
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [page, debouncedSearch]);

  const { data, isLoading } = useAdminTags(params);
  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TagRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null);
  const [name, setName] = useState('');

  const meta = data?.meta as { total: number; totalPages: number } | undefined;
  const tags = (data?.data as TagRow[] | undefined) ?? [];
  const totalPages = meta?.totalPages ?? 1;
  const totalItems = meta?.total ?? 0;

  const openCreate = () => {
    setEditTarget(null);
    setName('');
    setFormOpen(true);
  };

  const openEdit = (tag: TagRow) => {
    setEditTarget(tag);
    setName(tag.name);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editTarget) {
      updateMutation.mutate(
        { id: editTarget.id, data: { name: name.trim() } },
        {
          onSuccess: () => {
            toast.success(t('tagUpdated'));
            setFormOpen(false);
          },
        },
      );
    } else {
      createMutation.mutate(
        { name: name.trim() },
        {
          onSuccess: () => {
            toast.success(t('tagCreated'));
            setFormOpen(false);
          },
        },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t('tagDeleted'));
        setDeleteTarget(null);
      },
    });
  };

  const columns: Column<TagRow>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (tag) => <span className="font-medium">{tag.name}</span>,
    },
    {
      key: 'slug',
      header: t('slug'),
      render: (tag) => <span className="text-muted-foreground text-sm">{tag.slug}</span>,
    },
    {
      key: 'courseCount',
      header: t('courseCount'),
      render: (tag) => <Badge variant="secondary">{tag._count?.courseTags ?? 0}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (tag) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(tag)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setDeleteTarget(tag)}
            disabled={(tag._count?.courseTags ?? 0) > 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addTag')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
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

      <DataTable
        columns={columns}
        data={tags}
        isLoading={isLoading}
        pageSize={20}
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
            className="fixed inset-0 z-9999 flex items-center justify-center"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
            <div
              className="border-border bg-background relative z-10 mx-4 w-full max-w-md rounded-xl border p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 opacity-70 hover:opacity-100"
                onClick={() => setFormOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="mb-4 text-lg font-semibold">
                {editTarget ? t('editTag') : t('addTag')}
              </h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t('name')} *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('tagNamePlaceholder')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFormOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
                >
                  {editTarget ? t('save') : t('create')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('confirmDelete')}
        description={t('confirmDeleteDesc', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('delete')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
