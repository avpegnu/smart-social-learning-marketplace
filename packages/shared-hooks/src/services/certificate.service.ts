import { apiClient } from '@shared/api-client';

export const certificateService = {
  getMy: () => apiClient.get('/certificates/my'),

  verify: (code: string) => apiClient.get(`/certificates/verify/${code}`),
};
