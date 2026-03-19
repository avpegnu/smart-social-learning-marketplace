import { apiClient } from '@shared/api-client';

export const categoryService = {
  getAll: () => apiClient.get('/categories'),

  getBySlug: (slug: string) => apiClient.get(`/categories/${slug}`),
};
