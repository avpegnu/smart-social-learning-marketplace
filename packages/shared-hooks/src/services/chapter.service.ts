import { apiClient } from '@shared/api-client';

export const chapterService = {
  create: (
    courseId: string,
    sectionId: string,
    data: {
      title: string;
      description?: string;
      price?: number;
      isFreePreview?: boolean;
      order?: number;
    },
  ) => apiClient.post(`/instructor/courses/${courseId}/sections/${sectionId}/chapters`, data),

  update: (
    courseId: string,
    sectionId: string,
    chapterId: string,
    data: { title?: string; description?: string; price?: number; isFreePreview?: boolean },
  ) =>
    apiClient.patch(
      `/instructor/courses/${courseId}/sections/${sectionId}/chapters/${chapterId}`,
      data,
    ),

  delete: (courseId: string, sectionId: string, chapterId: string) =>
    apiClient.del(`/instructor/courses/${courseId}/sections/${sectionId}/chapters/${chapterId}`),

  reorder: (courseId: string, sectionId: string, orderedIds: string[]) =>
    apiClient.put(`/instructor/courses/${courseId}/sections/${sectionId}/chapters/reorder`, {
      orderedIds,
    }),
};
