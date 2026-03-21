import { apiClient } from '@shared/api-client';

export const wishlistService = {
  getAll: (params?: Record<string, string>) => apiClient.get('/wishlists', params),

  add: (courseId: string) => apiClient.post(`/wishlists/${courseId}`),

  remove: (courseId: string) => apiClient.del(`/wishlists/${courseId}`),
};
