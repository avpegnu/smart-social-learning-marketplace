'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarImage, AvatarFallback, Textarea, Card, CardContent } from '@shared/ui';
import { useSharePost } from '@shared/hooks';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

interface SharedPostPreview {
  id: string;
  content: string;
  author: {
    fullName: string;
    avatarUrl: string | null;
  };
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SharedPostPreview;
}

export function ShareDialog({ open, onOpenChange, post }: ShareDialogProps) {
  const t = useTranslations('social');
  const [content, setContent] = useState('');
  const sharePost = useSharePost();

  const initials = post.author.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleShare() {
    sharePost.mutate(
      { postId: post.id, content: content.trim() || undefined },
      {
        onSuccess: () => {
          setContent('');
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('shareDialog')}
      description=""
      confirmLabel={t('share')}
      onConfirm={handleShare}
      isLoading={sharePost.isPending}
    >
      <div className="space-y-3 pt-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('shareContent')}
          className="min-h-15 resize-none"
          rows={2}
        />
        <Card className="bg-muted/50">
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
            <p className="text-muted-foreground mt-2 line-clamp-3 text-xs whitespace-pre-wrap">
              {post.content}
            </p>
          </CardContent>
        </Card>
      </div>
    </ConfirmDialog>
  );
}
