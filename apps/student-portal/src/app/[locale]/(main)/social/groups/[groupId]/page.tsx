'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent, Card, CardContent } from '@shared/ui';
import { useGroup } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { GroupHeader } from '@/components/social/group-header';
import { GroupPostsTab } from '@/components/social/group-posts-tab';
import { GroupMembersTab } from '@/components/social/group-members-tab';
import { GroupRequestsTab } from '@/components/social/group-requests-tab';

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

interface GroupResponse {
  data?: GroupDetail;
}

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const t = useTranslations('groups');

  const { data: groupRaw, isLoading } = useGroup(groupId);
  const group = (groupRaw as GroupResponse)?.data;

  const isMember = group?.isMember === true;
  const isOwnerOrAdmin = group?.userRole === 'OWNER' || group?.userRole === 'ADMIN';

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

      <GroupHeader group={group} />

      <Tabs defaultValue="posts">
        <TabsList className="mb-6">
          <TabsTrigger value="posts">{t('posts')}</TabsTrigger>
          <TabsTrigger value="members">
            {t('member')} ({group.memberCount})
          </TabsTrigger>
          {isOwnerOrAdmin && <TabsTrigger value="requests">{t('requests')}</TabsTrigger>}
          <TabsTrigger value="about">{t('about')}</TabsTrigger>
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

        <TabsContent value="about">
          <div className="max-w-2xl">
            <Card>
              <CardContent className="space-y-4 p-6">
                {group.description && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">{t('description')}</h3>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {group.description}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">
                    {t('createdAt')}: {formatRelativeTime(group.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
