'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Search, Database } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Label,
  Textarea,
} from '@shared/ui';
import {
  useQuestionBanks,
  useCreateQuestionBank,
  useDeleteQuestionBank,
  useDebounce,
} from '@shared/hooks';
import { formatDate } from '@shared/utils';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

interface QuestionBank {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function QuestionBanksPage() {
  const t = useTranslations('questionBanks');
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const { data, isLoading } = useQuestionBanks({
    page,
    search: debouncedSearch || undefined,
  });
  const createBank = useCreateQuestionBank();
  const deleteBank = useDeleteQuestionBank();

  const banks = ((data as { data?: QuestionBank[] })?.data ?? []) as QuestionBank[];
  const meta = (data as { meta?: { page: number; totalPages: number } })?.meta;

  const handleCreate = () => {
    if (!newName.trim()) return;
    createBank.mutate(
      { name: newName.trim(), description: newDescription.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('bankCreated'));
          setShowCreate(false);
          setNewName('');
          setNewDescription('');
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteBank.mutate(deleteId, {
      onSuccess: () => {
        toast.success(t('bankDeleted'));
        setDeleteId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {banks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Database className="text-muted-foreground mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-sm">{t('noBanks')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead className="text-center">{t('questionCount')}</TableHead>
                  <TableHead>{t('updatedAt')}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow
                    key={bank.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/instructor/question-banks/${bank.id}`)}
                  >
                    <TableCell className="font-medium">{bank.name}</TableCell>
                    <TableCell>
                      <p className="text-muted-foreground line-clamp-2 max-w-xs text-sm">
                        {bank.description || '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{bank.questionCount}</TableCell>
                    <TableCell className="text-sm">{formatDate(bank.updatedAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(bank.id);
                        }}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: meta.totalPages }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i + 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <ConfirmDialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setNewName('');
            setNewDescription('');
          }
        }}
        title={t('create')}
        description=""
        confirmLabel={t('create')}
        onConfirm={handleCreate}
        isLoading={createBank.isPending}
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input
              placeholder={t('namePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Textarea
              placeholder={t('descriptionPlaceholder')}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('deleteBank')}
        description={t('confirmDeleteBank')}
        onConfirm={handleDelete}
        isLoading={deleteBank.isPending}
        variant="destructive"
      />
    </div>
  );
}
