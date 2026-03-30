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
  useInfiniteNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './queries/use-notifications';

export {
  useInstructorDashboard,
  useInstructorProfile,
  useUpdateInstructorProfile,
  useInstructorApplicationStatus,
  useInstructorCourseStudents,
} from './queries/use-instructor';

export {
  useCourses,
  useCourseDetail,
  useCourseReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
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
export { useTags } from './queries/use-tags';

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
  useAdminTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useUpdateSetting,
  useAdminReports,
  useReviewReport,
  useAdminAnalytics,
} from './queries/use-admin';

export {
  useServerCart,
  useAddCartItem,
  useRemoveCartItem,
  useClearCart,
  useMergeCart,
  useApplyCoupon,
} from './queries/use-cart';

export { useCreateOrder, useOrders, useOrderDetail, useOrderStatus } from './queries/use-orders';

export { useWishlist, useAddToWishlist, useRemoveFromWishlist } from './queries/use-wishlist';

export {
  useLesson,
  useUpdateProgress,
  useCompleteLesson,
  useCourseProgress,
  useSubmitQuiz,
  useQuizAttempts,
  useLearningDashboard,
  useStreak,
} from './queries/use-learning';

export { useMyCertificates } from './queries/use-certificates';

export {
  useInstructorCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeactivateCoupon,
} from './queries/use-coupons';

export { useInstructorWithdrawals, useRequestWithdrawal } from './queries/use-withdrawals';

export {
  useQuestions,
  useQuestionDetail,
  useSimilarQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useCreateAnswer,
  useDeleteAnswer,
  useMarkBestAnswer,
  useVoteAnswer,
} from './queries/use-qna';

export { useAiQuota, useAiSessions, useSessionMessages } from './queries/use-ai-tutor';

export { useRecommendations } from './queries/use-recommendations';

export {
  useQuestionBanks,
  useQuestionBankDetail,
  useCreateQuestionBank,
  useUpdateQuestionBank,
  useDeleteQuestionBank,
  useAddBankQuestion,
  useAddBankQuestionsBatch,
  useUpdateBankQuestion,
  useDeleteBankQuestion,
} from './queries/use-question-banks';

export {
  useSearchUsers,
  useMe,
  useUserProfile,
  useUpdateProfile,
  useChangePassword,
  useUpdateNotificationPreferences,
  useFollowUser,
  useUnfollowUser,
  useUserFollowers,
  useUserFollowing,
  useApplyInstructor,
  useMyApplications,
} from './queries/use-users';

export {
  useFeed,
  useBookmarks,
  usePost,
  useComments,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
  useToggleLike,
  useToggleBookmark,
  useSharePost,
  useCreateComment,
  useDeleteComment,
} from './queries/use-social';

export {
  useGroups,
  useGroup,
  useGroupMembers,
  useGroupPosts,
  useJoinRequests,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useJoinGroup,
  useLeaveGroup,
  useCreateGroupPost,
  useUpdateMemberRole,
  useKickMember,
  useApproveRequest,
  useRejectRequest,
} from './queries/use-groups';

export {
  useConversations,
  useMessages,
  useGetOrCreateConversation,
  useSendMessage,
} from './queries/use-chat';

export { adminService } from './services/admin.service';
export { enrollmentService } from './services/enrollment.service';
export { cartService } from './services/cart.service';
export { orderService } from './services/order.service';
export { wishlistService } from './services/wishlist.service';
export { learningService } from './services/learning.service';
export { certificateService } from './services/certificate.service';
export { couponService } from './services/coupon.service';
export type { CreateCouponPayload, UpdateCouponPayload } from './services/coupon.service';
export { withdrawalService } from './services/withdrawal.service';
export type { CreateWithdrawalPayload } from './services/withdrawal.service';
export { socialService } from './services/social.service';
export type { CreatePostData, UpdatePostData, CreateCommentData } from './services/social.service';
export { groupService } from './services/group.service';
export type { CreateGroupData, UpdateGroupData } from './services/group.service';
export { chatService } from './services/chat.service';
export type { CreateConversationData, SendMessageData } from './services/chat.service';
export { qnaService } from './services/qna.service';
export type {
  QueryQuestionsParams,
  CreateQuestionData,
  UpdateQuestionData,
} from './services/qna.service';
export { aiTutorService } from './services/ai-tutor.service';
export type { AskAiData } from './services/ai-tutor.service';
export { recommendationService } from './services/recommendation.service';
export type { RecommendedCourse, RecommendationContext } from './services/recommendation.service';
export { tagService } from './services/tag.service';
export { questionBankService } from './services/question-bank.service';
export type { BankQuestionPayload } from './services/question-bank.service';
export { userService } from './services/user.service';
export type {
  UpdateProfilePayload,
  ChangePasswordPayload,
  NotificationPreferences,
  ApplyInstructorPayload,
} from './services/user.service';

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
export type { ChatSocketCallbacks } from './use-chat-socket';
export { useNotificationSocket } from './use-notification-socket';
