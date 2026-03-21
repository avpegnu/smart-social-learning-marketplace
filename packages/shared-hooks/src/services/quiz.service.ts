import { apiClient } from '@shared/api-client';

export interface QuizOptionPayload {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionPayload {
  question: string;
  explanation?: string;
  options: QuizOptionPayload[];
}

export interface UpsertQuizPayload {
  passingScore?: number;
  maxAttempts?: number;
  timeLimitSeconds?: number;
  questions: QuizQuestionPayload[];
}

export const quizService = {
  get: (courseId: string, lessonId: string) =>
    apiClient.get(`/instructor/courses/${courseId}/lessons/${lessonId}/quiz`),

  upsert: (courseId: string, lessonId: string, data: UpsertQuizPayload) =>
    apiClient.put(`/instructor/courses/${courseId}/lessons/${lessonId}/quiz`, data),

  delete: (courseId: string, lessonId: string) =>
    apiClient.del(`/instructor/courses/${courseId}/lessons/${lessonId}/quiz`),
};
