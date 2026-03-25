'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@shared/ui';
import { useGroupMembers } from '@shared/hooks';
import { MemberItem } from './member-item';
import { EmptyState } from '@/components/feedback/empty-state';

interface Member {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  joinedAt: string;
}

interface MembersResponse {
  data?: Member[];
  meta?: { page: number; totalPages: number; total: number };
}

interface GroupMembersTabProps {
  groupId: string;
  canManage: boolean;
}

export function GroupMembersTab({ groupId, canManage }: GroupMembersTabProps) {
  const t = useTranslations('groups');
  const [page, setPage] = useState(1);

  const { data: membersRaw, isLoading } = useGroupMembers(groupId, { page, limit: 20 });
  const members = (membersRaw as MembersResponse)?.data ?? [];
  const meta = (membersRaw as MembersResponse)?.meta;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (members.length === 0) {
    return <EmptyState icon={Users} title={t('members')} />;
  }

  return (
    <div className="max-w-2xl space-y-2">
      {members.map((member) => (
        <MemberItem key={member.id} member={member} groupId={groupId} canManage={canManage} />
      ))}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('previous')}
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {meta.totalPages}
          </span>
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
    </div>
  );
}
