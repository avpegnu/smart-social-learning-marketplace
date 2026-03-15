// Stores
export { useAuthStore } from './stores/auth-store';
export { useCartStore } from './stores/cart-store';
export { useUIStore } from './stores/ui-store';

// Hooks
export { useDebounce } from './use-debounce';
export { useMediaQuery } from './use-media-query';
export { useInfiniteScroll } from './use-infinite-scroll';
export { useApiError } from './use-api-error';
export { useAuthHydrated } from './use-auth-hydrated';
export { useChatSocket } from './use-chat-socket';
export { useNotificationSocket } from './use-notification-socket';

// API Hooks
export {
  useLogin,
  useRegister,
  useVerifyEmail,
  useResendVerification,
  useForgotPassword,
  useResetPassword,
  useLogout,
} from './api/use-auth';

export {
  useUnreadNotificationCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './api/use-notifications';

export {
  useInstructorDashboard,
  useInstructorProfile,
  useUpdateInstructorProfile,
  useInstructorApplicationStatus,
} from './api/use-instructor';

export {
  useInstructorCourses,
  useInstructorCourseDetail,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useSubmitCourseForReview,
  useUpdateCourseTags,
} from './api/use-courses';
