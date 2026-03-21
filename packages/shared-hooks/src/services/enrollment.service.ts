import { apiClient } from '@shared/api-client';

export const enrollmentService = {
  check: (courseId: string) => apiClient.get(`/enrollments/check/${courseId}`),

  enrollFree: (courseId: string) => apiClient.post(`/enrollments/free/${courseId}`),

  getMyLearning: (params?: Record<string, string>) =>
    apiClient.get('/enrollments/my-learning', params),
};
