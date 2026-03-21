'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import {
  couponService,
  type CreateCouponPayload,
  type UpdateCouponPayload,
} from '../services/coupon.service';

export function useInstructorCoupons(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['instructor', 'coupons', params],
    queryFn: () => couponService.getInstructorCoupons(params),
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreateCouponPayload) => couponService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'coupons'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCouponPayload }) =>
      couponService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'coupons'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeactivateCoupon() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => couponService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'coupons'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
