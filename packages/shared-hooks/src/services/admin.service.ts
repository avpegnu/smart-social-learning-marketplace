import { apiClient } from '@shared/api-client';

export const adminService = {
  // Dashboard
  getDashboard: () => apiClient.get('/admin/dashboard'),

  // Users
  getUsers: (params: Record<string, string>) => apiClient.get('/admin/users', params),
  updateUserStatus: (userId: string, data: { status: string; reason?: string }) =>
    apiClient.patch(`/admin/users/${userId}/status`, data),

  // Instructor Applications
  getPendingApplications: (params: Record<string, string>) =>
    apiClient.get('/admin/applications', params),
  reviewApplication: (appId: string, data: { approved: boolean; reviewNote?: string }) =>
    apiClient.patch(`/admin/applications/${appId}`, data),

  // Courses
  getAllCourses: (params: Record<string, string>) => apiClient.get('/admin/courses', params),
  getCourseDetail: (courseId: string) => apiClient.get(`/admin/courses/${courseId}`),
  getPendingCourses: (params: Record<string, string>) =>
    apiClient.get('/admin/courses/pending', params),
  reviewCourse: (courseId: string, data: { approved: boolean; feedback?: string }) =>
    apiClient.patch(`/admin/courses/${courseId}/review`, data),

  // Withdrawals
  getPendingWithdrawals: (params: Record<string, string>) =>
    apiClient.get('/admin/withdrawals', params),
  processWithdrawal: (id: string, data: { status: string; reviewNote?: string }) =>
    apiClient.patch(`/admin/withdrawals/${id}`, data),

  // Categories
  createCategory: (data: {
    name: string;
    description?: string;
    parentId?: string;
    order?: number;
  }) => apiClient.post('/admin/categories', data),
  updateCategory: (id: string, data: { name?: string; description?: string; order?: number }) =>
    apiClient.patch(`/admin/categories/${id}`, data),
  deleteCategory: (id: string) => apiClient.del(`/admin/categories/${id}`),

  // Tags
  getTags: (params?: Record<string, string>) => apiClient.get('/admin/tags', params),
  createTag: (data: { name: string }) => apiClient.post('/admin/tags', data),
  updateTag: (id: string, data: { name: string }) => apiClient.patch(`/admin/tags/${id}`, data),
  deleteTag: (id: string) => apiClient.del(`/admin/tags/${id}`),

  // Reports
  getReports: (params: Record<string, string>) => apiClient.get('/admin/reports', params),
  reviewReport: (id: string, data: { status: string; adminNote?: string }) =>
    apiClient.patch(`/admin/reports/${id}`, data),

  // Analytics
  getAnalytics: (params: Record<string, string>) => apiClient.get('/admin/analytics', params),

  // Settings
  getSettings: () => apiClient.get('/admin/settings'),
  updateSetting: (data: { key: string; value: unknown }) => apiClient.put('/admin/settings', data),
};
