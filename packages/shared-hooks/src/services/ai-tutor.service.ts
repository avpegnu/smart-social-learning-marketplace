import { apiClient } from '@shared/api-client';

export interface AskAiData {
  courseId: string;
  sessionId?: string;
  question: string;
}

export const aiTutorService = {
  getQuota: () => apiClient.get('/ai/tutor/quota'),

  getSessions: (courseId?: string) =>
    apiClient.get('/ai/tutor/sessions', courseId ? { courseId } : undefined),

  getSessionMessages: (sessionId: string) =>
    apiClient.get(`/ai/tutor/sessions/${sessionId}/messages`),

  /** Non-streaming fallback */
  ask: (data: AskAiData) => apiClient.post('/ai/tutor/ask', data),

  /** SSE streaming — returns raw Response for manual stream reading */
  askStream: (data: AskAiData) => apiClient.streamFetch('/ai/tutor/ask-stream', data),
};
