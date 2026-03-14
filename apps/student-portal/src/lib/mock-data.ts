export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  instructor: {
    id: string;
    name: string;
    avatar: string;
    title: string;
    bio: string;
    totalStudents: number;
    totalCourses: number;
    rating: number;
  };
  price: number;
  originalPrice: number;
  rating: number;
  totalRatings: number;
  totalStudents: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  language: string;
  totalLessons: number;
  totalDuration: string;
  updatedAt: string;
  whatYouLearn: string[];
  prerequisites: string[];
  sections: CourseSection[];
  isBestseller?: boolean;
  isNew?: boolean;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'quiz' | 'exercise' | 'reading';
  isPreview?: boolean;
  isCompleted?: boolean;
}

export interface Review {
  id: string;
  user: { name: string; avatar: string };
  rating: number;
  comment: string;
  date: string;
  helpful: number;
}

export interface Post {
  id: string;
  author: { name: string; avatar: string; title: string };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
  isLiked?: boolean;
}

export interface Conversation {
  id: string;
  user: { name: string; avatar: string; isOnline: boolean };
  lastMessage: string;
  time: string;
  unread: number;
}

export interface Message {
  id: string;
  content: string;
  sender: 'me' | 'other';
  time: string;
}

export interface CartItem {
  id: string;
  course: Course;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  author: { name: string; avatar: string };
  votes: number;
  answers: number;
  views: number;
  tags: string[];
  createdAt: string;
  courseTitle?: string;
}

export const categories = [
  { id: 'web-dev', name: 'Web Development', nameVi: 'Phát triển Web', icon: '🌐', count: 120 },
  { id: 'mobile', name: 'Mobile Development', nameVi: 'Phát triển Mobile', icon: '📱', count: 85 },
  {
    id: 'ai-ml',
    name: 'AI / Machine Learning',
    nameVi: 'AI / Machine Learning',
    icon: '🤖',
    count: 64,
  },
  { id: 'data', name: 'Data Science', nameVi: 'Khoa học dữ liệu', icon: '📊', count: 72 },
  { id: 'design', name: 'Design', nameVi: 'Thiết kế', icon: '🎨', count: 55 },
  { id: 'devops', name: 'DevOps', nameVi: 'DevOps', icon: '⚙️', count: 38 },
  { id: 'security', name: 'Cyber Security', nameVi: 'An ninh mạng', icon: '🔒', count: 29 },
  { id: 'blockchain', name: 'Blockchain', nameVi: 'Blockchain', icon: '⛓️', count: 22 },
];

const instructors = [
  {
    id: 'ins-1',
    name: 'Nguyễn Văn An',
    avatar: '/avatars/instructor-1.jpg',
    title: 'Senior Full-Stack Developer',
    bio: '10+ năm kinh nghiệm phát triển web, từng làm việc tại FPT, Viettel.',
    totalStudents: 15000,
    totalCourses: 12,
    rating: 4.8,
  },
  {
    id: 'ins-2',
    name: 'Trần Thị Bình',
    avatar: '/avatars/instructor-2.jpg',
    title: 'AI/ML Engineer tại Google',
    bio: 'Tiến sĩ AI từ ĐH Bách Khoa, chuyên gia Deep Learning.',
    totalStudents: 8500,
    totalCourses: 8,
    rating: 4.9,
  },
  {
    id: 'ins-3',
    name: 'Lê Minh Cường',
    avatar: '/avatars/instructor-3.jpg',
    title: 'Mobile Developer Lead',
    bio: '8 năm phát triển ứng dụng iOS/Android, founder của AppStudio.',
    totalStudents: 12000,
    totalCourses: 10,
    rating: 4.7,
  },
  {
    id: 'ins-4',
    name: 'Phạm Hoàng Dũng',
    avatar: '/avatars/instructor-4.jpg',
    title: 'DevOps Architect',
    bio: 'AWS Solutions Architect, Kubernetes specialist.',
    totalStudents: 6000,
    totalCourses: 6,
    rating: 4.6,
  },
];

