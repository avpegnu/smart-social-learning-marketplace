'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, FileText, Users, TrendingUp, UserPlus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button } from '@shared/ui';
import { useAuthStore, useFeed, usePublicFeed } from '@shared/hooks';
import { Link } from '@/i18n/navigation';
import { PostComposer } from '@/components/social/post-composer';
import { PostCard } from '@/components/social/post-card';
import { TrendingSidebar } from '@/components/social/trending-sidebar';
import { SuggestionsSidebar } from '@/components/social/suggestions-sidebar';
import { GroupsSidebar } from '@/components/social/groups-sidebar';
import { QuickLinksSidebar } from '@/components/social/quick-links-sidebar';

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

function ForYouFeed() {
  const t = useTranslations('social');
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
  const allPostIds = new Set(posts.map((p) => p.id));
  const uniquePosts = posts.filter((p) => {
    if (allPostIds.has(p.id)) {
      allPostIds.delete(p.id);
      return true;
    }
    return false;
  });

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && uniquePosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm">{t('noFeed')}</p>
        </div>
      )}

      {uniquePosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}

function PublicFeed() {
  const t = useTranslations('social');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePublicFeed();
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
  const allPostIds = new Set(posts.map((p) => p.id));
  const uniquePosts = posts.filter((p) => {
    if (allPostIds.has(p.id)) {
      allPostIds.delete(p.id);
      return true;
    }
    return false;
  });

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && uniquePosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm">{t('noFeed')}</p>
        </div>
      )}

      {uniquePosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}

export default function SocialPage() {
  const t = useTranslations('social');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,600px)_300px]">
        {/* Left sidebar */}
        <div className="sticky top-4 hidden h-fit lg:flex lg:flex-col lg:gap-4">
          <QuickLinksSidebar />
          <GroupsSidebar />
        </div>

        {/* Center feed */}
        <div className="min-w-0">
          {/* Mobile-only quick links — sidebars hidden on small screens */}
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
            <Link href="/social/groups">
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 whitespace-nowrap">
                <Users className="h-4 w-4" />
                {t('groups')}
              </Button>
            </Link>
            <a href="#mobile-trending">
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 whitespace-nowrap">
                <TrendingUp className="h-4 w-4" />
                {t('trending')}
              </Button>
            </a>
            {isAuthenticated && (
              <a href="#mobile-suggestions">
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5 whitespace-nowrap">
                  <UserPlus className="h-4 w-4" />
                  {t('suggestions')}
                </Button>
              </a>
            )}
          </div>

          {isAuthenticated && (
            <div className="mb-6">
              <PostComposer />
            </div>
          )}

          {isAuthenticated ? (
            <Tabs defaultValue="for-you" className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="for-you">{t('forYou')}</TabsTrigger>
                <TabsTrigger value="public">{t('publicFeed')}</TabsTrigger>
              </TabsList>
              <TabsContent value="for-you" className="mt-0">
                <ForYouFeed />
              </TabsContent>
              <TabsContent value="public" className="mt-0">
                <PublicFeed />
              </TabsContent>
            </Tabs>
          ) : (
            <PublicFeed />
          )}

          {/* Mobile-only sidebars stacked below feed */}
          <div className="mt-6 flex flex-col gap-4 lg:hidden">
            <div id="mobile-trending" className="scroll-mt-20">
              <TrendingSidebar />
            </div>
            {isAuthenticated && (
              <div id="mobile-suggestions" className="scroll-mt-20">
                <SuggestionsSidebar />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="sticky top-4 hidden h-fit lg:flex lg:flex-col lg:gap-4">
          <TrendingSidebar />
          {isAuthenticated && <SuggestionsSidebar />}
        </aside>
      </div>
    </div>
  );
}
