// Services (Layer 1 — plain API functions)
export { authService } from './services/auth.service';
export type {
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  AuthUser,
  AuthResponse,
} from './services/auth.service';
export { courseService } from './services/course.service';
export type { CourseListParams } from './services/course.service';
export { instructorService } from './services/instructor.service';
export { notificationService } from './services/notification.service';
export { categoryService } from './services/category.service';
export { sectionService } from './services/section.service';
export { chapterService } from './services/chapter.service';
export { lessonService } from './services/lesson.service';
export { quizService } from './services/quiz.service';
export type {
  QuizOptionPayload,
  QuizQuestionPayload,
  UpsertQuizPayload,
} from './services/quiz.service';
export { uploadService } from './services/upload.service';
export type { SignUploadResponse, CompleteUploadPayload } from './services/upload.service';

// Query Hooks (Layer 2 — TanStack Query wrappers)
export {
  useLogin,
  useRegister,
  useVerifyEmail,
  useResendVerification,
  useForgotPassword,
  useResetPassword,
  useLogout,
} from './queries/use-auth';

export {
  useUnreadNotificationCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './queries/use-notifications';

export {
  useInstructorDashboard,
  useInstructorProfile,
  useUpdateInstructorProfile,
  useInstructorApplicationStatus,
} from './queries/use-instructor';

export {
  useCourses,
  useCourseDetail,
  useCourseReviews,
  useInstructorCourses,
  useInstructorCourseDetail,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useSubmitCourseForReview,
  useUpdateCourseTags,
} from './queries/use-courses';

export { useEnrollmentCheck, useEnrollFree, useMyLearning } from './queries/use-enrollments';

export {
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
} from './queries/use-sections';

export {
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useReorderChapters,
} from './queries/use-chapters';

export {
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useReorderLessons,
} from './queries/use-lessons';

export { useQuiz, useUpsertQuiz, useDeleteQuiz } from './queries/use-quiz';

export { useCategories } from './queries/use-categories';

export {
  useAdminDashboard,
  useAdminUsers,
  useAdminPendingApps,
  useAdminCourses,
  useAdminCourseDetail,
  useAdminPendingCourses,
  useAdminWithdrawals,
  useAdminSettings,
  useUpdateUserStatus,
  useReviewApplication,
  useReviewCourse,
  useProcessWithdrawal,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useUpdateSetting,
} from './queries/use-admin';

export { adminService } from './services/admin.service';
export { enrollmentService } from './services/enrollment.service';

// Stores (Layer 3 — Zustand client state)
export { useAuthStore } from './stores/auth-store';
export { useCartStore } from './stores/cart-store';
export { useUIStore } from './stores/ui-store';
export { useSidebarStore } from './stores/sidebar-store';

// Providers
export { AuthProvider } from './providers/auth-provider';

// Utility Hooks
export { useDebounce } from './use-debounce';
export { useMediaQuery } from './use-media-query';
export { useInfiniteScroll } from './use-infinite-scroll';
export { useApiError } from './use-api-error';
export { useAuthHydrated } from './use-auth-hydrated';
export { useChatSocket } from './use-chat-socket';
export { useNotificationSocket } from './use-notification-socket';
