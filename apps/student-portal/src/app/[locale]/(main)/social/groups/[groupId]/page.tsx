'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@shared/ui';
import { useGroup } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { GroupHeader } from '@/components/social/group-header';
import { GroupPostsTab } from '@/components/social/group-posts-tab';
import { GroupMembersTab } from '@/components/social/group-members-tab';
import { GroupRequestsTab } from '@/components/social/group-requests-tab';
import { GroupSettingsModal } from '@/components/social/group-settings-modal';
import { useJoinRequests } from '@shared/hooks';

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
  courseId?: string;
  isMember?: boolean;
  userRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  joinRequestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  createdAt: string;
}

interface GroupResponse {
  data?: GroupDetail;
}

interface JoinRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  userId: string;
  groupId: string;
  createdAt: string;
}

interface JoinRequestsResponse {
  data?: JoinRequest[];
}

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const t = useTranslations('groups');

  const { data: groupRaw, isLoading } = useGroup(groupId);
  const group = (groupRaw as GroupResponse)?.data;

  const { data: requestsRaw } = useJoinRequests(groupId, { page: 1, limit: 100 });
  const requestsData = (requestsRaw as JoinRequestsResponse)?.data ?? [];
  const requestCount = requestsData.filter((r: JoinRequest) => r.status === 'PENDING').length;

  const [showSettings, setShowSettings] = useState(false);

  const isMember = group?.isMember === true;
  const isOwnerOrAdmin = group?.userRole === 'OWNER' || group?.userRole === 'ADMIN';
  const isCourseGroup = !!group?.courseId;

  if (isLoading) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-16">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">{t('noGroups')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/social/groups">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {t('backToGroups')}
        </Button>
      </Link>

      <GroupHeader group={group} onSettingsClick={() => setShowSettings(true)} />

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Main Content */}
        <div className="order-last w-full flex-1 md:order-first md:basis-7/10">
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="posts">{t('posts')}</TabsTrigger>
              <TabsTrigger value="members">
                {t('member')} ({group.memberCount})
              </TabsTrigger>
              {isOwnerOrAdmin && (
                <TabsTrigger value="requests">
                  {t('requests')} {requestCount > 0 && `(${requestCount})`}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="posts">
              <GroupPostsTab groupId={groupId} isMember={isMember} />
            </TabsContent>

            <TabsContent value="members">
              <GroupMembersTab groupId={groupId} canManage={isOwnerOrAdmin} />
            </TabsContent>

            {isOwnerOrAdmin && (
              <TabsContent value="requests">
                <GroupRequestsTab groupId={groupId} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="order-first flex-1 space-y-4 md:order-last md:basis-3/10">
          {/* Group Info Card */}
          <Card>
            <CardContent className="space-y-4 p-4">
              {group.description && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold capitalize">{t('description')}</h3>
                  <p className="text-muted-foreground line-clamp-3 text-xs whitespace-pre-wrap">
                    {group.description}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 border-t pt-3 text-xs">
                <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground">{formatRelativeTime(group.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Owner Card */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-xs font-semibold capitalize">{t('owner')}</h3>
              <Link
                href={`/profile/${group.owner.id}`}
                className="flex items-center gap-2.5 transition-opacity hover:opacity-75"
              >
                <Avatar className="h-9 w-9">
                  {group.owner.avatarUrl && (
                    <AvatarImage src={group.owner.avatarUrl} alt={group.owner.fullName} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {group.owner.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{group.owner.fullName}</p>
                  <p className="text-muted-foreground text-[10px]">{t('groupLeader')}</p>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Members Preview Card */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-xs font-semibold capitalize">{t('members')}</h3>
              <p className="text-muted-foreground text-xs">
                {group.memberCount} {group.memberCount === 1 ? t('member') : t('members')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {group && !isCourseGroup && (
        <GroupSettingsModal group={group} open={showSettings} onOpenChange={setShowSettings} />
      )}
    </div>
  );
}
