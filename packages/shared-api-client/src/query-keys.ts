export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    profile: (id: string) => ['users', id] as const,
    followers: (id: string) => ['users', id, 'followers'] as const,
    following: (id: string) => ['users', id, 'following'] as const,
  },
  courses: {
    all: ['courses'] as const,
    list: (params?: Record<string, unknown>) => ['courses', 'list', params] as const,
    detail: (slug: string) => ['courses', slug] as const,
    reviews: (courseId: string) => ['courses', courseId, 'reviews'] as const,
  },
  instructor: {
    courses: ['instructor', 'courses'] as const,
    course: (id: string) => ['instructor', 'courses', id] as const,
    dashboard: ['instructor', 'dashboard'] as const,
    coupons: ['instructor', 'coupons'] as const,
    withdrawals: ['instructor', 'withdrawals'] as const,
  },
  cart: {
    all: ['cart'] as const,
  },
  wishlists: {
    all: ['wishlists'] as const,
  },
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => ['orders', id] as const,
    status: (id: string) => ['orders', id, 'status'] as const,
  },
  enrollments: {
    myLearning: ['enrollments', 'my-learning'] as const,
    check: (courseId: string) => ['enrollments', 'check', courseId] as const,
  },
  learning: {
    lesson: (courseId: string, lessonId: string) => ['learning', courseId, lessonId] as const,
    progress: (courseId: string) => ['learning', 'progress', courseId] as const,
    streak: ['learning', 'streak'] as const,
    dashboard: ['learning', 'dashboard'] as const,
  },
  social: {
    feed: ['social', 'feed'] as const,
    post: (id: string) => ['social', 'posts', id] as const,
    bookmarks: ['social', 'bookmarks'] as const,
  },
  groups: {
    all: ['groups'] as const,
    detail: (id: string) => ['groups', id] as const,
    posts: (id: string) => ['groups', id, 'posts'] as const,
    members: (id: string) => ['groups', id, 'members'] as const,
  },
  chat: {
    conversations: ['chat', 'conversations'] as const,
    messages: (id: string) => ['chat', id, 'messages'] as const,
  },
  qna: {
    questions: ['qna', 'questions'] as const,
    question: (id: string) => ['qna', 'questions', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  certificates: {
    my: ['certificates', 'my'] as const,
  },
  admin: {
    dashboard: ['admin', 'dashboard'] as const,
    users: ['admin', 'users'] as const,
    applications: ['admin', 'applications'] as const,
    courses: ['admin', 'courses'] as const,
    reports: ['admin', 'reports'] as const,
    withdrawals: ['admin', 'withdrawals'] as const,
    settings: ['admin', 'settings'] as const,
  },
} as const;
