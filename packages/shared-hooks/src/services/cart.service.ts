import { apiClient } from '@shared/api-client';

export const cartService = {
  getCart: () => apiClient.get('/cart'),

  addItem: (courseId: string, chapterId?: string) =>
    apiClient.post('/cart/items', { courseId, chapterId }),

  removeItem: (itemId: string) => apiClient.del(`/cart/items/${itemId}`),

  clearCart: () => apiClient.del('/cart'),

  mergeCart: (items: Array<{ courseId: string; chapterId?: string }>) =>
    apiClient.post('/cart/merge', { items }),

  applyCoupon: (code: string) => apiClient.post('/cart/apply-coupon', { code }),
};
