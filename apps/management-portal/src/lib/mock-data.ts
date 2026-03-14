// ── Mock Data for Management Portal ──

export interface StatCard {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  instructor: string;
  instructorAvatar: string;
  students: number;
  revenue: number;
  rating: number;
  reviewCount: number;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED';
  category: string;
  level: string;
  language: string;
  price: number;
  createdAt: string;
  submittedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
  joinedAt: string;
  coursesCount?: number;
}

export interface InstructorApplication {
  id: string;
  name: string;
  email: string;
  avatar: string;
  expertise: string;
  experience: string;
  bio: string;
  linkedIn: string;
  portfolio: string;
  appliedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Withdrawal {
  id: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  requestedAt: string;
  completedAt?: string;
  notes?: string;
  bankName: string;
  accountNumber: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  discountType: 'PERCENT' | 'FIXED';
  usageCount: number;
  usageLimit: number;
  validFrom: string;
  validTo: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  courseId?: string;
  courseName?: string;
}

export interface Question {
  id: string;
  courseId: string;
  courseName: string;
  lessonTitle: string;
  studentName: string;
  studentAvatar: string;
  question: string;
  answerCount: number;
  status: 'ANSWERED' | 'UNANSWERED';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  courseCount: number;
  description: string;
}

export interface Activity {
  id: string;
  type:
    | 'ENROLLMENT'
    | 'REVIEW'
    | 'QUESTION'
    | 'WITHDRAWAL'
    | 'COURSE_SUBMITTED'
    | 'COURSE_APPROVED';
  message: string;
  time: string;
  avatar?: string;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ';
  duration: string;
  order: number;
}

export interface RevenueByMonth {
  month: string;
  revenue: number;
  enrollments: number;
}

export interface UserGrowth {
  month: string;
  students: number;
  instructors: number;
}

export interface CategoryDistribution {
  name: string;
  value: number;
  color: string;
}

// ── Instructor Mock Data ──

export const instructorStats: StatCard[] = [
  {
    label: 'totalRevenue',
    value: '₫12,450,000',
    change: 12.5,
    changeLabel: 'vs last month',
    icon: 'DollarSign',
  },
  { label: 'newStudents', value: '156', change: 8.2, changeLabel: 'vs last month', icon: 'Users' },
  { label: 'publishedCourses', value: '5', change: 0, changeLabel: 'total', icon: 'BookOpen' },
  { label: 'averageRating', value: '4.7', change: 0.3, changeLabel: 'vs last month', icon: 'Star' },
];

export const instructorCourses: Course[] = [
  {
    id: '1',
    title: 'React & Next.js Toàn Diện 2025',
    subtitle: 'Xây dựng ứng dụng web hiện đại',
    thumbnail: '/thumbnails/react.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 234,
    revenue: 4680000,
    rating: 4.8,
    reviewCount: 89,
    status: 'PUBLISHED',
    category: 'Web Development',
    level: 'Intermediate',
    language: 'vi',
    price: 599000,
    createdAt: '2025-01-15',
  },
  {
    id: '2',
    title: 'Node.js & NestJS Backend Master',
    subtitle: 'Backend development chuyên sâu',
    thumbnail: '/thumbnails/nodejs.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 189,
    revenue: 3780000,
    rating: 4.6,
    reviewCount: 67,
    status: 'PUBLISHED',
    category: 'Backend Development',
    level: 'Advanced',
    language: 'vi',
    price: 799000,
    createdAt: '2025-02-20',
  },
  {
    id: '3',
    title: 'TypeScript Nâng Cao',
    subtitle: 'Làm chủ TypeScript từ A-Z',
    thumbnail: '/thumbnails/typescript.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 156,
    revenue: 2340000,
    rating: 4.9,
    reviewCount: 52,
    status: 'PUBLISHED',
    category: 'Programming Languages',
    level: 'Advanced',
    language: 'vi',
    price: 499000,
    createdAt: '2025-03-10',
  },
  {
    id: '4',
    title: 'Docker & Kubernetes Thực Chiến',
    subtitle: 'DevOps cho developer',
    thumbnail: '/thumbnails/docker.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 98,
    revenue: 1470000,
    rating: 4.5,
    reviewCount: 31,
    status: 'PENDING',
    category: 'DevOps',
    level: 'Intermediate',
    language: 'vi',
    price: 699000,
    createdAt: '2025-06-01',
    submittedAt: '2025-06-15',
  },
  {
    id: '5',
    title: 'GraphQL API Design',
    subtitle: 'Thiết kế API với GraphQL',
    thumbnail: '/thumbnails/graphql.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 0,
    revenue: 0,
    rating: 0,
    reviewCount: 0,
    status: 'DRAFT',
    category: 'Backend Development',
    level: 'Intermediate',
    language: 'vi',
    price: 599000,
    createdAt: '2025-07-01',
  },
  {
    id: '6',
    title: 'PostgreSQL Performance Tuning',
    subtitle: 'Tối ưu hóa cơ sở dữ liệu',
    thumbnail: '/thumbnails/postgres.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 45,
    revenue: 675000,
    rating: 4.3,
    reviewCount: 12,
    status: 'PUBLISHED',
    category: 'Database',
    level: 'Advanced',
    language: 'vi',
    price: 449000,
    createdAt: '2025-04-12',
  },
  {
    id: '7',
    title: 'Microservices Architecture',
    subtitle: 'Kiến trúc microservices thực tế',
    thumbnail: '/thumbnails/microservices.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 0,
    revenue: 0,
    rating: 0,
    reviewCount: 0,
    status: 'REJECTED',
    category: 'Software Architecture',
    level: 'Advanced',
    language: 'vi',
    price: 899000,
    createdAt: '2025-05-20',
  },
];

export const instructorRevenueData: RevenueByMonth[] = [
  { month: 'T1', revenue: 1200000, enrollments: 15 },
  { month: 'T2', revenue: 1800000, enrollments: 22 },
  { month: 'T3', revenue: 2100000, enrollments: 28 },
  { month: 'T4', revenue: 1600000, enrollments: 19 },
  { month: 'T5', revenue: 2400000, enrollments: 31 },
  { month: 'T6', revenue: 2800000, enrollments: 35 },
  { month: 'T7', revenue: 3200000, enrollments: 42 },
  { month: 'T8', revenue: 2900000, enrollments: 38 },
  { month: 'T9', revenue: 3500000, enrollments: 45 },
  { month: 'T10', revenue: 3100000, enrollments: 40 },
  { month: 'T11', revenue: 3800000, enrollments: 48 },
  { month: 'T12', revenue: 4200000, enrollments: 52 },
];

export const instructorActivities: Activity[] = [
  {
    id: '1',
    type: 'ENROLLMENT',
    message: 'Trần Thị Bình đã đăng ký khóa React & Next.js',
    time: '5 phút trước',
    avatar: '',
  },
  {
    id: '2',
    type: 'REVIEW',
    message: 'Lê Văn Cường đã đánh giá 5 sao cho TypeScript Nâng Cao',
    time: '1 giờ trước',
    avatar: '',
  },
  {
    id: '3',
    type: 'QUESTION',
    message: 'Phạm Thị Dung hỏi về useEffect trong bài 12',
    time: '2 giờ trước',
    avatar: '',
  },
  {
    id: '4',
    type: 'ENROLLMENT',
    message: 'Hoàng Văn Em đã đăng ký khóa Node.js & NestJS',
    time: '3 giờ trước',
    avatar: '',
  },
  {
    id: '5',
    type: 'REVIEW',
    message: 'Ngô Thị Fương đã đánh giá 4 sao cho React & Next.js',
    time: '5 giờ trước',
    avatar: '',
  },
];

export const instructorWithdrawals: Withdrawal[] = [
  {
    id: '1',
    amount: 5000000,
    status: 'COMPLETED',
    requestedAt: '2025-06-01',
    completedAt: '2025-06-03',
    bankName: 'Vietcombank',
    accountNumber: '***4567',
  },
  {
    id: '2',
    amount: 3000000,
    status: 'COMPLETED',
    requestedAt: '2025-05-15',
    completedAt: '2025-05-17',
    bankName: 'Vietcombank',
    accountNumber: '***4567',
  },
  {
    id: '3',
    amount: 2000000,
    status: 'PENDING',
    requestedAt: '2025-07-01',
    bankName: 'Vietcombank',
    accountNumber: '***4567',
  },
  {
    id: '4',
    amount: 1500000,
    status: 'REJECTED',
    requestedAt: '2025-04-20',
    notes: 'Số dư không đủ',
    bankName: 'Vietcombank',
    accountNumber: '***4567',
  },
];

export const instructorCoupons: Coupon[] = [
  {
    id: '1',
    code: 'SUMMER2025',
    discount: 30,
    discountType: 'PERCENT',
    usageCount: 45,
    usageLimit: 100,
    validFrom: '2025-06-01',
    validTo: '2025-08-31',
    status: 'ACTIVE',
  },
  {
    id: '2',
    code: 'WELCOME10',
    discount: 10,
    discountType: 'PERCENT',
    usageCount: 120,
    usageLimit: 200,
    validFrom: '2025-01-01',
    validTo: '2025-12-31',
    status: 'ACTIVE',
  },
  {
    id: '3',
    code: 'FLASH50K',
    discount: 50000,
    discountType: 'FIXED',
    usageCount: 20,
    usageLimit: 20,
    validFrom: '2025-05-01',
    validTo: '2025-05-07',
    status: 'EXPIRED',
  },
  {
    id: '4',
    code: 'VIP2025',
    discount: 40,
    discountType: 'PERCENT',
    usageCount: 5,
    usageLimit: 10,
    validFrom: '2025-03-01',
    validTo: '2025-12-31',
    status: 'DISABLED',
    courseId: '1',
    courseName: 'React & Next.js Toàn Diện 2025',
  },
];

export const instructorQuestions: Question[] = [
  {
    id: '1',
    courseId: '1',
    courseName: 'React & Next.js Toàn Diện 2025',
    lessonTitle: 'Bài 12: useEffect Hook',
    studentName: 'Phạm Thị Dung',
    studentAvatar: '',
    question:
      'Em không hiểu cleanup function trong useEffect hoạt động như thế nào ạ? Khi nào thì cần dùng cleanup?',
    answerCount: 0,
    status: 'UNANSWERED',
    createdAt: '2025-07-10T08:30:00',
  },
  {
    id: '2',
    courseId: '1',
    courseName: 'React & Next.js Toàn Diện 2025',
    lessonTitle: 'Bài 8: Component Lifecycle',
    studentName: 'Trần Minh Quân',
    studentAvatar: '',
    question:
      'Server Component và Client Component khác nhau ở điểm nào? Khi nào nên dùng loại nào ạ?',
    answerCount: 2,
    status: 'ANSWERED',
    createdAt: '2025-07-09T14:20:00',
  },
  {
    id: '3',
    courseId: '2',
    courseName: 'Node.js & NestJS Backend Master',
    lessonTitle: 'Bài 5: Dependency Injection',
    studentName: 'Lê Hoàng Nam',
    studentAvatar: '',
    question: 'Dependency Injection trong NestJS có gì khác so với Angular không ạ?',
    answerCount: 1,
    status: 'ANSWERED',
    createdAt: '2025-07-08T10:15:00',
  },
  {
    id: '4',
    courseId: '3',
    courseName: 'TypeScript Nâng Cao',
    lessonTitle: 'Bài 15: Generics',
    studentName: 'Vũ Thị Lan',
    studentAvatar: '',
    question:
      'Conditional types với infer keyword em vẫn chưa hiểu rõ lắm. Thầy có thể giải thích thêm được không ạ?',
    answerCount: 0,
    status: 'UNANSWERED',
    createdAt: '2025-07-10T11:45:00',
  },
  {
    id: '5',
    courseId: '2',
    courseName: 'Node.js & NestJS Backend Master',
    lessonTitle: 'Bài 10: Authentication',
    studentName: 'Đỗ Văn Hùng',
    studentAvatar: '',
    question: 'Refresh token rotation có thực sự cần thiết cho mọi dự án không ạ?',
    answerCount: 3,
    status: 'ANSWERED',
    createdAt: '2025-07-07T16:30:00',
  },
];

export const curriculumSections: Section[] = [
  {
    id: 's1',
    title: 'Giới thiệu khóa học',
    order: 1,
    lessons: [
      { id: 'l1', title: 'Chào mừng đến khóa học', type: 'VIDEO', duration: '5:30', order: 1 },
      { id: 'l2', title: 'Cài đặt môi trường', type: 'TEXT', duration: '10 min', order: 2 },
      { id: 'l3', title: 'Kiểm tra kiến thức cơ bản', type: 'QUIZ', duration: '15 min', order: 3 },
    ],
  },
  {
    id: 's2',
    title: 'React Fundamentals',
    order: 2,
    lessons: [
      { id: 'l4', title: 'JSX và Components', type: 'VIDEO', duration: '18:45', order: 1 },
      { id: 'l5', title: 'Props và State', type: 'VIDEO', duration: '22:10', order: 2 },
      { id: 'l6', title: 'Event Handling', type: 'VIDEO', duration: '15:30', order: 3 },
      { id: 'l7', title: 'Bài tập thực hành', type: 'TEXT', duration: '20 min', order: 4 },
      { id: 'l8', title: 'Quiz: React Basics', type: 'QUIZ', duration: '10 min', order: 5 },
    ],
  },
  {
    id: 's3',
    title: 'React Hooks',
    order: 3,
    lessons: [
      { id: 'l9', title: 'useState và useReducer', type: 'VIDEO', duration: '25:00', order: 1 },
      { id: 'l10', title: 'useEffect và Cleanup', type: 'VIDEO', duration: '20:15', order: 2 },
      { id: 'l11', title: 'Custom Hooks', type: 'VIDEO', duration: '18:30', order: 3 },
      {
        id: 'l12',
        title: 'useContext và Global State',
        type: 'VIDEO',
        duration: '22:00',
        order: 4,
      },
    ],
  },
];

// ── Admin Mock Data ──

export const adminStats: StatCard[] = [
  {
    label: 'totalUsers',
    value: '2,847',
    change: 15.3,
    changeLabel: 'vs last month',
    icon: 'Users',
  },
  {
    label: 'totalRevenue',
    value: '₫156,200,000',
    change: 22.1,
    changeLabel: 'vs last month',
    icon: 'DollarSign',
  },
  {
    label: 'activeCourses',
    value: '89',
    change: 5,
    changeLabel: 'new this month',
    icon: 'BookOpen',
  },
  {
    label: 'pendingApprovals',
    value: '12',
    change: -3,
    changeLabel: 'vs last week',
    icon: 'Clock',
  },
];

export const adminUsers: User[] = [
  {
    id: '1',
    name: 'Nguyễn Văn An',
    email: 'an.nguyen@email.com',
    avatar: '',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    joinedAt: '2024-08-15',
    coursesCount: 5,
  },
  {
    id: '2',
    name: 'Trần Thị Bình',
    email: 'binh.tran@email.com',
    avatar: '',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2025-01-20',
  },
  {
    id: '3',
    name: 'Lê Văn Cường',
    email: 'cuong.le@email.com',
    avatar: '',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2025-02-10',
  },
  {
    id: '4',
    name: 'Phạm Thị Dung',
    email: 'dung.pham@email.com',
    avatar: '',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    joinedAt: '2024-11-05',
    coursesCount: 3,
  },
  {
    id: '5',
    name: 'Hoàng Văn Em',
    email: 'em.hoang@email.com',
    avatar: '',
    role: 'STUDENT',
    status: 'INACTIVE',
    joinedAt: '2025-03-01',
  },
  {
    id: '6',
    name: 'Ngô Thị Fương',
    email: 'fuong.ngo@email.com',
    avatar: '',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2025-04-15',
  },
  {
    id: '7',
    name: 'Đặng Văn Giang',
    email: 'giang.dang@email.com',
    avatar: '',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    joinedAt: '2024-09-20',
    coursesCount: 8,
  },
  {
    id: '8',
    name: 'Bùi Thị Hoa',
    email: 'hoa.bui@email.com',
    avatar: '',
    role: 'STUDENT',
    status: 'BANNED',
    joinedAt: '2025-01-10',
  },
  {
    id: '9',
    name: 'Vũ Văn Khoa',
    email: 'khoa.vu@email.com',
    avatar: '',
    role: 'ADMIN',
    status: 'ACTIVE',
    joinedAt: '2024-06-01',
  },
  {
    id: '10',
    name: 'Mai Thị Linh',
    email: 'linh.mai@email.com',
    avatar: '',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2025-05-20',
  },
];

export const instructorApplications: InstructorApplication[] = [
  {
    id: '1',
    name: 'Trần Minh Quân',
    email: 'quan.tran@email.com',
    avatar: '',
    expertise: 'Machine Learning, AI',
    experience: '5 năm kinh nghiệm tại FPT Software, 2 năm giảng dạy tại ĐH Bách Khoa',
    bio: 'Senior ML Engineer với đam mê chia sẻ kiến thức',
    linkedIn: 'linkedin.com/in/quantran',
    portfolio: 'quantran.dev',
    appliedAt: '2025-07-08',
    status: 'PENDING',
  },
  {
    id: '2',
    name: 'Lê Hoàng Nam',
    email: 'nam.le@email.com',
    avatar: '',
    expertise: 'Mobile Development (React Native, Flutter)',
    experience: '4 năm phát triển mobile app, từng làm tại Tiki và Shopee',
    bio: 'Mobile developer đam mê open source',
    linkedIn: 'linkedin.com/in/namle',
    portfolio: 'namle.io',
    appliedAt: '2025-07-06',
    status: 'PENDING',
  },
  {
    id: '3',
    name: 'Vũ Thị Lan',
    email: 'lan.vu@email.com',
    avatar: '',
    expertise: 'UX/UI Design, Figma',
    experience: '6 năm thiết kế product, Lead Designer tại VNG',
    bio: 'Product Designer với nhiều dự án thực tế',
    linkedIn: 'linkedin.com/in/lanvu',
    portfolio: 'lanvu.design',
    appliedAt: '2025-07-05',
    status: 'PENDING',
  },
  {
    id: '4',
    name: 'Đỗ Văn Hùng',
    email: 'hung.do@email.com',
    avatar: '',
    expertise: 'Cybersecurity, Ethical Hacking',
    experience: '7 năm trong lĩnh vực an ninh mạng, OSCP certified',
    bio: 'Security researcher và CTF player',
    linkedIn: 'linkedin.com/in/hungdo',
    portfolio: 'hungdo.sec',
    appliedAt: '2025-07-03',
    status: 'PENDING',
  },
];

export const pendingCourseReviews: Course[] = [
  {
    id: '4',
    title: 'Docker & Kubernetes Thực Chiến',
    subtitle: 'DevOps cho developer',
    thumbnail: '/thumbnails/docker.jpg',
    instructor: 'Nguyễn Văn An',
    instructorAvatar: '',
    students: 0,
    revenue: 0,
    rating: 0,
    reviewCount: 0,
    status: 'PENDING',
    category: 'DevOps',
    level: 'Intermediate',
    language: 'vi',
    price: 699000,
    createdAt: '2025-06-01',
    submittedAt: '2025-06-15',
  },
  {
    id: '8',
    title: 'Machine Learning cơ bản với Python',
    subtitle: 'AI cho người mới bắt đầu',
    thumbnail: '/thumbnails/ml.jpg',
    instructor: 'Phạm Thị Dung',
    instructorAvatar: '',
    students: 0,
    revenue: 0,
    rating: 0,
    reviewCount: 0,
    status: 'PENDING',
    category: 'Data Science',
    level: 'Beginner',
    language: 'vi',
    price: 549000,
    createdAt: '2025-06-20',
    submittedAt: '2025-07-01',
  },
  {
    id: '9',
    title: 'Flutter Mobile Development',
    subtitle: 'Xây dựng ứng dụng di động đa nền tảng',
    thumbnail: '/thumbnails/flutter.jpg',
    instructor: 'Đặng Văn Giang',
    instructorAvatar: '',
    students: 0,
    revenue: 0,
    rating: 0,
    reviewCount: 0,
    status: 'PENDING',
    category: 'Mobile Development',
    level: 'Intermediate',
    language: 'vi',
    price: 649000,
    createdAt: '2025-06-25',
    submittedAt: '2025-07-05',
  },
];

export const adminCategories: Category[] = [
  {
    id: '1',
    name: 'Web Development',
    slug: 'web-development',
    courseCount: 24,
    description: 'Phát triển web frontend và fullstack',
  },
  {
    id: '2',
    name: 'Backend Development',
    slug: 'backend-development',
    courseCount: 18,
    description: 'Phát triển backend và API',
  },
  {
    id: '3',
    name: 'Mobile Development',
    slug: 'mobile-development',
    courseCount: 12,
    description: 'Phát triển ứng dụng di động',
  },
  {
    id: '4',
    name: 'Data Science',
    slug: 'data-science',
    courseCount: 15,
    description: 'Khoa học dữ liệu và machine learning',
  },
  {
    id: '5',
    name: 'DevOps',
    slug: 'devops',
    courseCount: 8,
    description: 'CI/CD, containerization, cloud',
  },
  {
    id: '6',
    name: 'Programming Languages',
    slug: 'programming-languages',
    courseCount: 10,
    description: 'Ngôn ngữ lập trình',
  },
  {
    id: '7',
    name: 'Database',
    slug: 'database',
    courseCount: 6,
    description: 'Quản trị cơ sở dữ liệu',
  },
  {
    id: '8',
    name: 'UX/UI Design',
    slug: 'ux-ui-design',
    courseCount: 9,
    description: 'Thiết kế giao diện và trải nghiệm người dùng',
  },
  {
    id: '9',
    name: 'Software Architecture',
    slug: 'software-architecture',
    courseCount: 5,
    description: 'Kiến trúc phần mềm',
  },
  {
    id: '10',
    name: 'Cybersecurity',
    slug: 'cybersecurity',
    courseCount: 4,
    description: 'An ninh mạng',
  },
];

export const adminUserGrowth: UserGrowth[] = [
  { month: 'T1', students: 120, instructors: 5 },
  { month: 'T2', students: 180, instructors: 8 },
  { month: 'T3', students: 250, instructors: 10 },
  { month: 'T4', students: 310, instructors: 12 },
  { month: 'T5', students: 380, instructors: 15 },
  { month: 'T6', students: 450, instructors: 18 },
  { month: 'T7', students: 520, instructors: 20 },
  { month: 'T8', students: 580, instructors: 22 },
  { month: 'T9', students: 650, instructors: 25 },
  { month: 'T10', students: 720, instructors: 28 },
  { month: 'T11', students: 800, instructors: 30 },
  { month: 'T12', students: 890, instructors: 33 },
];

export const adminRevenueData: RevenueByMonth[] = [
  { month: 'T1', revenue: 8500000, enrollments: 45 },
  { month: 'T2', revenue: 12000000, enrollments: 62 },
  { month: 'T3', revenue: 15500000, enrollments: 78 },
  { month: 'T4', revenue: 11200000, enrollments: 55 },
  { month: 'T5', revenue: 18000000, enrollments: 92 },
  { month: 'T6', revenue: 22500000, enrollments: 110 },
  { month: 'T7', revenue: 25000000, enrollments: 125 },
  { month: 'T8', revenue: 21000000, enrollments: 105 },
  { month: 'T9', revenue: 28000000, enrollments: 140 },
  { month: 'T10', revenue: 24500000, enrollments: 120 },
  { month: 'T11', revenue: 30000000, enrollments: 150 },
  { month: 'T12', revenue: 35000000, enrollments: 170 },
];

export const adminCategoryDistribution: CategoryDistribution[] = [
  { name: 'Web Dev', value: 24, color: '#2563eb' },
  { name: 'Backend', value: 18, color: '#0ea5e9' },
  { name: 'Mobile', value: 12, color: '#a855f7' },
  { name: 'Data Science', value: 15, color: '#d946ef' },
  { name: 'DevOps', value: 8, color: '#ec4899' },
  { name: 'Others', value: 12, color: '#f43f5e' },
];

export const adminActivities: Activity[] = [
  {
    id: '1',
    type: 'COURSE_SUBMITTED',
    message: 'Nguyễn Văn An đã gửi khóa Docker & Kubernetes để duyệt',
    time: '10 phút trước',
  },
  {
    id: '2',
    type: 'ENROLLMENT',
    message: '15 học viên mới đăng ký trong giờ qua',
    time: '1 giờ trước',
  },
  {
    id: '3',
    type: 'WITHDRAWAL',
    message: 'Phạm Thị Dung yêu cầu rút ₫3,000,000',
    time: '2 giờ trước',
  },
  {
    id: '4',
    type: 'COURSE_APPROVED',
    message: 'Khóa Flutter Mobile Development đã được duyệt',
    time: '3 giờ trước',
  },
  { id: '5', type: 'REVIEW', message: 'Có 8 đánh giá mới trong hôm nay', time: '5 giờ trước' },
];

export const adminWithdrawals: Withdrawal[] = [
  {
    id: '1',
    amount: 5000000,
    status: 'PENDING',
    requestedAt: '2025-07-10',
    bankName: 'Vietcombank',
    accountNumber: '***4567',
    notes: 'Nguyễn Văn An',
  },
  {
    id: '2',
    amount: 3000000,
    status: 'PENDING',
    requestedAt: '2025-07-09',
    bankName: 'Techcombank',
    accountNumber: '***8901',
    notes: 'Phạm Thị Dung',
  },
  {
    id: '3',
    amount: 8000000,
    status: 'COMPLETED',
    requestedAt: '2025-07-05',
    completedAt: '2025-07-07',
    bankName: 'BIDV',
    accountNumber: '***2345',
    notes: 'Đặng Văn Giang',
  },
  {
    id: '4',
    amount: 2500000,
    status: 'COMPLETED',
    requestedAt: '2025-07-03',
    completedAt: '2025-07-05',
    bankName: 'Vietcombank',
    accountNumber: '***6789',
    notes: 'Nguyễn Văn An',
  },
  {
    id: '5',
    amount: 1000000,
    status: 'REJECTED',
    requestedAt: '2025-07-01',
    bankName: 'MBBank',
    accountNumber: '***3456',
    notes: 'Số dư không đủ - Lê Hoàng Nam',
  },
];

// ── Course Students Mock Data ──

export interface CourseStudent {
  id: string;
  name: string;
  email: string;
  avatar: string;
  enrolledAt: string;
  progress: number;
  lastActive: string;
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
}

export const courseStudents: CourseStudent[] = [
  {
    id: 's1',
    name: 'Trần Thị Bình',
    email: 'binh.tran@email.com',
    avatar: '',
    enrolledAt: '2025-02-10',
    progress: 85,
    lastActive: '2025-07-10',
    status: 'ACTIVE',
  },
  {
    id: 's2',
    name: 'Lê Văn Cường',
    email: 'cuong.le@email.com',
    avatar: '',
    enrolledAt: '2025-03-05',
    progress: 100,
    lastActive: '2025-07-08',
    status: 'COMPLETED',
  },
  {
    id: 's3',
    name: 'Phạm Thị Dung',
    email: 'dung.pham@email.com',
    avatar: '',
    enrolledAt: '2025-01-20',
    progress: 62,
    lastActive: '2025-07-09',
    status: 'ACTIVE',
  },
  {
    id: 's4',
    name: 'Hoàng Văn Em',
    email: 'em.hoang@email.com',
    avatar: '',
    enrolledAt: '2025-04-15',
    progress: 30,
    lastActive: '2025-06-20',
    status: 'INACTIVE',
  },
  {
    id: 's5',
    name: 'Ngô Thị Fương',
    email: 'fuong.ngo@email.com',
    avatar: '',
    enrolledAt: '2025-05-01',
    progress: 45,
    lastActive: '2025-07-10',
    status: 'ACTIVE',
  },
  {
    id: 's6',
    name: 'Đặng Văn Giang',
    email: 'giang.dang@email.com',
    avatar: '',
    enrolledAt: '2025-03-20',
    progress: 100,
    lastActive: '2025-07-05',
    status: 'COMPLETED',
  },
  {
    id: 's7',
    name: 'Bùi Thị Hoa',
    email: 'hoa.bui@email.com',
    avatar: '',
    enrolledAt: '2025-06-10',
    progress: 15,
    lastActive: '2025-07-10',
    status: 'ACTIVE',
  },
  {
    id: 's8',
    name: 'Vũ Văn Khoa',
    email: 'khoa.vu@email.com',
    avatar: '',
    enrolledAt: '2025-02-28',
    progress: 78,
    lastActive: '2025-07-09',
    status: 'ACTIVE',
  },
  {
    id: 's9',
    name: 'Mai Thị Linh',
    email: 'linh.mai@email.com',
    avatar: '',
    enrolledAt: '2025-04-01',
    progress: 55,
    lastActive: '2025-05-15',
    status: 'INACTIVE',
  },
  {
    id: 's10',
    name: 'Trần Minh Quân',
    email: 'quan.tran@email.com',
    avatar: '',
    enrolledAt: '2025-06-20',
    progress: 22,
    lastActive: '2025-07-10',
    status: 'ACTIVE',
  },
];

// ── Admin Withdrawal Requests (extended) ──

export interface AdminWithdrawalRequest {
  id: string;
  instructorName: string;
  instructorAvatar: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  completedAt?: string;
  rejectReason?: string;
}

export const adminWithdrawalRequests: AdminWithdrawalRequest[] = [
  {
    id: 'w1',
    instructorName: 'Nguyễn Văn An',
    instructorAvatar: '',
    amount: 5000000,
    bankName: 'Vietcombank',
    accountNumber: '***4567',
    requestedAt: '2025-07-10',
    status: 'PENDING',
  },
  {
    id: 'w2',
    instructorName: 'Phạm Thị Dung',
    instructorAvatar: '',
    amount: 3000000,
    bankName: 'Techcombank',
    accountNumber: '***8901',
    requestedAt: '2025-07-09',
    status: 'PENDING',
  },
  {
    id: 'w3',
    instructorName: 'Đặng Văn Giang',
    instructorAvatar: '',
    amount: 8000000,
    bankName: 'BIDV',
    accountNumber: '***2345',
    requestedAt: '2025-07-05',
    status: 'COMPLETED',
    completedAt: '2025-07-07',
  },
  {
    id: 'w4',
    instructorName: 'Nguyễn Văn An',
    instructorAvatar: '',
    amount: 2500000,
    bankName: 'Vietcombank',
    accountNumber: '***6789',
    requestedAt: '2025-07-03',
    status: 'APPROVED',
  },
  {
    id: 'w5',
    instructorName: 'Lê Hoàng Nam',
    instructorAvatar: '',
    amount: 1000000,
    bankName: 'MBBank',
    accountNumber: '***3456',
    requestedAt: '2025-07-01',
    status: 'REJECTED',
    rejectReason: 'Số dư không đủ',
  },
  {
    id: 'w6',
    instructorName: 'Vũ Thị Lan',
    instructorAvatar: '',
    amount: 4500000,
    bankName: 'ACB',
    accountNumber: '***7890',
    requestedAt: '2025-06-28',
    status: 'COMPLETED',
    completedAt: '2025-06-30',
  },
  {
    id: 'w7',
    instructorName: 'Trần Minh Quân',
    instructorAvatar: '',
    amount: 2000000,
    bankName: 'VPBank',
    accountNumber: '***1234',
    requestedAt: '2025-07-08',
    status: 'PENDING',
  },
  {
    id: 'w8',
    instructorName: 'Đỗ Văn Hùng',
    instructorAvatar: '',
    amount: 6000000,
    bankName: 'Vietinbank',
    accountNumber: '***5678',
    requestedAt: '2025-06-25',
    status: 'COMPLETED',
    completedAt: '2025-06-27',
  },
];

// ── Reports Mock Data ──

export interface Report {
  id: string;
  reporterName: string;
  reporterAvatar: string;
  contentType: 'POST' | 'COMMENT' | 'COURSE';
  contentPreview: string;
  reason: string;
  reportedAt: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'BANNED';
}

export interface UserReport {
  id: string;
  reportedUserName: string;
  reportedUserAvatar: string;
  reporterName: string;
  reason: string;
  reportCount: number;
  status: 'PENDING' | 'REVIEWED' | 'BANNED';
}

export const contentReports: Report[] = [
  {
    id: 'r1',
    reporterName: 'Trần Thị Bình',
    reporterAvatar: '',
    contentType: 'COMMENT',
    contentPreview: 'Nội dung quảng cáo spam không liên quan đến bài học...',
    reason: 'Spam',
    reportedAt: '2025-07-10',
    status: 'PENDING',
  },
  {
    id: 'r2',
    reporterName: 'Lê Văn Cường',
    reporterAvatar: '',
    contentType: 'POST',
    contentPreview: 'Bài viết chứa ngôn ngữ xúc phạm và nội dung không phù hợp...',
    reason: 'Ngôn ngữ xúc phạm',
    reportedAt: '2025-07-09',
    status: 'PENDING',
  },
  {
    id: 'r3',
    reporterName: 'Phạm Thị Dung',
    reporterAvatar: '',
    contentType: 'COURSE',
    contentPreview: 'Khóa học sao chép nội dung từ nguồn khác không ghi nguồn...',
    reason: 'Vi phạm bản quyền',
    reportedAt: '2025-07-08',
    status: 'REVIEWED',
  },
  {
    id: 'r4',
    reporterName: 'Hoàng Văn Em',
    reporterAvatar: '',
    contentType: 'COMMENT',
    contentPreview: 'Đăng link lừa đảo trong phần bình luận bài học...',
    reason: 'Lừa đảo',
    reportedAt: '2025-07-07',
    status: 'BANNED',
  },
  {
    id: 'r5',
    reporterName: 'Ngô Thị Fương',
    reporterAvatar: '',
    contentType: 'POST',
    contentPreview: 'Chia sẻ thông tin cá nhân của giảng viên khác...',
    reason: 'Vi phạm quyền riêng tư',
    reportedAt: '2025-07-06',
    status: 'DISMISSED',
  },
  {
    id: 'r6',
    reporterName: 'Đặng Văn Giang',
    reporterAvatar: '',
    contentType: 'COURSE',
    contentPreview: 'Nội dung khóa học lỗi thời, không đúng như mô tả...',
    reason: 'Thông tin sai lệch',
    reportedAt: '2025-07-05',
    status: 'PENDING',
  },
];

export const userReports: UserReport[] = [
  {
    id: 'ur1',
    reportedUserName: 'Bùi Thị Hoa',
    reportedUserAvatar: '',
    reporterName: 'Trần Thị Bình',
    reason: 'Spam nhiều bình luận quảng cáo',
    reportCount: 5,
    status: 'BANNED',
  },
  {
    id: 'ur2',
    reportedUserName: 'Hoàng Văn Em',
    reportedUserAvatar: '',
    reporterName: 'Lê Văn Cường',
    reason: 'Quấy rối học viên khác',
    reportCount: 3,
    status: 'PENDING',
  },
  {
    id: 'ur3',
    reportedUserName: 'Mai Thị Linh',
    reportedUserAvatar: '',
    reporterName: 'Phạm Thị Dung',
    reason: 'Tạo nhiều tài khoản giả',
    reportCount: 2,
    status: 'REVIEWED',
  },
  {
    id: 'ur4',
    reportedUserName: 'Trần Minh Quân',
    reportedUserAvatar: '',
    reporterName: 'Ngô Thị Fương',
    reason: 'Chia sẻ nội dung bất hợp pháp',
    reportCount: 4,
    status: 'PENDING',
  },
];

// ── System Settings Mock Data ──

export interface SystemSettings {
  general: {
    platformName: string;
    platformDescription: string;
    maintenanceMode: boolean;
  };
  commission: {
    commissionRate: number;
    minimumWithdrawal: number;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
  };
  content: {
    autoApproveCourses: boolean;
    maxUploadSize: number;
  };
}

export const systemSettings: SystemSettings = {
  general: {
    platformName: 'Smart Social Learning Marketplace',
    platformDescription: 'Nền tảng học trực tuyến hàng đầu Việt Nam',
    maintenanceMode: false,
  },
  commission: {
    commissionRate: 20,
    minimumWithdrawal: 500000,
  },
  email: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: 'no-reply@smartlearning.vn',
  },
  content: {
    autoApproveCourses: false,
    maxUploadSize: 500,
  },
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}
