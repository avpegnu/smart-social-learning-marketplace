'use client';

import { useTranslations } from 'next-intl';
import { Lock, Globe, Users, Loader2, Check } from 'lucide-react';
import { Card, CardContent, Avatar, AvatarImage, AvatarFallback, Button, Badge } from '@shared/ui';
import { useJoinGroup, useLeaveGroup } from '@shared/hooks';
import { Link } from '@/i18n/navigation';

interface GroupOwner {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  privacy: 'PUBLIC' | 'PRIVATE';
  memberCount: number;
  owner: GroupOwner;
  isMember?: boolean;
  userRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  joinRequestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  createdAt: string;
}

interface GroupHeaderProps {
  group: GroupDetail;
}

export function GroupHeader({ group }: GroupHeaderProps) {
  const t = useTranslations('groups');
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();

  const isPrivate = group.privacy === 'PRIVATE';
  const isMember = group.isMember === true;
  const isOwner = group.userRole === 'OWNER';
  const isPending = group.joinRequestStatus === 'PENDING';

  const initials = group.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const ownerInitials = group.owner.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleJoin() {
    if (joinGroup.isPending) return;
    joinGroup.mutate(group.id);
  }

  function handleLeave() {
    if (leaveGroup.isPending) return;
    leaveGroup.mutate(group.id);
  }

  function renderActionButton() {
    if (isMember && !isOwner) {
      return (
        <Button variant="outline" onClick={handleLeave} disabled={leaveGroup.isPending}>
          {leaveGroup.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {t('leave')}
        </Button>
      );
    }

    if (isMember && isOwner) {
      return (
        <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          {t('owner')}
        </span>
      );
    }

    if (isPending) {
      return (
        <Button variant="outline" disabled className="text-muted-foreground">
          {t('requestSent')}
        </Button>
      );
    }

    return (
      <Button onClick={handleJoin} disabled={joinGroup.isPending}>
        {joinGroup.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {isPrivate ? t('requestToJoin') : t('join')}
      </Button>
    );
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="from-primary/20 to-primary/5 h-32 bg-gradient-to-br sm:h-40" />
      <CardContent className="-mt-10 p-4 sm:-mt-12 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <Avatar className="border-background h-16 w-16 border-4 sm:h-20 sm:w-20">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold sm:text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{group.name}</h1>
              <Badge variant="secondary" className="gap-1 text-xs">
                {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {isPrivate ? t('private') : t('public')}
              </Badge>
            </div>

            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span>
                {group.memberCount.toLocaleString()} {t('members')}
              </span>
            </div>

            {group.description && (
              <p className="text-muted-foreground mt-2 text-sm">{group.description}</p>
            )}

            <div className="mt-2 flex items-center gap-2">
              <Link href={`/profile/${group.owner.id}`} className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  {group.owner.avatarUrl && (
                    <AvatarImage src={group.owner.avatarUrl} alt={group.owner.fullName} />
                  )}
                  <AvatarFallback className="text-[8px]">{ownerInitials}</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground text-xs hover:underline">
                  {group.owner.fullName}
                </span>
              </Link>
            </div>
          </div>

          <div className="shrink-0">{renderActionButton()}</div>
        </div>
      </CardContent>
    </Card>
  );
}
