import { apiClient } from '@shared/api-client';

export interface AskAiData {
  courseId: string;
  sessionId?: string;
  question: string;
}

export interface IndexStatusItem {
  courseId: string;
  title: string;
  chunkCount: number;
  lastIndexed: string | null; // ISO date string or null
}

export interface BulkIndexResult {
  indexed: number;
  failed: number;
  errors: Array<{ courseId: string; error: string }>;
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

  /** Get AI indexing status for all published courses (admin) */
  getIndexStatus: () =>
    apiClient.get('/ai/tutor/courses/index-status') as unknown as Promise<IndexStatusItem[]>,

  /** Trigger index for a single course (admin/instructor) */
  indexCourse: (courseId: string) =>
    apiClient.post(`/ai/tutor/index/${courseId}`, {}) as unknown as Promise<{ message: string }>,

  /** Bulk index multiple courses (admin) */
  bulkIndex: (courseIds: string[]) =>
    apiClient.post('/ai/tutor/index/bulk', { courseIds }) as unknown as Promise<BulkIndexResult>,
};
