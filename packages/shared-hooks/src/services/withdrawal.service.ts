import { apiClient } from '@shared/api-client';

export interface CreateWithdrawalPayload {
  amount: number;
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

function toQuery(params?: { page?: number; limit?: number }): Record<string, string> {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  return q;
}

export const withdrawalService = {
  getHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/instructor/withdrawals', toQuery(params)),

  request: (data: CreateWithdrawalPayload) => apiClient.post('/instructor/withdrawals', data),
};
