import { apiClient } from '@shared/api-client';

function toQuery(params?: Record<string, unknown>): Record<string, string> | undefined {
  if (!params) return undefined;
  const q: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') q[key] = String(value);
  }
  return Object.keys(q).length > 0 ? q : undefined;
}

export interface CreatePostData {
  content: string;
  type?: 'TEXT' | 'CODE' | 'LINK';
  codeSnippet?: { language: string; code: string };
  linkUrl?: string;
  imageUrls?: string[];
  groupId?: string;
}

export interface UpdatePostData {
  content?: string;
  codeSnippet?: { language: string; code: string };
  linkUrl?: string;
}

export interface CreateCommentData {
  content: string;
  parentId?: string;
}

export interface TrendingPost {
  id: string;
  content: string;
  likeCount: number;
  commentCount: number;
  author: { id: string; fullName: string; avatarUrl: string | null };
}

export const socialService = {
  // Feed
  getFeed: (params?: { page?: number; limit?: number }) => apiClient.get('/feed', toQuery(params)),

  getBookmarks: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/bookmarks', toQuery(params)),

  getTrending: () => apiClient.get<TrendingPost[]>('/feed/trending'),

  getPublicFeed: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/feed/public', toQuery(params)),

  // Posts
  createPost: (data: CreatePostData) => apiClient.post('/posts', data),

  getPost: (id: string) => apiClient.get(`/posts/${id}`),

  updatePost: (id: string, data: UpdatePostData) => apiClient.put(`/posts/${id}`, data),

  deletePost: (id: string) => apiClient.del(`/posts/${id}`),

  sharePost: (id: string, content?: string) =>
    apiClient.post(`/posts/${id}/share`, content ? { content } : {}),

  // Interactions
  toggleLike: (postId: string) => apiClient.post(`/posts/${postId}/like`),

  toggleBookmark: (postId: string) => apiClient.post(`/posts/${postId}/bookmark`),

  // Comments
  getComments: (postId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/posts/${postId}/comments`, toQuery(params)),

  createComment: (postId: string, data: CreateCommentData) =>
    apiClient.post(`/posts/${postId}/comments`, data),

  deleteComment: (postId: string, commentId: string) =>
    apiClient.del(`/posts/${postId}/comments/${commentId}`),
};
