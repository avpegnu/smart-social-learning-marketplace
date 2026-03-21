import { apiClient } from '@shared/api-client';

export interface CreateCouponPayload {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  usageLimit?: number;
  maxUsesPerUser?: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  applicableCourseIds?: string[];
  startsAt: string;
  expiresAt: string;
}

export type UpdateCouponPayload = Partial<Omit<CreateCouponPayload, 'code'>>;

function toQuery(params?: { page?: number; limit?: number }): Record<string, string> {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  return q;
}

export const couponService = {
  getInstructorCoupons: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/instructor/coupons', toQuery(params)),

  create: (data: CreateCouponPayload) => apiClient.post('/instructor/coupons', data),

  update: (id: string, data: UpdateCouponPayload) =>
    apiClient.patch(`/instructor/coupons/${id}`, data),

  deactivate: (id: string) => apiClient.del(`/instructor/coupons/${id}`),
};
