import { apiClient } from '@shared/api-client';

export const instructorService = {
  getDashboard: () => apiClient.get('/instructor/dashboard'),

  getProfile: () => apiClient.get('/instructor/profile'),

  updateProfile: (data: Record<string, unknown>) => apiClient.patch('/instructor/profile', data),

  getApplicationStatus: () => apiClient.get('/instructor/applications/me'),

  submitApplication: (data: Record<string, unknown>) =>
    apiClient.post('/instructor/applications', data),

  getCourseStudents: (
    courseId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) => {
    const q: Record<string, string> = {};
    if (params?.page) q.page = String(params.page);
    if (params?.limit) q.limit = String(params.limit);
    if (params?.search) q.search = params.search;
    return apiClient.get(`/instructor/courses/${courseId}/students`, q);
  },
};
