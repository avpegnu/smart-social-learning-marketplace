import { apiClient } from '@shared/api-client';

export interface QueryQuestionsParams {
  page?: number;
  limit?: number;
  courseId?: string;
  instructorId?: string;
  search?: string;
  status?: 'all' | 'answered' | 'unanswered';
}

function toQuery(params?: QueryQuestionsParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  if (params?.courseId) q.courseId = params.courseId;
  if (params?.instructorId) q.instructorId = params.instructorId;
  if (params?.search) q.search = params.search;
  if (params?.status && params.status !== 'all') q.status = params.status;
  return q;
}

export const qnaService = {
  getQuestions: (params?: QueryQuestionsParams) => apiClient.get('/questions', toQuery(params)),

  getQuestionDetail: (id: string) => apiClient.get(`/questions/${id}`),

  createAnswer: (questionId: string, data: { content: string }) =>
    apiClient.post(`/questions/${questionId}/answers`, data),

  markBestAnswer: (questionId: string, answerId: string) =>
    apiClient.put(`/questions/${questionId}/best-answer`, { answerId }),
};
