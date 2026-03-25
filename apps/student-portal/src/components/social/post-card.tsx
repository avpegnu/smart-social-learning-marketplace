'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback, Card, CardContent, Separator } from '@shared/ui';
import { useAuthStore, useDeletePost } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { CodeBlock } from '@/components/qna/code-block';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { PostActions } from './post-actions';
import { CommentSection } from './comment-section';
import { ShareDialog } from './share-dialog';

interface PostAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface CodeSnippet {
  language: string;
  code: string;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  parentId?: string | null;
  replies?: CommentData[];
}

interface PostImage {
  url: string;
  order: number;
}

interface SharedPost {
  id: string;
  content: string;
  author: PostAuthor;
  images?: PostImage[];
  codeSnippet?: CodeSnippet | null;
}

interface Post {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  author: PostAuthor;
  codeSnippet?: CodeSnippet | null;
  images?: PostImage[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  sharedPost?: SharedPost | null;
  comments?: CommentData[];
}

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const t = useTranslations('social');
  const user = useAuthStore((s) => s.user);
  const deletePost = useDeletePost();

  const [showComments, setShowComments] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const isOwner = user?.id === post.author.id;
  const initials = post.author.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleDelete() {
    deletePost.mutate(post.id, {
      onSuccess: () => setShowDeleteConfirm(false),
    });
  }

  const previewComments = (post.comments ?? []).slice(0, 2);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Author row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${post.author.id}`}>
              <Avatar className="h-10 w-10">
                {post.author.avatarUrl && (
                  <AvatarImage src={post.author.avatarUrl} alt={post.author.fullName} />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link
                href={`/profile/${post.author.id}`}
                className="text-sm font-semibold hover:underline"
              >
                {post.author.fullName}
              </Link>
              {post.sharedPost && (
                <span className="text-muted-foreground text-sm"> {t('sharedPost')}</span>
              )}
              <p className="text-muted-foreground text-xs">{formatRelativeTime(post.createdAt)}</p>
            </div>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive cursor-pointer rounded-lg p-1.5 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content */}
        {post.content && <p className="mt-3 text-sm whitespace-pre-wrap">{post.content}</p>}

        {/* Code snippet */}
        {post.codeSnippet && <CodeBlock codeSnippet={post.codeSnippet} />}

        {/* Images */}
        {post.images && post.images.length > 0 && <ImageGrid images={post.images} />}

        {/* Shared post */}
        {post.sharedPost && <SharedPostPreview post={post.sharedPost} />}

        <Separator className="my-3" />

        {/* Actions */}
        <PostActions
          postId={post.id}
          likeCount={post.likeCount}
          commentCount={post.commentCount}
          isLiked={post.isLiked}
          isBookmarked={post.isBookmarked}
          onToggleComments={() => setShowComments(!showComments)}
          onShare={() => setShowShareDialog(true)}
        />

        {/* Comments */}
        {(showComments || previewComments.length > 0) && (
          <>
            <Separator className="my-3" />
            <CommentSection
              postId={post.id}
              commentCount={post.commentCount}
              previewComments={previewComments}
            />
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('deletePost')}
        description={t('confirmDelete')}
        variant="destructive"
        isLoading={deletePost.isPending}
        onConfirm={handleDelete}
      />

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        post={{
          id: post.sharedPost?.id ?? post.id,
          content: post.sharedPost?.content ?? post.content,
          author: post.sharedPost?.author ?? post.author,
        }}
      />
    </Card>
  );
}

/* ── Image Grid ── */

function ImageGrid({ images }: { images: PostImage[] }) {
  const urls = images.map((img) => img.url);

  if (urls.length === 1) {
    return (
      <div className="mt-3">
        <img src={urls[0]} alt="" className="max-h-96 w-full rounded-lg object-cover" />
      </div>
    );
  }

  const displayUrls = urls.slice(0, 4);
  const remaining = urls.length - 4;

  return (
    <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
      {displayUrls.map((url, idx) => (
        <div key={url} className="relative">
          <img src={url} alt="" className="aspect-square w-full object-cover" />
          {idx === 3 && remaining > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-2xl font-bold text-white">+{remaining}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Shared Post Preview ── */

function SharedPostPreview({ post }: { post: SharedPost }) {
  const initials = post.author.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="bg-muted/50 mt-3">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            {post.author.avatarUrl && (
              <AvatarImage src={post.author.avatarUrl} alt={post.author.fullName} />
            )}
            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">{post.author.fullName}</span>
        </div>
        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm whitespace-pre-wrap">
          {post.content}
        </p>
        {post.codeSnippet && <CodeBlock codeSnippet={post.codeSnippet} />}
        {post.images && post.images.length > 0 && (
          <div className="mt-2">
            <img src={post.images[0].url} alt="" className="h-32 w-full rounded-lg object-cover" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
