import { apiClient } from '@shared/api-client';

export const instructorService = {
  getDashboard: () => apiClient.get('/instructor/dashboard'),

  getProfile: () => apiClient.get('/instructor/profile'),

  updateProfile: (data: Record<string, unknown>) => apiClient.patch('/instructor/profile', data),

  getApplicationStatus: () => apiClient.get('/instructor/applications/me'),

  submitApplication: (data: Record<string, unknown>) =>
    apiClient.post('/instructor/applications', data),
};
