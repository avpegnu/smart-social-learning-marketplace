'use client';

import { useTranslations } from 'next-intl';
import { Lock, Globe, Users, Loader2, Check } from 'lucide-react';
import { Card, CardContent, Avatar, AvatarImage, AvatarFallback, Button, Badge } from '@shared/ui';
import { useJoinGroup } from '@shared/hooks';
import { Link } from '@/i18n/navigation';

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

interface GroupCardProps {
  group: Group;
}

export function GroupCard({ group }: GroupCardProps) {
  const t = useTranslations('groups');
  const joinGroup = useJoinGroup();

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

  const isPrivate = group.privacy === 'PRIVATE';
  const isMember = group.isMember === true;
  const isPending = group.joinRequestStatus === 'PENDING';

  function handleJoin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isMember || isPending || joinGroup.isPending) return;
    joinGroup.mutate(group.id);
  }

  function renderJoinButton() {
    if (isMember) {
      return (
        <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          {t('joined')}
        </span>
      );
    }

    if (isPending) {
      return (
        <Button variant="outline" size="sm" disabled className="text-muted-foreground w-full">
          {t('requestSent')}
        </Button>
      );
    }

    return (
      <Button
        variant="default"
        size="sm"
        className="w-full"
        onClick={handleJoin}
        disabled={joinGroup.isPending}
      >
        {joinGroup.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {isPrivate ? t('requestToJoin') : t('join')}
      </Button>
    );
  }

  return (
    <Link href={`/social/groups/${group.id}`}>
      <Card className="h-full transition-all duration-200 hover:shadow-md">
        <CardContent className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-1 text-sm font-semibold">{group.name}</h3>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {group.memberCount.toLocaleString()} {t('members')}
                </span>
                <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                  {isPrivate ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                  {isPrivate ? t('private') : t('public')}
                </Badge>
              </div>
            </div>
          </div>

          {group.description && (
            <p className="text-muted-foreground mb-3 line-clamp-2 text-xs">{group.description}</p>
          )}

          <div className="mb-3 flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {group.owner.avatarUrl && (
                <AvatarImage src={group.owner.avatarUrl} alt={group.owner.fullName} />
              )}
              <AvatarFallback className="text-[8px]">{ownerInitials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground truncate text-xs">{group.owner.fullName}</span>
          </div>

          <div className="mt-auto">{renderJoinButton()}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
