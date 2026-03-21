'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { useAuthStore } from '../stores/auth-store';
import { useCartStore } from '../stores/cart-store';
import { cartService } from '../services/cart.service';

// ── Server Cart (authenticated) ──

export function useServerCart() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['cart'],
    queryFn: () => cartService.getCart(),
    enabled: isAuthenticated,
  });
}

// ── Add Item to Server Cart ──

export function useAddCartItem() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ courseId, chapterId }: { courseId: string; chapterId?: string }) =>
      cartService.addItem(courseId, chapterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Remove Item from Server Cart ──

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (itemId: string) => cartService.removeItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Clear Server Cart ──

export function useClearCart() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: () => cartService.clearCart(),
    onSuccess: () => {
      useCartStore.getState().clearCart();
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Merge localStorage Cart to Server ──

export function useMergeCart() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (items: Array<{ courseId: string; chapterId?: string }>) =>
      cartService.mergeCart(items),
    onSuccess: () => {
      useCartStore.getState().clearCart();
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Apply Coupon ──

export function useApplyCoupon() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (code: string) => cartService.applyCoupon(code),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
