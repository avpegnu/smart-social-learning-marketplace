import { apiClient } from '@shared/api-client';

export type RecommendationContext =
  | 'homepage'
  | 'course_detail'
  | 'post_purchase'
  | 'post_complete';

export interface RecommendedCourse {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  avgRating: number;
  totalStudents: number;
  totalLessons: number;
  price: number;
  originalPrice: number | null;
  level: string;
  score: number;
  reason: string;
  instructor: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  _count: {
    reviews: number;
  };
}

export const recommendationService = {
  getRecommendations: (params: {
    context?: RecommendationContext;
    courseId?: string;
    limit?: number;
  }) => {
    const query: Record<string, string> = {};
    if (params.context) query.context = params.context;
    if (params.courseId) query.courseId = params.courseId;
    if (params.limit) query.limit = String(params.limit);
    return apiClient.get<RecommendedCourse[]>('/recommendations', query);
  },
};
