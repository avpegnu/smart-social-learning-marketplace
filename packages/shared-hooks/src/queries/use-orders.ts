'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { useCartStore } from '../stores/cart-store';
import { orderService } from '../services/order.service';

// ── Create Order (checkout) ──

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (couponCode?: string) => orderService.create(couponCode),
    onSuccess: () => {
      useCartStore.getState().clearCart();
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Order History (paginated) ──

export function useOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => orderService.getHistory(params),
  });
}

// ── Order Detail ──

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => orderService.getById(orderId),
    enabled: !!orderId,
  });
}

// ── Order Status (polling for payment page) ──

export function useOrderStatus(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId, 'status'],
    queryFn: () => orderService.getStatus(orderId),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const status = (query.state.data as { data?: { status?: string } } | undefined)?.data?.status;
      if (status === 'COMPLETED' || status === 'EXPIRED') return false;
      return 5000;
    },
  });
}
