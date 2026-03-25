'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, FileText } from 'lucide-react';
import { useAuthStore, useFeed } from '@shared/hooks';
import { PostComposer } from '@/components/social/post-composer';
import { PostCard } from '@/components/social/post-card';

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

interface FeedPage {
  data?: Post[];
  meta?: { page: number; totalPages: number };
}

export default function SocialPage() {
  const t = useTranslations('social');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed();

  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [handleIntersect]);

  const pages = (data?.pages ?? []) as FeedPage[];
  const posts = pages.flatMap((page) => page.data ?? []);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Post Composer */}
      {isAuthenticated && (
        <div className="mb-6">
          <PostComposer />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm">{t('noFeed')}</p>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Loading more */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}
