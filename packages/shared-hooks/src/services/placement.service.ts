import { apiClient } from '@shared/api-client';

export interface PlacementQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface PlacementStartResponse {
  questions: PlacementQuestion[];
  totalQuestions: number;
}

export interface PlacementAnswer {
  questionId: string;
  selectedOptionId: string;
}

export interface PlacementResult {
  testId: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  scores: Record<string, number>;
  recommendedCourses: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    level: string;
  }[];
}

export const placementService = {
  startTest: (categoryId?: string) =>
    apiClient.post<PlacementStartResponse>('/placement-tests/start', {
      categoryId: categoryId || undefined,
    }),

  submitTest: (answers: PlacementAnswer[]) =>
    apiClient.post<PlacementResult>('/placement-tests/submit', { answers }),
};
