'use client';

import { useTranslations } from 'next-intl';
import { Trash2, Flag } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@shared/ui';
import { useAuthStore } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ReportDialog } from '@/components/feedback/report-dialog';
import { useState } from 'react';

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

interface CommentItemProps {
  comment: Comment;
  postId: string;
  onDelete: (commentId: string) => void;
  onReply: (parentId: string, authorName: string) => void;
  isDeleting?: boolean;
  isNested?: boolean;
}

export function CommentItem({
  comment,
  postId,
  onDelete,
  onReply,
  isDeleting = false,
  isNested = false,
}: CommentItemProps) {
  const t = useTranslations('social');
  const user = useAuthStore((s) => s.user);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const isOwner = user?.id === comment.author.id;
  const initials = comment.author.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={isNested ? 'ml-8' : ''}>
      <div className="flex gap-2">
        <Link href={`/profile/${comment.author.id}`}>
          <Avatar className="h-7 w-7 shrink-0">
            {comment.author.avatarUrl && (
              <AvatarImage src={comment.author.avatarUrl} alt={comment.author.fullName} />
            )}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="bg-muted rounded-lg px-3 py-2">
            <Link
              href={`/profile/${comment.author.id}`}
              className="text-xs font-semibold hover:underline"
            >
              {comment.author.fullName}
            </Link>
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1">
            <span className="text-muted-foreground text-[11px]">
              {formatRelativeTime(comment.createdAt)}
            </span>
            <button
              type="button"
              onClick={() =>
                onReply(comment.parentId ? comment.parentId : comment.id, comment.author.fullName)
              }
              className="text-muted-foreground hover:text-foreground cursor-pointer text-[11px] font-medium"
            >
              {t('reply')}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-muted-foreground hover:text-destructive cursor-pointer text-[11px]"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            {!isOwner && user && (
              <button
                type="button"
                onClick={() => setShowReportDialog(true)}
                className="text-muted-foreground hover:text-destructive cursor-pointer text-[11px]"
                title={t('report')}
              >
                <Flag className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          postId={postId}
          onDelete={onDelete}
          onReply={onReply}
          isDeleting={isDeleting}
          isNested
        />
      ))}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('deleteComment')}
        description={t('confirmDelete')}
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={() => {
          onDelete(comment.id);
          setShowDeleteConfirm(false);
        }}
      />

      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        targetType="COMMENT"
        targetId={comment.id}
      />
    </div>
  );
}