export const mockCourses: Course[] = [
  {
    id: 'course-1',
    slug: 'react-nextjs-fullstack-2024',
    title: 'React & Next.js Full-Stack từ Zero đến Hero',
    description:
      'Khóa học toàn diện về React và Next.js, từ cơ bản đến nâng cao. Xây dựng ứng dụng thực tế với TypeScript, Tailwind CSS, Prisma, và nhiều công nghệ hiện đại khác.',
    shortDescription: 'Học React & Next.js từ cơ bản đến nâng cao với dự án thực tế',
    thumbnail: '/courses/react-nextjs.jpg',
    instructor: instructors[0],
    price: 599000,
    originalPrice: 1299000,
    rating: 4.8,
    totalRatings: 1250,
    totalStudents: 5600,
    level: 'beginner',
    category: 'web-dev',
    tags: ['React', 'Next.js', 'TypeScript', 'Full-Stack'],
    language: 'vi',
    totalLessons: 180,
    totalDuration: '42 giờ',
    updatedAt: '2024-12-01',
    isBestseller: true,
    whatYouLearn: [
      'Hiểu sâu về React hooks, context, và state management',
      'Xây dựng ứng dụng Full-Stack với Next.js App Router',
      'Sử dụng TypeScript một cách chuyên nghiệp',
      'Thiết kế UI đẹp với Tailwind CSS',
      'Tích hợp database với Prisma ORM',
      'Authentication với NextAuth.js',
      'Deploy ứng dụng lên Vercel',
      'Best practices và clean code',
    ],
    prerequisites: ['Kiến thức HTML, CSS, JavaScript cơ bản', 'Biết sử dụng Git cơ bản'],
    sections: [
      {
        id: 's1',
        title: 'Giới thiệu và cài đặt môi trường',
        lessons: [
          {
            id: 'l1',
            title: 'Tổng quan về khóa học',
            duration: '10:30',
            type: 'video',
            isPreview: true,
          },
          {
            id: 'l2',
            title: 'Cài đặt Node.js và VS Code',
            duration: '15:00',
            type: 'video',
            isPreview: true,
          },
          { id: 'l3', title: 'Tạo dự án React đầu tiên', duration: '20:00', type: 'video' },
          { id: 'l4', title: 'Quiz: Kiến thức cơ bản', duration: '5:00', type: 'quiz' },
        ],
      },
      {
        id: 's2',
        title: 'React Fundamentals',
        lessons: [
          { id: 'l5', title: 'JSX và Components', duration: '25:00', type: 'video' },
          { id: 'l6', title: 'Props và State', duration: '30:00', type: 'video' },
          { id: 'l7', title: 'Event Handling', duration: '20:00', type: 'video' },
          { id: 'l8', title: 'Conditional Rendering', duration: '15:00', type: 'video' },
          { id: 'l9', title: 'Bài tập: Todo App', duration: '45:00', type: 'exercise' },
        ],
      },
      {
        id: 's3',
        title: 'React Hooks',
        lessons: [
          { id: 'l10', title: 'useState và useEffect', duration: '35:00', type: 'video' },
          { id: 'l11', title: 'useContext và useReducer', duration: '30:00', type: 'video' },
          { id: 'l12', title: 'useMemo và useCallback', duration: '25:00', type: 'video' },
          { id: 'l13', title: 'Custom Hooks', duration: '20:00', type: 'video' },
        ],
      },
      {
        id: 's4',
        title: 'Next.js App Router',
        lessons: [
          { id: 'l14', title: 'File-based Routing', duration: '20:00', type: 'video' },
          {
            id: 'l15',
            title: 'Server Components vs Client Components',
            duration: '30:00',
            type: 'video',
          },
          { id: 'l16', title: 'Data Fetching', duration: '35:00', type: 'video' },
          { id: 'l17', title: 'API Routes', duration: '25:00', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'course-2',
    slug: 'python-ai-machine-learning',
    title: 'Python cho AI & Machine Learning',
    description:
      'Khóa học chuyên sâu về AI và Machine Learning với Python. Bao gồm NumPy, Pandas, Scikit-learn, TensorFlow.',
    shortDescription: 'Nhập môn AI/ML với Python - từ lý thuyết đến thực hành',
    thumbnail: '/courses/python-ai.jpg',
    instructor: instructors[1],
    price: 799000,
    originalPrice: 1599000,
    rating: 4.9,
    totalRatings: 890,
    totalStudents: 3200,
    level: 'intermediate',
    category: 'ai-ml',
    tags: ['Python', 'AI', 'Machine Learning', 'Deep Learning'],
    language: 'vi',
    totalLessons: 150,
    totalDuration: '38 giờ',
    updatedAt: '2024-11-15',
    isBestseller: true,
    whatYouLearn: [
      'Nền tảng vững chắc về Machine Learning',
      'Xử lý dữ liệu với NumPy và Pandas',
      'Xây dựng model ML với Scikit-learn',
      'Deep Learning với TensorFlow/Keras',
    ],
    prerequisites: ['Kiến thức Python cơ bản', 'Toán cơ bản (đại số tuyến tính, xác suất)'],
    sections: [
      {
        id: 's1',
        title: 'Python Review',
        lessons: [
          { id: 'l1', title: 'Python cơ bản', duration: '30:00', type: 'video', isPreview: true },
          { id: 'l2', title: 'NumPy basics', duration: '25:00', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'course-3',
    slug: 'flutter-mobile-app-development',
    title: 'Flutter - Phát triển ứng dụng Mobile',
    description: 'Xây dựng ứng dụng di động đa nền tảng với Flutter và Dart.',
    shortDescription: 'Xây dựng app iOS & Android với Flutter',
    thumbnail: '/courses/flutter.jpg',
    instructor: instructors[2],
    price: 499000,
    originalPrice: 999000,
    rating: 4.7,
    totalRatings: 650,
    totalStudents: 2800,
    level: 'beginner',
    category: 'mobile',
    tags: ['Flutter', 'Dart', 'Mobile', 'Cross-Platform'],
    language: 'vi',
    totalLessons: 120,
    totalDuration: '30 giờ',
    updatedAt: '2024-10-20',
    isNew: true,
    whatYouLearn: [
      'Phát triển ứng dụng đa nền tảng với Flutter',
      'Ngôn ngữ Dart từ A-Z',
      'State management với Provider & Riverpod',
      'Tích hợp API và Firebase',
    ],
    prerequisites: ['Kiến thức lập trình cơ bản'],
    sections: [
      {
        id: 's1',
        title: 'Dart cơ bản',
        lessons: [
          { id: 'l1', title: 'Giới thiệu Dart', duration: '15:00', type: 'video', isPreview: true },
          { id: 'l2', title: 'Biến và kiểu dữ liệu', duration: '20:00', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'course-4',
    slug: 'docker-kubernetes-devops',
    title: 'Docker & Kubernetes cho DevOps',
    description: 'Khóa học DevOps chuyên sâu với Docker, Kubernetes, CI/CD pipelines.',
    shortDescription: 'Master Docker & K8s - deploy ứng dụng chuyên nghiệp',
    thumbnail: '/courses/devops.jpg',
    instructor: instructors[3],
    price: 699000,
    originalPrice: 1399000,
    rating: 4.6,
    totalRatings: 420,
    totalStudents: 1500,
    level: 'advanced',
    category: 'devops',
    tags: ['Docker', 'Kubernetes', 'DevOps', 'CI/CD'],
    language: 'vi',
    totalLessons: 95,
    totalDuration: '25 giờ',
    updatedAt: '2024-09-10',
    whatYouLearn: [
      'Container hóa ứng dụng với Docker',
      'Orchestration với Kubernetes',
      'CI/CD với GitHub Actions',
      'Monitoring và Logging',
    ],
    prerequisites: ['Kiến thức Linux cơ bản', 'Biết sử dụng command line'],
    sections: [
      {
        id: 's1',
        title: 'Docker Fundamentals',
        lessons: [
          { id: 'l1', title: 'Docker là gì?', duration: '15:00', type: 'video', isPreview: true },
          { id: 'l2', title: 'Dockerfile', duration: '25:00', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'course-5',
    slug: 'ui-ux-design-figma',
    title: 'UI/UX Design với Figma',
    description: 'Học thiết kế giao diện người dùng chuyên nghiệp với Figma.',
    shortDescription: 'Thiết kế UI/UX chuyên nghiệp từ đầu',
    thumbnail: '/courses/figma.jpg',
    instructor: {
      ...instructors[0],
      id: 'ins-5',
      name: 'Hoàng Thị Mai',
      title: 'Senior UX Designer',
    },
    price: 399000,
    originalPrice: 899000,
    rating: 4.8,
    totalRatings: 520,
    totalStudents: 2100,
    level: 'beginner',
    category: 'design',
    tags: ['Figma', 'UI/UX', 'Design', 'Prototype'],
    language: 'vi',
    totalLessons: 80,
    totalDuration: '20 giờ',
    updatedAt: '2024-11-01',
    isNew: true,
    whatYouLearn: [
      'Nguyên lý thiết kế UI/UX',
      'Sử dụng Figma thành thạo',
      'Design System',
      'Prototyping và User Testing',
    ],
    prerequisites: ['Không cần kiến thức trước'],
    sections: [
      {
        id: 's1',
        title: 'Figma cơ bản',
        lessons: [
          {
            id: 'l1',
            title: 'Giới thiệu Figma',
            duration: '10:00',
            type: 'video',
            isPreview: true,
          },
        ],
      },
    ],
  },
  {
    id: 'course-6',
    slug: 'nodejs-expressjs-api',
    title: 'Node.js & Express.js - Xây dựng REST API',
    description: 'Xây dựng backend API chuyên nghiệp với Node.js, Express.js, MongoDB.',
    shortDescription: 'Backend development với Node.js và Express',
    thumbnail: '/courses/nodejs.jpg',
    instructor: instructors[0],
    price: 549000,
    originalPrice: 1199000,
    rating: 4.7,
    totalRatings: 780,
    totalStudents: 3500,
    level: 'intermediate',
    category: 'web-dev',
    tags: ['Node.js', 'Express', 'MongoDB', 'REST API'],
    language: 'vi',
    totalLessons: 130,
    totalDuration: '32 giờ',
    updatedAt: '2024-10-15',
    whatYouLearn: [
      'Xây dựng REST API hoàn chỉnh',
      'Authentication & Authorization',
      'Database design với MongoDB',
      'Testing và Documentation',
    ],
    prerequisites: ['JavaScript cơ bản', 'HTML/CSS'],
    sections: [
      {
        id: 's1',
        title: 'Giới thiệu Node.js',
        lessons: [
          { id: 'l1', title: 'Node.js là gì?', duration: '12:00', type: 'video', isPreview: true },
        ],
      },
    ],
  },
  {
    id: 'course-7',
    slug: 'data-science-python',
    title: 'Data Science với Python',
    description: 'Phân tích dữ liệu chuyên nghiệp với Python, Pandas, Matplotlib.',
    shortDescription: 'Phân tích dữ liệu và trực quan hóa với Python',
    thumbnail: '/courses/data-science.jpg',
    instructor: instructors[1],
    price: 649000,
    originalPrice: 1299000,
    rating: 4.8,
    totalRatings: 340,
    totalStudents: 1800,
    level: 'intermediate',
    category: 'data',
    tags: ['Python', 'Pandas', 'Data Analysis', 'Visualization'],
    language: 'vi',
    totalLessons: 110,
    totalDuration: '28 giờ',
    updatedAt: '2024-11-20',
    whatYouLearn: [
      'Phân tích dữ liệu với Pandas',
      'Trực quan hóa với Matplotlib & Seaborn',
      'Thống kê ứng dụng',
      'Dự án thực tế',
    ],
    prerequisites: ['Python cơ bản'],
    sections: [
      {
        id: 's1',
        title: 'Python cho Data Science',
        lessons: [
          {
            id: 'l1',
            title: 'Giới thiệu Data Science',
            duration: '15:00',
            type: 'video',
            isPreview: true,
          },
        ],
      },
    ],
  },
  {
    id: 'course-8',
    slug: 'react-native-mobile',
    title: 'React Native - Ứng dụng Mobile với JavaScript',
    description: 'Phát triển ứng dụng di động với React Native và Expo.',
    shortDescription: 'Xây dựng app mobile với React Native',
    thumbnail: '/courses/react-native.jpg',
    instructor: instructors[2],
    price: 549000,
    originalPrice: 1099000,
    rating: 4.6,
    totalRatings: 290,
    totalStudents: 1200,
    level: 'intermediate',
    category: 'mobile',
    tags: ['React Native', 'Expo', 'Mobile', 'JavaScript'],
    language: 'vi',
    totalLessons: 100,
    totalDuration: '26 giờ',
    updatedAt: '2024-08-20',
    whatYouLearn: [
      'React Native fundamentals',
      'Navigation và State Management',
      'Native modules',
      'App Store deployment',
    ],
    prerequisites: ['React cơ bản', 'JavaScript ES6+'],
    sections: [
      {
        id: 's1',
        title: 'Bắt đầu với React Native',
        lessons: [
          {
            id: 'l1',
            title: 'Giới thiệu React Native',
            duration: '12:00',
            type: 'video',
            isPreview: true,
          },
        ],
      },
    ],
  },
];

export const mockReviews: Review[] = [
  {
    id: 'r1',
    user: { name: 'Nguyễn Minh Tuấn', avatar: '/avatars/user-1.jpg' },
    rating: 5,
    comment:
      'Khóa học rất tuyệt vời! Giảng viên giải thích rõ ràng, dễ hiểu. Tôi đã học được rất nhiều từ khóa học này.',
    date: '2024-11-25',
    helpful: 24,
  },
  {
    id: 'r2',
    user: { name: 'Trần Hương Giang', avatar: '/avatars/user-2.jpg' },
    rating: 4,
    comment:
      'Nội dung chất lượng, nhưng có một vài phần hơi nhanh. Nhìn chung rất đáng giá so với giá tiền.',
    date: '2024-11-20',
    helpful: 15,
  },
  {
    id: 'r3',
    user: { name: 'Lê Văn Hùng', avatar: '/avatars/user-3.jpg' },
    rating: 5,
    comment: 'Đây là khóa học tốt nhất về React mà tôi từng học. Cảm ơn thầy rất nhiều!',
    date: '2024-11-15',
    helpful: 32,
  },
  {
    id: 'r4',
    user: { name: 'Phạm Thị Lan', avatar: '/avatars/user-4.jpg' },
    rating: 4,
    comment: 'Khóa học rất thực tế. Tôi đã áp dụng được ngay vào dự án của công ty.',
    date: '2024-11-10',
    helpful: 18,
  },
  {
    id: 'r5',
    user: { name: 'Hoàng Đức Anh', avatar: '/avatars/user-5.jpg' },
    rating: 5,
    comment: 'Code cùng thầy rất vui và học được nhiều thứ. Recommend cho tất cả mọi người!',
    date: '2024-11-05',
    helpful: 21,
  },
];

export const mockPosts: Post[] = [
  {
    id: 'p1',
    author: {
      name: 'Nguyễn Văn An',
      avatar: '/avatars/instructor-1.jpg',
      title: 'Senior Full-Stack Developer',
    },
    content:
      'Vừa hoàn thành bài giảng mới về Server Components trong Next.js 15! Có rất nhiều thay đổi thú vị. Mọi người check out nhé 🚀',
    likes: 45,
    comments: 12,
    shares: 5,
    createdAt: '2 giờ trước',
    isLiked: false,
  },
  {
    id: 'p2',
    author: { name: 'Trần Thị Bình', avatar: '/avatars/instructor-2.jpg', title: 'AI/ML Engineer' },
    content:
      'Chia sẻ kinh nghiệm phỏng vấn AI Engineer tại các công ty lớn. Thread dài nên mình sẽ chia thành nhiều phần. Phần 1: Chuẩn bị gì trước khi phỏng vấn?',
    likes: 128,
    comments: 34,
    shares: 22,
    createdAt: '5 giờ trước',
    isLiked: true,
  },
  {
    id: 'p3',
    author: {
      name: 'Lê Minh Cường',
      avatar: '/avatars/instructor-3.jpg',
      title: 'Mobile Developer Lead',
    },
    content:
      'Flutter 4.0 ra mắt với rất nhiều tính năng mới! Đặc biệt là Impeller engine giúp rendering mượt hơn rất nhiều. Mọi người đã thử chưa?',
    likes: 67,
    comments: 18,
    shares: 8,
    createdAt: '1 ngày trước',
    isLiked: false,
  },
  {
    id: 'p4',
    author: { name: 'Nguyễn Minh Tuấn', avatar: '/avatars/user-1.jpg', title: 'Student' },
    content:
      'Mình vừa hoàn thành khóa React & Next.js! Cảm ơn thầy An rất nhiều. Giờ mình đã tự tin apply vị trí Junior Frontend Developer rồi 💪',
    likes: 89,
    comments: 25,
    shares: 3,
    createdAt: '1 ngày trước',
    isLiked: true,
  },
];

export const mockConversations: Conversation[] = [
  {
    id: 'c1',
    user: { name: 'Nguyễn Văn An', avatar: '/avatars/instructor-1.jpg', isOnline: true },
    lastMessage: 'Chào em, bài tập của em làm rất tốt!',
    time: '10:30',
    unread: 2,
  },
  {
    id: 'c2',
    user: { name: 'Trần Hương Giang', avatar: '/avatars/user-2.jpg', isOnline: true },
    lastMessage: 'Bạn giải bài này thế nào vậy?',
    time: '09:15',
    unread: 0,
  },
  {
    id: 'c3',
    user: { name: 'Nhóm React Việt Nam', avatar: '/avatars/group-1.jpg', isOnline: false },
    lastMessage: 'Lê Minh: Ai có tài liệu về hooks không?',
    time: 'Hôm qua',
    unread: 5,
  },
  {
    id: 'c4',
    user: { name: 'Phạm Hoàng Dũng', avatar: '/avatars/instructor-4.jpg', isOnline: false },
    lastMessage: 'Docker compose file đã fix rồi nhé',
    time: 'Hôm qua',
    unread: 0,
  },
  {
    id: 'c5',
    user: { name: 'AI Tutor', avatar: '/avatars/ai-tutor.jpg', isOnline: true },
    lastMessage: 'Bạn có thể giải thích thêm về useEffect...',
    time: 'T2',
    unread: 0,
  },
];

export const mockMessages: Message[] = [
  { id: 'm1', content: 'Chào thầy, em có thắc mắc về bài tập số 5 ạ', sender: 'me', time: '10:20' },
  { id: 'm2', content: 'Chào em, em hỏi đi nhé!', sender: 'other', time: '10:22' },
  {
    id: 'm3',
    content: 'Em không hiểu phần useContext, thầy có thể giải thích thêm không ạ?',
    sender: 'me',
    time: '10:25',
  },
  {
    id: 'm4',
    content:
      'Được rồi, useContext giúp em chia sẻ state giữa các component mà không cần truyền qua props. Em hình dung nó như một "kho chung" mà bất kỳ component nào cũng có thể truy cập.',
    sender: 'other',
    time: '10:28',
  },
  { id: 'm5', content: 'À em hiểu rồi ạ! Cảm ơn thầy nhiều 🙏', sender: 'me', time: '10:29' },
  { id: 'm6', content: 'Chào em, bài tập của em làm rất tốt!', sender: 'other', time: '10:30' },
];

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    title: 'Sự khác biệt giữa useMemo và useCallback là gì?',
    body: 'Mình đang học React hooks và không hiểu rõ khi nào nên dùng useMemo và khi nào nên dùng useCallback...',
    author: { name: 'Nguyễn Minh Tuấn', avatar: '/avatars/user-1.jpg' },
    votes: 15,
    answers: 3,
    views: 256,
    tags: ['React', 'Hooks', 'Performance'],
    createdAt: '2 giờ trước',
    courseTitle: 'React & Next.js Full-Stack',
  },
  {
    id: 'q2',
    title: 'Làm sao deploy Next.js app lên AWS?',
    body: 'Mình muốn deploy app Next.js lên AWS thay vì Vercel. Có ai có kinh nghiệm không?',
    author: { name: 'Trần Hương Giang', avatar: '/avatars/user-2.jpg' },
    votes: 8,
    answers: 5,
    views: 189,
    tags: ['Next.js', 'AWS', 'Deploy'],
    createdAt: '5 giờ trước',
  },
  {
    id: 'q3',
    title: 'TensorFlow vs PyTorch - nên học cái nào trước?',
    body: 'Mình mới bắt đầu học Deep Learning, nên chọn TensorFlow hay PyTorch?',
    author: { name: 'Lê Văn Hùng', avatar: '/avatars/user-3.jpg' },
    votes: 22,
    answers: 7,
    views: 445,
    tags: ['AI', 'TensorFlow', 'PyTorch'],
    createdAt: '1 ngày trước',
    courseTitle: 'Python cho AI & ML',
  },
  {
    id: 'q4',
    title: 'Docker container bị lỗi "port already in use"',
    body: 'Mình chạy docker-compose up nhưng bị báo lỗi port 3000 already in use...',
    author: { name: 'Phạm Thị Lan', avatar: '/avatars/user-4.jpg' },
    votes: 5,
    answers: 2,
    views: 98,
    tags: ['Docker', 'DevOps', 'Troubleshoot'],
    createdAt: '2 ngày trước',
    courseTitle: 'Docker & Kubernetes',
  },
];

export const mockEnrolledCourses = [
  {
    ...mockCourses[0],
    progress: 65,
    lastAccessed: '2 giờ trước',
    currentLesson: 'useContext và useReducer',
  },
  { ...mockCourses[1], progress: 30, lastAccessed: '1 ngày trước', currentLesson: 'NumPy basics' },
  { ...mockCourses[2], progress: 100, lastAccessed: '1 tuần trước', currentLesson: 'Hoàn thành' },
  {
    ...mockCourses[5],
    progress: 45,
    lastAccessed: '3 ngày trước',
    currentLesson: 'Authentication',
  },
];

export const mockCartItems: CartItem[] = [
  { id: 'ci1', course: mockCourses[3] },
  { id: 'ci2', course: mockCourses[4] },
];

export interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  courseThumbnail: string;
  completionDate: string;
  verifyUrl: string;
  instructor: string;
}

export const mockCertificates: Certificate[] = [
  {
    id: 'cert-1',
    courseId: 'course-3',
    courseTitle: 'Flutter - Phát triển ứng dụng Mobile',
    courseThumbnail: '/courses/flutter.jpg',
    completionDate: '2025-12-15',
    verifyUrl: 'https://sslm.vn/verify/cert-1',
    instructor: 'Lê Minh Cường',
  },
  {
    id: 'cert-2',
    courseId: 'course-1',
    courseTitle: 'React & Next.js Full-Stack từ Zero đến Hero',
    courseThumbnail: '/courses/react-nextjs.jpg',
    completionDate: '2025-10-20',
    verifyUrl: 'https://sslm.vn/verify/cert-2',
    instructor: 'Nguyễn Văn An',
  },
  {
    id: 'cert-3',
    courseId: 'course-6',
    courseTitle: 'Node.js & Express.js - Xây dựng REST API',
    courseThumbnail: '/courses/nodejs.jpg',
    completionDate: '2025-08-05',
    verifyUrl: 'https://sslm.vn/verify/cert-3',
    instructor: 'Nguyễn Văn An',
  },
];

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  avatar: string;
  coverImage: string;
  isJoined: boolean;
  category: string;
  admins: { name: string; avatar: string }[];
  rules: string[];
  createdAt: string;
}

export const mockGroups: StudyGroup[] = [
  {
    id: 'group-1',
    name: 'React Việt Nam',
    description:
      'Cộng đồng React lớn nhất Việt Nam. Chia sẻ kiến thức, kinh nghiệm và cơ hội việc làm.',
    memberCount: 1200,
    avatar: '/avatars/group-1.jpg',
    coverImage: '/covers/react-vn.jpg',
    isJoined: true,
    category: 'Web Development',
    admins: [{ name: 'Nguyễn Văn An', avatar: '/avatars/instructor-1.jpg' }],
    rules: [
      'Tôn trọng mọi thành viên',
      'Không spam hoặc quảng cáo',
      'Viết bài bằng tiếng Việt hoặc tiếng Anh',
      'Gắn tag phù hợp khi đăng bài',
    ],
    createdAt: '2024-01-15',
  },
  {
    id: 'group-2',
    name: 'Node.js Community',
    description: 'Nơi trao đổi về Node.js, Express, NestJS và backend development.',
    memberCount: 850,
    avatar: '/avatars/group-2.jpg',
    coverImage: '/covers/nodejs.jpg',
    isJoined: false,
    category: 'Web Development',
    admins: [{ name: 'Phạm Hoàng Dũng', avatar: '/avatars/instructor-4.jpg' }],
    rules: ['Tôn trọng mọi thành viên', 'Không spam', 'Đặt câu hỏi rõ ràng, kèm code nếu có'],
    createdAt: '2024-03-10',
  },
  {
    id: 'group-3',
    name: 'Python Data Science',
    description: 'Học và chia sẻ kiến thức về Python, Data Science, Machine Learning.',
    memberCount: 620,
    avatar: '/avatars/group-3.jpg',
    coverImage: '/covers/python-ds.jpg',
    isJoined: false,
    category: 'AI / Machine Learning',
    admins: [{ name: 'Trần Thị Bình', avatar: '/avatars/instructor-2.jpg' }],
    rules: ['Tôn trọng mọi thành viên', 'Chia sẻ nguồn tài liệu chất lượng', 'Không spam'],
    createdAt: '2024-02-20',
  },
  {
    id: 'group-4',
    name: 'Flutter & Dart VN',
    description: 'Cộng đồng Flutter và Dart tại Việt Nam. Hỗ trợ nhau phát triển ứng dụng mobile.',
    memberCount: 430,
    avatar: '/avatars/group-4.jpg',
    coverImage: '/covers/flutter.jpg',
    isJoined: true,
    category: 'Mobile Development',
    admins: [{ name: 'Lê Minh Cường', avatar: '/avatars/instructor-3.jpg' }],
    rules: ['Tôn trọng mọi thành viên', 'Không spam', 'Hỗ trợ newcomer'],
    createdAt: '2024-05-01',
  },
];

export interface Answer {
  id: string;
  content: string;
  author: { name: string; avatar: string };
  votes: number;
  isBestAnswer: boolean;
  createdAt: string;
}

export const mockAnswers: Answer[] = [
  {
    id: 'a1',
    content:
      'useMemo dùng để memoize một giá trị tính toán, còn useCallback dùng để memoize một hàm callback. Cả hai đều giúp tránh re-render không cần thiết.\n\nVí dụ:\n- useMemo: const expensiveValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);\n- useCallback: const memoizedCallback = useCallback(() => { doSomething(a, b); }, [a, b]);',
    author: { name: 'Nguyễn Văn An', avatar: '/avatars/instructor-1.jpg' },
    votes: 12,
    isBestAnswer: true,
    createdAt: '1 giờ trước',
  },
  {
    id: 'a2',
    content:
      'Đơn giản thì useMemo trả về một value, còn useCallback trả về một function. Bạn dùng useMemo khi muốn cache kết quả tính toán phức tạp, và useCallback khi muốn truyền callback xuống child component mà không muốn nó re-render.',
    author: { name: 'Trần Hương Giang', avatar: '/avatars/user-2.jpg' },
    votes: 5,
    isBestAnswer: false,
    createdAt: '45 phút trước',
  },
  {
    id: 'a3',
    content:
      'Thêm một điểm nữa: useCallback(fn, deps) tương đương với useMemo(() => fn, deps). Trong thực tế, bạn không cần optimize quá sớm, chỉ dùng khi thực sự có performance issue.',
    author: { name: 'Lê Văn Hùng', avatar: '/avatars/user-3.jpg' },
    votes: 8,
    isBestAnswer: false,
    createdAt: '30 phút trước',
  },
];

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  items: { courseId: string; courseTitle: string; price: number }[];
  total: number;
  status: 'completed' | 'pending' | 'expired';
  paymentMethod: string;
  transactionId?: string;
}

export const mockOrders: Order[] = [
  {
    id: 'order-1',
    orderNumber: 'ORD-20260301-001',
    date: '2026-03-01',
    items: [
      {
        courseId: 'course-1',
        courseTitle: 'React & Next.js Full-Stack từ Zero đến Hero',
        price: 599000,
      },
    ],
    total: 599000,
    status: 'completed',
    paymentMethod: 'Chuyển khoản ngân hàng',
    transactionId: 'TXN-123456',
  },
  {
    id: 'order-2',
    orderNumber: 'ORD-20260215-002',
    date: '2026-02-15',
    items: [
      { courseId: 'course-2', courseTitle: 'Python cho AI & Machine Learning', price: 799000 },
      { courseId: 'course-3', courseTitle: 'Flutter - Phát triển ứng dụng Mobile', price: 499000 },
    ],
    total: 1298000,
    status: 'completed',
    paymentMethod: 'Chuyển khoản ngân hàng',
    transactionId: 'TXN-654321',
  },
  {
    id: 'order-3',
    orderNumber: 'ORD-20260310-003',
    date: '2026-03-10',
    items: [{ courseId: 'course-4', courseTitle: 'Docker & Kubernetes cho DevOps', price: 699000 }],
    total: 699000,
    status: 'pending',
    paymentMethod: 'Chuyển khoản ngân hàng',
  },
  {
    id: 'order-4',
    orderNumber: 'ORD-20260205-004',
    date: '2026-02-05',
    items: [{ courseId: 'course-5', courseTitle: 'UI/UX Design với Figma', price: 399000 }],
    total: 399000,
    status: 'expired',
    paymentMethod: 'Chuyển khoản ngân hàng',
  },
  {
    id: 'order-5',
    orderNumber: 'ORD-20260120-005',
    date: '2026-01-20',
    items: [
      {
        courseId: 'course-6',
        courseTitle: 'Node.js & Express.js - Xây dựng REST API',
        price: 549000,
      },
    ],
    total: 549000,
    status: 'completed',
    paymentMethod: 'Chuyển khoản ngân hàng',
    transactionId: 'TXN-789012',
  },
];

export interface Notification {
  id: string;
  type: 'enrollment' | 'review' | 'comment' | 'system' | 'achievement';
  message: string;
  description?: string;
  createdAt: string;
  isRead: boolean;
}

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'enrollment',
    message: 'Bạn đã đăng ký thành công khóa học "React & Next.js Full-Stack"',
    createdAt: '5 phút trước',
    isRead: false,
  },
  {
    id: 'n2',
    type: 'achievement',
    message: 'Chúc mừng! Bạn đã hoàn thành khóa học "Flutter Mobile App"',
    description: 'Chứng chỉ đã sẵn sàng để tải về.',
    createdAt: '1 giờ trước',
    isRead: false,
  },
  {
    id: 'n3',
    type: 'comment',
    message: 'Nguyễn Văn An đã trả lời câu hỏi của bạn',
    description: '"Sự khác biệt giữa useMemo và useCallback"',
    createdAt: '2 giờ trước',
    isRead: false,
  },
  {
    id: 'n4',
    type: 'review',
    message: 'Giảng viên đã phản hồi đánh giá của bạn',
    createdAt: '3 giờ trước',
    isRead: true,
  },
  {
    id: 'n5',
    type: 'system',
    message: 'Cập nhật: Tính năng AI Tutor đã được nâng cấp',
    description: 'Trải nghiệm AI Tutor mới với nhiều cải tiến.',
    createdAt: '5 giờ trước',
    isRead: true,
  },
  {
    id: 'n6',
    type: 'enrollment',
    message: 'Khóa học "Docker & K8s" có nội dung mới',
    description: 'Phần 5: Kubernetes Advanced đã được cập nhật.',
    createdAt: '1 ngày trước',
    isRead: true,
  },
  {
    id: 'n7',
    type: 'comment',
    message: 'Trần Hương Giang đã bình luận bài viết của bạn',
    createdAt: '1 ngày trước',
    isRead: true,
  },
  {
    id: 'n8',
    type: 'achievement',
    message: 'Bạn đã đạt chuỗi học tập 7 ngày liên tiếp!',
    createdAt: '2 ngày trước',
    isRead: true,
  },
  {
    id: 'n9',
    type: 'system',
    message: 'Khuyến mãi: Giảm 50% tất cả khóa học đến hết tuần',
    createdAt: '3 ngày trước',
    isRead: true,
  },
  {
    id: 'n10',
    type: 'review',
    message: '5 người thấy đánh giá của bạn hữu ích',
    createdAt: '4 ngày trước',
    isRead: true,
  },
];

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export const learningStats = {
  coursesInProgress: 3,
  coursesCompleted: 5,
  totalHours: 128,
  certificates: 4,
};

// Use a simple seeded pseudo-random to avoid hydration mismatches
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Use a fixed base date to avoid Date.now() hydration mismatches
const STREAK_BASE_DATE = new Date('2026-03-14');

export const streakData = Array.from({ length: 52 * 7 }, (_, i) => ({
  date: new Date(STREAK_BASE_DATE.getTime() - (52 * 7 - i) * 86400000).toISOString().slice(0, 10),
  count: seededRandom(i + 1) > 0.4 ? Math.floor(seededRandom(i + 100) * 4) + 1 : 0,
}));
