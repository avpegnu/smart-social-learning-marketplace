import { apiClient } from '@shared/api-client';

export const orderService = {
  create: (couponCode?: string) => apiClient.post('/orders', couponCode ? { couponCode } : {}),

  getHistory: (params?: Record<string, string>) => apiClient.get('/orders', params),

  getById: (orderId: string) => apiClient.get(`/orders/${orderId}`),

  getStatus: (orderId: string) => apiClient.get(`/orders/${orderId}/status`),
};
