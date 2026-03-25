'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback, Button } from '@shared/ui';
import { useAuthStore, useComments, useCreateComment, useDeleteComment } from '@shared/hooks';
import { CommentItem } from './comment-item';

interface CommentAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
  parentId?: string | null;
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: string;
  commentCount: number;
  previewComments?: Comment[];
}

export function CommentSection({
  postId,
  commentCount,
  previewComments = [],
}: CommentSectionProps) {
  const t = useTranslations('social');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ parentId: string; authorName: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: commentsRaw, isLoading: isLoadingComments } = useComments(postId, {
    page: 1,
    limit: 50,
  });
  const allComments = expanded
    ? ((commentsRaw as { data?: Comment[] } | undefined)?.data ?? [])
    : previewComments;

  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();

  const initials =
    user?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '';

  function handleSubmit() {
    if (!commentText.trim()) return;
    createComment.mutate(
      {
        postId,
        data: {
          content: commentText.trim(),
          ...(replyTo ? { parentId: replyTo.parentId } : {}),
        },
      },
      {
        onSuccess: () => {
          setCommentText('');
          setReplyTo(null);
          if (!expanded && commentCount >= 2) {
            setExpanded(true);
          }
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleReply(parentId: string, authorName: string) {
    setReplyTo({ parentId, authorName });
    inputRef.current?.focus();
  }

  function handleDelete(commentId: string) {
    deleteComment.mutate({ postId, commentId });
  }

  const showExpandButton = !expanded && commentCount > previewComments.length;

  return (
    <div className="space-y-3">
      {allComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          onDelete={handleDelete}
          onReply={handleReply}
          isDeleting={deleteComment.isPending}
        />
      ))}

      {showExpandButton && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-primary cursor-pointer text-sm font-medium hover:underline"
        >
          {t('viewAllComments', { count: commentCount })}
        </button>
      )}

      {expanded && isLoadingComments && (
        <div className="flex justify-center py-2">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      )}

      {isAuthenticated && (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <div className="relative min-w-0 flex-1">
            {replyTo && (
              <div className="bg-muted text-muted-foreground mb-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs">
                <span>@{replyTo.authorName}</span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="hover:text-foreground ml-auto cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('commentPlaceholder')}
              className="bg-muted text-foreground placeholder:text-muted-foreground w-full rounded-full px-3 py-1.5 text-sm outline-none"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={handleSubmit}
            disabled={!commentText.trim() || createComment.isPending}
          >
            {createComment.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
