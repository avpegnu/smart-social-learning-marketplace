'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent } from '@shared/ui';
import { PostCard } from './post-card';

interface Post {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  author: { id: string; fullName: string; avatarUrl: string | null };
  codeSnippet?: { language: string; code: string } | null;
  images?: { url: string; order: number }[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  sharedPost?: {
    id: string;
    content: string;
    author: { id: string; fullName: string; avatarUrl: string | null };
    images?: { url: string; order: number }[];
    codeSnippet?: { language: string; code: string } | null;
  } | null;
  comments?: {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; fullName: string; avatarUrl: string | null };
  }[];
}

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PostDetailModal({ post, isOpen, onClose }: PostDetailModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0">
        <div className="max-h-[80vh] overflow-y-auto">
          <PostCard post={post} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
