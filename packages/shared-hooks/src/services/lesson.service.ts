import { apiClient } from '@shared/api-client';

export const lessonService = {
  create: (
    courseId: string,
    chapterId: string,
    data: {
      title: string;
      type: 'VIDEO' | 'TEXT' | 'QUIZ';
      textContent?: string;
      estimatedDuration?: number;
      order?: number;
    },
  ) => apiClient.post(`/instructor/courses/${courseId}/chapters/${chapterId}/lessons`, data),

  update: (
    courseId: string,
    chapterId: string,
    lessonId: string,
    data: { title?: string; textContent?: string; estimatedDuration?: number },
  ) =>
    apiClient.patch(
      `/instructor/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`,
      data,
    ),

  delete: (courseId: string, chapterId: string, lessonId: string) =>
    apiClient.del(`/instructor/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`),

  reorder: (courseId: string, chapterId: string, orderedIds: string[]) =>
    apiClient.put(`/instructor/courses/${courseId}/chapters/${chapterId}/lessons/reorder`, {
      orderedIds,
    }),
};
