'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Image, Loader2, MessageSquare } from 'lucide-react';
import { Card, CardContent, Avatar, AvatarImage, AvatarFallback, Button } from '@shared/ui';
import { useAuthStore, useGroupPosts, useCreateGroupPost } from '@shared/hooks';
import { EmptyState } from '@/components/feedback/empty-state';
import { GroupPostCard } from './group-post-card';

interface GroupPostsTabProps {
  groupId: string;
  isMember: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function GroupPostsTab({ groupId, isMember }: GroupPostsTabProps) {
  const t = useTranslations('groups');
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [postContent, setPostContent] = useState('');

  const { data: raw, isLoading } = useGroupPosts(groupId, { page, limit: 10 });
  const resp = raw as { data?: unknown[]; meta?: { page: number; totalPages: number } } | undefined;
  const posts = (resp?.data ?? []) as Array<Record<string, unknown>>;
  const meta = resp?.meta;
  const createPost = useCreateGroupPost();

  function handleCreatePost() {
    if (!postContent.trim()) return;
    createPost.mutate(
      { groupId, data: { content: postContent.trim() } },
      {
        onSuccess: () => setPostContent(''),
      },
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {isMember && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user ? getInitials(user.fullName) : ''}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleCreatePost();
                    }
                  }}
                  placeholder={t('composerPlaceholder')}
                  className="bg-muted/50 text-foreground placeholder:text-muted-foreground w-full resize-none rounded-lg border-0 px-3 py-2 text-sm outline-none"
                  rows={2}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                    <Image className="h-4 w-4" />
                  </Button>
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={handleCreatePost}
                      disabled={!postContent.trim() || createPost.isPending}
                    >
                      {createPost.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {t('posts')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && posts.length === 0 && <EmptyState icon={MessageSquare} title={t('noPosts')} />}

      {posts.map((post) => (
        <GroupPostCard key={post.id as string} post={post} />
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
