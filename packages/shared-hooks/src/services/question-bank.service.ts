import { apiClient } from '@shared/api-client';

export interface BankQuestionPayload {
  question: string;
  explanation?: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

function toQuery(params?: { page?: number; limit?: number; search?: string }) {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  if (params?.search) q.search = params.search;
  return q;
}

export const questionBankService = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/instructor/question-banks', toQuery(params)),

  getById: (bankId: string) => apiClient.get(`/instructor/question-banks/${bankId}`),

  create: (data: { name: string; description?: string }) =>
    apiClient.post('/instructor/question-banks', data),

  update: (bankId: string, data: { name?: string; description?: string }) =>
    apiClient.patch(`/instructor/question-banks/${bankId}`, data),

  delete: (bankId: string) => apiClient.del(`/instructor/question-banks/${bankId}`),

  addQuestion: (bankId: string, data: BankQuestionPayload) =>
    apiClient.post(`/instructor/question-banks/${bankId}/questions`, data),

  addQuestionsBatch: (bankId: string, questions: BankQuestionPayload[]) =>
    apiClient.post(`/instructor/question-banks/${bankId}/questions/batch`, { questions }),

  updateQuestion: (bankId: string, questionId: string, data: BankQuestionPayload) =>
    apiClient.patch(`/instructor/question-banks/${bankId}/questions/${questionId}`, data),

  deleteQuestion: (bankId: string, questionId: string) =>
    apiClient.del(`/instructor/question-banks/${bankId}/questions/${questionId}`),
};
