import { apiClient } from '@shared/api-client';

export const tagService = {
  /** Public endpoint — all tags for selector dropdowns */
  getAll: () => apiClient.get('/tags'),
};
