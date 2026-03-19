import { apiClient } from '@shared/api-client';

// --- Types ---

export interface CourseListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

// --- Service ---

function toQueryParams(params?: CourseListParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  if (params?.status) q.status = params.status;
  if (params?.search) q.search = params.search;
  return q;
}

export const courseService = {
  // Instructor course management
  getInstructorCourses: (params?: CourseListParams) =>
    apiClient.get('/instructor/courses', toQueryParams(params)),

  getInstructorCourseDetail: (courseId: string) => apiClient.get(`/instructor/courses/${courseId}`),

  create: (data: Record<string, unknown>) => apiClient.post('/instructor/courses', data),

  update: (courseId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/instructor/courses/${courseId}`, data),

  delete: (courseId: string) => apiClient.del(`/instructor/courses/${courseId}`),

  submitForReview: (courseId: string) => apiClient.post(`/instructor/courses/${courseId}/submit`),

  updateTags: (courseId: string, tagIds: string[]) =>
    apiClient.put(`/instructor/courses/${courseId}/tags`, { tagIds }),

  // Public course browsing
  browse: (params?: Record<string, string>) => apiClient.get('/courses', params),

  getBySlug: (slug: string) => apiClient.get(`/courses/${slug}`),
};
