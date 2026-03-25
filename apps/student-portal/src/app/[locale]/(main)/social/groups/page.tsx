'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Plus, Users, Loader2 } from 'lucide-react';
import { Button, Input } from '@shared/ui';
import { useGroups, useDebounce } from '@shared/hooks';
import { GroupCard } from '@/components/social/group-card';
import { CreateGroupDialog } from '@/components/social/create-group-dialog';
import { EmptyState } from '@/components/feedback/empty-state';

interface GroupOwner {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  privacy: 'PUBLIC' | 'PRIVATE';
  memberCount: number;
  owner: GroupOwner;
  isMember?: boolean;
  joinRequestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

interface GroupsResponse {
  data?: Group[];
  meta?: { page: number; totalPages: number; total: number };
}

export default function GroupsPage() {
  const t = useTranslations('groups');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const { data: groupsRaw, isLoading } = useGroups({
    search: debouncedSearch || undefined,
    page,
    limit: 12,
  });

  const groups = (groupsRaw as GroupsResponse)?.data ?? [];
  const meta = (groupsRaw as GroupsResponse)?.meta;

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          {t('createGroup')}
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
        <Input
          placeholder={t('searchPlaceholder')}
          className="h-12 rounded-xl pl-12"
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}

      {!isLoading && groups.length === 0 && <EmptyState icon={Users} title={t('noGroups')} />}

      {!isLoading && groups.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t('previous')}
              </Button>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const start = Math.max(1, page - 2);
                return start + i;
              })
                .filter((p) => p <= meta.totalPages)
                .map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </>
      )}

      <CreateGroupDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
