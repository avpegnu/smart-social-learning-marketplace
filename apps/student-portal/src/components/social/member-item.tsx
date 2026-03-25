'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Crown, UserMinus } from 'lucide-react';
import {
  Card,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Badge,
  Select,
} from '@shared/ui';
import { useUpdateMemberRole, useKickMember } from '@shared/hooks';
import { Link } from '@/i18n/navigation';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

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

interface MemberItemProps {
  member: Member;
  groupId: string;
  canManage: boolean;
}

export function MemberItem({ member, groupId, canManage }: MemberItemProps) {
  const t = useTranslations('groups');
  const [showKickConfirm, setShowKickConfirm] = useState(false);

  const updateRole = useUpdateMemberRole();
  const kickMember = useKickMember();

  const isOwner = member.role === 'OWNER';

  const initials = member.user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleOptions = [
    { value: 'MEMBER', label: t('member') },
    { value: 'ADMIN', label: t('admin') },
  ];

  function handleRoleChange(e: { target: { value: string } }) {
    updateRole.mutate({
      groupId,
      userId: member.userId,
      role: e.target.value,
    });
  }

  function handleKick() {
    kickMember.mutate(
      { groupId, userId: member.userId },
      {
        onSuccess: () => setShowKickConfirm(false),
      },
    );
  }

  function renderRoleBadge() {
    if (member.role === 'OWNER') {
      return (
        <Badge variant="default" className="gap-1 text-[10px]">
          <Crown className="h-3 w-3" />
          {t('owner')}
        </Badge>
      );
    }
    if (member.role === 'ADMIN') {
      return (
        <Badge variant="secondary" className="text-primary gap-1 text-[10px]">
          <Shield className="h-3 w-3" />
          {t('admin')}
        </Badge>
      );
    }
    return null;
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${member.user.id}`}>
              <Avatar className="h-10 w-10">
                {member.user.avatarUrl && (
                  <AvatarImage src={member.user.avatarUrl} alt={member.user.fullName} />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${member.user.id}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {member.user.fullName}
                </Link>
                {renderRoleBadge()}
              </div>
            </div>

            {canManage && !isOwner && (
              <div className="flex items-center gap-2">
                <Select
                  options={roleOptions}
                  value={member.role}
                  onChange={handleRoleChange}
                  className="h-8 w-28 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  onClick={() => setShowKickConfirm(true)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!canManage && (
              <Link href={`/profile/${member.user.id}`}>
                <Button variant="outline" size="sm" className="shrink-0">
                  {t('viewProfile')}
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showKickConfirm}
        onOpenChange={setShowKickConfirm}
        title={t('kickMember')}
        description={t('confirmKick')}
        variant="destructive"
        isLoading={kickMember.isPending}
        onConfirm={handleKick}
      />
    </>
  );
}
