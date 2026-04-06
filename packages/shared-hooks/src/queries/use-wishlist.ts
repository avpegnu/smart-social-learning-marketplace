'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { useAuthStore } from '../stores/auth-store';
import { wishlistService } from '../services/wishlist.service';

// ── Get Wishlist (paginated) ──

export function useWishlist(params?: Record<string, string>) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['wishlists', params],
    queryFn: () => wishlistService.getAll(params),
    enabled: isAuthenticated,
  });
}

// ── Add to Wishlist ──

export function useAddToWishlist() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => wishlistService.add(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlists'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Remove from Wishlist ──

export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => wishlistService.remove(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlists'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
