import { useQuery } from '@tanstack/react-query';
import {
  recommendationService,
  type RecommendationContext,
} from '../services/recommendation.service';

export function useRecommendations(
  context: RecommendationContext = 'homepage',
  options?: {
    courseId?: string;
    limit?: number;
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ['recommendations', context, options?.courseId, options?.limit],
    queryFn: () =>
      recommendationService.getRecommendations({
        context,
        courseId: options?.courseId,
        limit: options?.limit,
      }),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
