'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { useToggleLike, useToggleBookmark } from '@shared/hooks';
import { cn } from '@/lib/utils';

interface PostActionsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  onToggleComments: () => void;
  onShare: () => void;
}

export function PostActions({
  postId,
  likeCount,
  commentCount,
  isLiked,
  isBookmarked,
  onToggleComments,
  onShare,
}: PostActionsProps) {
  const [optimisticLiked, setOptimisticLiked] = useState(isLiked);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(likeCount);
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(isBookmarked);

  const toggleLike = useToggleLike();
  const toggleBookmark = useToggleBookmark();

  function handleLike() {
    const wasLiked = optimisticLiked;
    setOptimisticLiked(!wasLiked);
    setOptimisticLikeCount((c) => (wasLiked ? c - 1 : c + 1));

    toggleLike.mutate(postId, {
      onError: () => {
        setOptimisticLiked(wasLiked);
        setOptimisticLikeCount((c) => (wasLiked ? c + 1 : c - 1));
      },
    });
  }

  function handleBookmark() {
    const wasBookmarked = optimisticBookmarked;
    setOptimisticBookmarked(!wasBookmarked);

    toggleBookmark.mutate(postId, {
      onError: () => {
        setOptimisticBookmarked(wasBookmarked);
      },
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleLike}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
          optimisticLiked ? 'text-red-500' : 'text-muted-foreground hover:bg-accent',
        )}
      >
        <Heart className={cn('h-4 w-4', optimisticLiked && 'fill-red-500')} />
        {optimisticLikeCount > 0 && optimisticLikeCount}
      </button>

      <button
        type="button"
        onClick={onToggleComments}
        className="text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        {commentCount > 0 && commentCount}
      </button>

      <button
        type="button"
        onClick={onShare}
        className="text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
      >
        <Share2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleBookmark}
        className={cn(
          'ml-auto cursor-pointer rounded-lg p-1.5 transition-colors',
          optimisticBookmarked ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Bookmark className={cn('h-4 w-4', optimisticBookmarked && 'fill-primary')} />
      </button>
    </div>
  );
}
