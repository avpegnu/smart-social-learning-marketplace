'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, FileText } from 'lucide-react';
import { usePost } from '@shared/hooks';
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

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const t = useTranslations('social');
  const { data, isLoading } = usePost(postId);
  const post = (data as { data?: Post } | undefined)?.data;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="flex justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <FileText className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
        <p className="text-muted-foreground text-sm">{t('postNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <PostCard post={post} />
    </div>
  );
}
