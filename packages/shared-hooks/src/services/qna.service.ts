import { apiClient } from '@shared/api-client';

export interface QueryQuestionsParams {
  page?: number;
  limit?: number;
  courseId?: string;
  instructorId?: string;
  search?: string;
  status?: 'all' | 'answered' | 'unanswered';
}

export interface CreateQuestionData {
  title: string;
  content: string;
  courseId?: string;
  codeSnippet?: { language: string; code: string };
}

export interface UpdateQuestionData {
  title?: string;
  content?: string;
  codeSnippet?: { language: string; code: string };
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

  findSimilar: (title: string) => apiClient.get('/questions/similar', { title }),

  createQuestion: (data: CreateQuestionData) => apiClient.post('/questions', data),

  updateQuestion: (id: string, data: UpdateQuestionData) => apiClient.put(`/questions/${id}`, data),

  deleteQuestion: (id: string) => apiClient.del(`/questions/${id}`),

  createAnswer: (
    questionId: string,
    data: { content: string; codeSnippet?: { language: string; code: string } },
  ) => apiClient.post(`/questions/${questionId}/answers`, data),

  deleteAnswer: (id: string) => apiClient.del(`/answers/${id}`),

  markBestAnswer: (questionId: string, answerId: string) =>
    apiClient.put(`/questions/${questionId}/best-answer`, { answerId }),

  voteAnswer: (answerId: string, value: number) =>
    apiClient.post(`/answers/${answerId}/vote`, { value }),
};
