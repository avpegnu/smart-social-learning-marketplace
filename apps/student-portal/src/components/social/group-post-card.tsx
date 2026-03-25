'use client';

import { useState } from 'react';
import { Card, CardContent, Avatar, AvatarImage, AvatarFallback, Separator } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { PostActions } from './post-actions';
import { CommentSection } from './comment-section';
import { ShareDialog } from './share-dialog';

interface PostAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface GroupPostCardProps {
  post: Record<string, unknown>;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function GroupPostCard({ post }: GroupPostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const id = post.id as string;
  const content = post.content as string;
  const createdAt = post.createdAt as string;
  const author = post.author as PostAuthor;
  const likeCount = (post.likeCount as number) ?? 0;
  const commentCount = (post.commentCount as number) ?? 0;
  const isLiked = (post.isLiked as boolean) ?? false;
  const isBookmarked = (post.isBookmarked as boolean) ?? false;
  const imageUrls = post.imageUrls as string[] | undefined;
  const comments = (post.comments ?? []) as Array<{
    id: string;
    content: string;
    createdAt: string;
    author: PostAuthor;
    parentId?: string | null;
    replies?: Array<{
      id: string;
      content: string;
      createdAt: string;
      author: PostAuthor;
      parentId?: string | null;
    }>;
  }>;

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Link href={`/profile/${author.id}`}>
              <Avatar className="h-10 w-10">
                {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt={author.fullName} />}
                <AvatarFallback>{getInitials(author.fullName)}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/profile/${author.id}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {author.fullName}
                  </Link>
                  <p className="text-muted-foreground text-xs">{formatRelativeTime(createdAt)}</p>
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{content}</p>
              {imageUrls && imageUrls.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {imageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="max-h-80 w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <Separator className="my-3" />
              <PostActions
                postId={id}
                likeCount={likeCount}
                commentCount={commentCount}
                isLiked={isLiked}
                isBookmarked={isBookmarked}
                onToggleComments={() => setShowComments((v) => !v)}
                onShare={() => setShowShare(true)}
              />
              {showComments && (
                <div className="mt-3">
                  <CommentSection
                    postId={id}
                    commentCount={commentCount}
                    previewComments={comments}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showShare && (
        <ShareDialog
          open={showShare}
          onOpenChange={setShowShare}
          post={{ id, content, author: { fullName: author.fullName, avatarUrl: author.avatarUrl } }}
        />
      )}
    </>
  );
}
