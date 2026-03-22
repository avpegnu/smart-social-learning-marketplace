import { apiClient } from '@shared/api-client';

export const notificationService = {
  getUnreadCount: () => apiClient.get<number>('/notifications/unread-count'),

  getAll: (params?: { page?: number; limit?: number; read?: boolean }) => {
    const q: Record<string, string> = {};
    if (params?.page) q.page = String(params.page);
    if (params?.limit) q.limit = String(params.limit);
    if (params?.read !== undefined) q.read = String(params.read);
    return apiClient.get('/notifications', q);
  },

  markRead: (id: string) => apiClient.put(`/notifications/${id}/read`),

  markAllRead: () => apiClient.put('/notifications/read-all'),
};
