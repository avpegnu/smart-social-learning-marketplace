import { apiClient } from '@shared/api-client';

export const sectionService = {
  create: (courseId: string, data: { title: string; order?: number }) =>
    apiClient.post(`/instructor/courses/${courseId}/sections`, data),

  update: (courseId: string, sectionId: string, data: { title?: string; order?: number }) =>
    apiClient.patch(`/instructor/courses/${courseId}/sections/${sectionId}`, data),

  delete: (courseId: string, sectionId: string) =>
    apiClient.del(`/instructor/courses/${courseId}/sections/${sectionId}`),

  reorder: (courseId: string, orderedIds: string[]) =>
    apiClient.put(`/instructor/courses/${courseId}/sections/reorder`, { orderedIds }),
};
