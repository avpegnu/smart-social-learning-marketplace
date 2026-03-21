'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { withdrawalService, type CreateWithdrawalPayload } from '../services/withdrawal.service';

export function useInstructorWithdrawals(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['instructor', 'withdrawals', params],
    queryFn: () => withdrawalService.getHistory(params),
  });
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreateWithdrawalPayload) => withdrawalService.request(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
