import { apiClient } from '@shared/api-client';

export const learningService = {
  // Course Player
  getLesson: (courseId: string, lessonId: string) =>
    apiClient.get(`/courses/${courseId}/learn/${lessonId}`),

  // Progress
  updateProgress: (
    lessonId: string,
    data: { lastPosition?: number; watchedSegments?: [number, number][] },
  ) => apiClient.put(`/learning/progress/${lessonId}`, data),

  completeLesson: (lessonId: string) => apiClient.post(`/learning/lessons/${lessonId}/complete`),

  getCourseProgress: (courseId: string) => apiClient.get(`/learning/progress/${courseId}`),

  // Quiz
  submitQuiz: (
    lessonId: string,
    answers: Array<{ questionId: string; selectedOptionId: string }>,
  ) => apiClient.post(`/learning/lessons/${lessonId}/quiz/submit`, { answers }),

  getQuizAttempts: (lessonId: string) =>
    apiClient.get(`/learning/lessons/${lessonId}/quiz/attempts`),

  // Dashboard & Streak
  getDashboard: () => apiClient.get('/learning/dashboard'),

  getStreak: () => apiClient.get('/learning/streak'),
};
