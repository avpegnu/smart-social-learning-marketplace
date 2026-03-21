'use client';

import { useState } from 'react';
import * as ReactDOM from 'react-dom';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button, Input, Label, Badge } from '@shared/ui';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@shared/hooks';
import { toast } from 'sonner';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  _count?: { courses: number };
  children?: CategoryRow[];
}

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const { data, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [name, setName] = useState('');

  const categories = (data?.data as CategoryRow[]) ?? [];

  // Flatten tree for DataTable display
  const flatCategories: (CategoryRow & { depth: number })[] = [];
  const flatten = (items: CategoryRow[], depth: number) => {
    for (const cat of items) {
      flatCategories.push({ ...cat, depth });
      if (cat.children?.length) flatten(cat.children, depth + 1);
    }
  };
  flatten(categories, 0);

  const openCreate = () => {
    setEditTarget(null);
    setName('');
    setFormOpen(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setEditTarget(cat);
    setName(cat.name);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editTarget) {
      updateMutation.mutate(
        {
          id: editTarget.id,
          data: { name: name.trim() },
        },
        {
          onSuccess: () => {
            toast.success(t('categoryUpdated'));
            setFormOpen(false);
          },
        },
      );
    } else {
      createMutation.mutate(
        { name: name.trim() },
        {
          onSuccess: () => {
            toast.success(t('categoryCreated'));
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
        toast.success(t('categoryDeleted'));
        setDeleteTarget(null);
      },
    });
  };

  const columns: Column<CategoryRow & { depth: number }>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (cat) => (
        <span style={{ paddingLeft: `${cat.depth * 24}px` }} className="font-medium">
          {cat.depth > 0 && '└ '}
          {cat.name}
        </span>
      ),
    },
    {
      key: 'slug',
      header: t('slug'),
      render: (cat) => <span className="text-muted-foreground text-sm">{cat.slug}</span>,
    },
    {
      key: 'courseCount',
      header: t('courseCount'),
      render: (cat) => <Badge variant="secondary">{cat._count?.courses ?? 0}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (cat) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setDeleteTarget(cat)}
            disabled={(cat._count?.courses ?? 0) > 0}
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
          {t('addCategory')}
        </Button>
      </div>

      <DataTable columns={columns} data={flatCategories} isLoading={isLoading} pageSize={20} />

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
                {editTarget ? t('editCategory') : t('addCategory')}
              </h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t('name')} *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('categoryNamePlaceholder')}
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
