'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@shared/ui';
import { useTrending } from '@shared/hooks';
import { PostDetailModal } from './post-detail-modal';

interface TrendingPost {
  id: string;
  content: string;
  likeCount: number;
  commentCount: number;
  author: { id: string; fullName: string; avatarUrl: string | null };
}

interface PostAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface PostImage {
  url: string;
  order: number;
}

interface CodeSnippet {
  language: string;
  code: string;
}

interface SharedPost {
  id: string;
  content: string;
  author: PostAuthor;
  images?: PostImage[];
  codeSnippet?: CodeSnippet | null;
}

interface PostDetail {
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
  comments?: { id: string; content: string; createdAt: string; author: PostAuthor }[];
}

export function TrendingSidebar() {
  const t = useTranslations('social');
  const { data, isLoading } = useTrending();
  const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null);

  // Handle both { data: T[] } and { data: { data: T[] } } for compatibility during reload
  const rawData = data?.data as unknown;
  const postsArray = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as Record<string, unknown>)?.data)
      ? ((rawData as Record<string, unknown>).data as unknown[])
      : [];

  const posts = postsArray as TrendingPost[];

  const handlePostClick = (post: TrendingPost) => {
    setSelectedPost({
      id: post.id,
      content: post.content,
      type: 'TEXT',
      createdAt: new Date().toISOString(),
      author: post.author,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      isLiked: false,
      isBookmarked: false,
      sharedPost: null,
      comments: [],
    });
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="text-primary h-4 w-4" />
            <h2 className="text-sm font-semibold">{t('trending')}</h2>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          )}

          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="border-border cursor-pointer border-b pb-3 transition-opacity last:border-0 last:pb-0 hover:opacity-70"
                onClick={() => handlePostClick(post)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handlePostClick(post);
                  }
                }}
              >
                <p className="text-foreground line-clamp-2 text-xs">{post.content}</p>
                <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {post.likeCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {post.commentCount}
                  </span>
                  <span className="truncate">{post.author.fullName}</span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
      />
    </>
  );
}
