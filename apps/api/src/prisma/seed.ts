import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Helper ──

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateOrderCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `SSLM${date}${seq}`;
}

// ── Constants ──

const COMMISSION_RATE = 0.3; // 30% platform commission
const PASSWORD_HASH_ROUNDS = 12;

// Sample videos from Cloudinary demo
const SAMPLE_VIDEOS = [
  { url: 'https://res.cloudinary.com/demo/video/upload/dog.mp4', duration: 13 },
  { url: 'https://res.cloudinary.com/demo/video/upload/elephants.mp4', duration: 52 },
];

function sampleVideo(index: number): { url: string; duration: number } {
  return SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length]!;
}

function courseThumbnail(slug: string): string {
  return `https://picsum.photos/seed/${slug}/640/360`;
}

async function main() {
  const passwordHash = await bcrypt.hash('Password@123', PASSWORD_HASH_ROUNDS);

  console.log('🌱 Starting seed...\n');

  // ============================================================
  // 1. ADMIN + CATEGORIES + TAGS + SETTINGS (base data)
  // ============================================================

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sslm.com' },
    update: {},
    create: {
      email: 'admin@sslm.com',
      passwordHash: await bcrypt.hash('Admin@123', PASSWORD_HASH_ROUNDS),
      fullName: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      provider: 'LOCAL',
      createdAt: daysAgo(90),
    },
  });
  console.log(`✓ Admin: ${admin.email}`);

  // Categories
  const categoryData = [
    { name: 'Web Development', slug: 'web-development', order: 1 },
    { name: 'Mobile Development', slug: 'mobile-development', order: 2 },
    { name: 'Data Science', slug: 'data-science', order: 3 },
    { name: 'DevOps & Cloud', slug: 'devops-cloud', order: 4 },
    { name: 'Programming Languages', slug: 'programming-languages', order: 5 },
    { name: 'Database', slug: 'database', order: 6 },
    { name: 'UI/UX Design', slug: 'ui-ux-design', order: 7 },
    { name: 'Cybersecurity', slug: 'cybersecurity', order: 8 },
  ];
  const categories: Record<string, string> = {};
  for (const cat of categoryData) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categories[cat.slug] = c.id;
  }
  console.log(`✓ ${categoryData.length} categories`);

  // Tags
  const tagNames = [
    'JavaScript',
    'TypeScript',
    'React',
    'Next.js',
    'Vue.js',
    'Angular',
    'Node.js',
    'NestJS',
    'Express',
    'Python',
    'Django',
    'FastAPI',
    'Java',
    'Spring Boot',
    'Go',
    'Rust',
    'C#',
    '.NET',
    'SQL',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'GraphQL',
    'REST API',
    'Docker',
    'Kubernetes',
    'AWS',
    'Git',
    'CI/CD',
    'Linux',
    'HTML',
    'CSS',
    'Tailwind',
    'Sass',
    'Figma',
    'React Native',
    'Flutter',
    'Swift',
    'Kotlin',
    'Machine Learning',
    'Deep Learning',
    'NLP',
    'Computer Vision',
  ];
  const tags: Record<string, string> = {};
  for (const name of tagNames) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const t = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    tags[name] = t.id;
  }
  console.log(`✓ ${tagNames.length} tags`);

  // Commission tiers
  await prisma.commissionTier.deleteMany();
  for (const tier of [
    { minRevenue: 0, rate: 0.3 },
    { minRevenue: 10_000_000, rate: 0.25 },
    { minRevenue: 50_000_000, rate: 0.2 },
  ]) {
    await prisma.commissionTier.create({ data: tier });
  }
  console.log('✓ Commission tiers');

  // Platform settings
  for (const s of [
    { key: 'min_withdrawal_amount', value: 5000 },
    { key: 'order_expiry_minutes', value: 15 },
    { key: 'refund_period_days', value: 7 },
    { key: 'refund_max_progress', value: 0.1 },
    { key: 'ai_daily_limit', value: 10 },
    { key: 'review_min_progress', value: 0.3 },
    { key: 'lesson_complete_threshold', value: 0.8 },
  ]) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.log('✓ Platform settings');

  // ============================================================
  // 2. INSTRUCTORS (3 instructors with profiles)
  // ============================================================

  const instructorData = [
    {
      email: 'tranminhduc@sslm.com',
      fullName: 'Trần Minh Đức',
      bio: 'Senior Full-Stack Developer với 8 năm kinh nghiệm. Chuyên React, Node.js, và kiến trúc microservices.',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=duc',
      headline: 'Senior Full-Stack Developer | React & Node.js Expert',
      expertise: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'NestJS'],
      experience: '8 năm kinh nghiệm phát triển web tại các công ty công nghệ lớn.',
    },
    {
      email: 'nguyenthilan@sslm.com',
      fullName: 'Nguyễn Thị Lan',
      bio: 'Data Scientist tại FPT AI, giảng viên thỉnh giảng tại HUST. Chuyên Machine Learning và Python.',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=lan',
      headline: 'Data Scientist | Machine Learning Engineer',
      expertise: ['Python', 'Machine Learning', 'Deep Learning', 'SQL', 'Docker'],
      experience: '6 năm nghiên cứu và ứng dụng AI/ML trong thực tế.',
    },
    {
      email: 'levanhoang@sslm.com',
      fullName: 'Lê Văn Hoàng',
      bio: 'Mobile Developer với kinh nghiệm phát triển ứng dụng cho startup và doanh nghiệp. Flutter & React Native.',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=hoang',
      headline: 'Mobile Developer | Flutter & React Native',
      expertise: ['Flutter', 'React Native', 'Kotlin', 'Swift', 'Firebase'],
      experience: '5 năm phát triển ứng dụng mobile đa nền tảng.',
    },
  ];

  const instructors: Array<{ id: string; email: string; fullName: string }> = [];
  for (const inst of instructorData) {
    const user = await prisma.user.upsert({
      where: { email: inst.email },
      update: {},
      create: {
        email: inst.email,
        passwordHash,
        fullName: inst.fullName,
        bio: inst.bio,
        avatarUrl: inst.avatarUrl,
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
        provider: 'LOCAL',
        createdAt: daysAgo(randomBetween(60, 80)),
      },
    });
    await prisma.instructorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        headline: inst.headline,
        biography: inst.bio,
        expertise: inst.expertise,
        experience: inst.experience,
      },
    });
    await prisma.instructorApplication.upsert({
      where: { id: user.id }, // dummy, will create
      update: {},
      create: {
        userId: user.id,
        status: 'APPROVED',
        expertise: inst.expertise,
        experience: inst.experience,
        motivation: 'Muốn chia sẻ kiến thức và kinh nghiệm thực tế cho cộng đồng.',
        reviewedById: admin.id,
        reviewedAt: daysAgo(55),
      },
    });
    instructors.push({ id: user.id, email: user.email, fullName: user.fullName });
  }
  console.log(`✓ ${instructors.length} instructors with profiles`);

  // ============================================================
  // 3. STUDENTS (10 students)
  // ============================================================

  const studentData = [
    { email: 'phamvanan@sslm.com', fullName: 'Phạm Văn An', seed: 'an' },
    { email: 'hoangthimai@sslm.com', fullName: 'Hoàng Thị Mai', seed: 'mai' },
    { email: 'vominhtuan@sslm.com', fullName: 'Võ Minh Tuấn', seed: 'tuan' },
    { email: 'doanhthuhuong@sslm.com', fullName: 'Doãnh Thu Hương', seed: 'huong' },
    { email: 'buithanhson@sslm.com', fullName: 'Bùi Thanh Sơn', seed: 'son' },
    { email: 'lethiyen@sslm.com', fullName: 'Lê Thị Yến', seed: 'yen' },
    { email: 'ngoquangminh@sslm.com', fullName: 'Ngô Quang Minh', seed: 'minh' },
    { email: 'tranthihanh@sslm.com', fullName: 'Trần Thị Hạnh', seed: 'hanh' },
    { email: 'dangvanhieu@sslm.com', fullName: 'Đặng Văn Hiếu', seed: 'hieu' },
    { email: 'phanngoclinh@sslm.com', fullName: 'Phan Ngọc Linh', seed: 'linh' },
  ];

  const students: Array<{ id: string; email: string; fullName: string }> = [];
  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash,
        fullName: s.fullName,
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${s.seed}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        provider: 'LOCAL',
        createdAt: daysAgo(randomBetween(20, 50)),
      },
    });
    students.push({ id: user.id, email: user.email, fullName: user.fullName });
  }
  console.log(`✓ ${students.length} students`);

  // ============================================================
  // 4. COURSES (8 courses with sections/chapters/lessons)
  // ============================================================

  interface CourseSpec {
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: number;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
    instructorIdx: number;
    categorySlug: string;
    tagNames: string[];
    sections: Array<{
      title: string;
      chapters: Array<{
        title: string;
        price?: number;
        isFreePreview?: boolean;
        lessons: Array<{
          title: string;
          type: 'VIDEO' | 'TEXT' | 'QUIZ';
          duration?: number; // seconds for VIDEO
          textContent?: string;
        }>;
      }>;
    }>;
  }

  const courseSpecs: CourseSpec[] = [
    {
      title: 'React & Next.js Toàn Diện 2026',
      slug: 'react-nextjs-toan-dien-2026',
      shortDescription:
        'Khóa học React và Next.js từ cơ bản đến nâng cao, xây dựng ứng dụng thực tế.',
      description:
        '<h2>Bạn sẽ học được gì?</h2><ul><li>React hooks, state management</li><li>Next.js App Router, Server Components</li><li>TanStack Query, Zustand</li><li>Deploy lên Vercel</li></ul>',
      price: 499000,
      level: 'INTERMEDIATE',
      instructorIdx: 0,
      categorySlug: 'web-development',
      tagNames: ['React', 'Next.js', 'TypeScript', 'JavaScript'],
      sections: [
        {
          title: 'Giới thiệu & Cài đặt',
          chapters: [
            {
              title: 'Tổng quan React',
              isFreePreview: true,
              lessons: [
                { title: 'React là gì?', type: 'VIDEO', duration: 600 },
                {
                  title: 'Cài đặt môi trường',
                  type: 'TEXT',
                  textContent:
                    '<h3>Cài đặt Node.js và create-react-app</h3><p>Bước 1: Tải Node.js từ nodejs.org...</p>',
                },
                { title: 'Kiểm tra kiến thức', type: 'QUIZ' },
              ],
            },
            {
              title: 'JSX & Components',
              lessons: [
                { title: 'JSX cơ bản', type: 'VIDEO', duration: 900 },
                { title: 'Function Components', type: 'VIDEO', duration: 720 },
                { title: 'Props & Children', type: 'VIDEO', duration: 840 },
              ],
            },
          ],
        },
        {
          title: 'React Hooks',
          chapters: [
            {
              title: 'useState & useEffect',
              lessons: [
                { title: 'useState in depth', type: 'VIDEO', duration: 1200 },
                { title: 'useEffect patterns', type: 'VIDEO', duration: 1080 },
                { title: 'Bài tập hooks', type: 'QUIZ' },
              ],
            },
            {
              title: 'Custom Hooks & Context',
              lessons: [
                { title: 'Tạo custom hooks', type: 'VIDEO', duration: 960 },
                { title: 'React Context API', type: 'VIDEO', duration: 1140 },
              ],
            },
          ],
        },
        {
          title: 'Next.js App Router',
          chapters: [
            {
              title: 'Routing & Layouts',
              lessons: [
                { title: 'File-based routing', type: 'VIDEO', duration: 780 },
                { title: 'Layouts & Templates', type: 'VIDEO', duration: 660 },
                {
                  title: 'Server vs Client Components',
                  type: 'TEXT',
                  textContent:
                    '<h3>Server Components</h3><p>Mặc định trong Next.js App Router...</p>',
                },
              ],
            },
            {
              title: 'Data Fetching & Caching',
              lessons: [
                { title: 'Server-side data fetching', type: 'VIDEO', duration: 1320 },
                { title: 'TanStack Query integration', type: 'VIDEO', duration: 1200 },
                { title: 'Quiz tổng hợp Next.js', type: 'QUIZ' },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Node.js & NestJS Backend Master',
      slug: 'nodejs-nestjs-backend-master',
      shortDescription: 'Xây dựng REST API chuyên nghiệp với Node.js và NestJS framework.',
      description:
        '<h2>Nội dung khóa học</h2><ul><li>Node.js fundamentals</li><li>NestJS architecture</li><li>Prisma ORM</li><li>Authentication & Authorization</li></ul>',
      price: 599000,
      level: 'INTERMEDIATE',
      instructorIdx: 0,
      categorySlug: 'web-development',
      tagNames: ['Node.js', 'NestJS', 'TypeScript', 'PostgreSQL', 'REST API'],
      sections: [
        {
          title: 'Node.js Fundamentals',
          chapters: [
            {
              title: 'Node.js Core',
              isFreePreview: true,
              lessons: [
                { title: 'Event Loop & Async', type: 'VIDEO', duration: 1080 },
                { title: 'Modules & NPM', type: 'VIDEO', duration: 720 },
              ],
            },
            {
              title: 'Express.js Basics',
              lessons: [
                { title: 'REST API with Express', type: 'VIDEO', duration: 960 },
                { title: 'Middleware pattern', type: 'VIDEO', duration: 840 },
              ],
            },
          ],
        },
        {
          title: 'NestJS Framework',
          chapters: [
            {
              title: 'NestJS Architecture',
              lessons: [
                { title: 'Modules, Controllers, Services', type: 'VIDEO', duration: 1200 },
                { title: 'Dependency Injection', type: 'VIDEO', duration: 900 },
                { title: 'NestJS Quiz', type: 'QUIZ' },
              ],
            },
            {
              title: 'Database & Prisma',
              lessons: [
                { title: 'Prisma setup & migrations', type: 'VIDEO', duration: 1080 },
                { title: 'CRUD operations', type: 'VIDEO', duration: 1320 },
                {
                  title: 'Relations & Transactions',
                  type: 'TEXT',
                  textContent: '<h3>Prisma Relations</h3><p>One-to-many, many-to-many...</p>',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Python cho Data Science',
      slug: 'python-data-science',
      shortDescription: 'Học Python từ đầu và ứng dụng trong phân tích dữ liệu, Machine Learning.',
      description:
        '<h2>Khóa học bao gồm</h2><ul><li>Python cơ bản đến nâng cao</li><li>NumPy, Pandas, Matplotlib</li><li>Machine Learning với Scikit-learn</li></ul>',
      price: 399000,
      level: 'BEGINNER',
      instructorIdx: 1,
      categorySlug: 'data-science',
      tagNames: ['Python', 'Machine Learning', 'SQL'],
      sections: [
        {
          title: 'Python Cơ Bản',
          chapters: [
            {
              title: 'Bắt đầu với Python',
              isFreePreview: true,
              lessons: [
                { title: 'Cài đặt Python & IDE', type: 'VIDEO', duration: 480 },
                { title: 'Biến & Kiểu dữ liệu', type: 'VIDEO', duration: 720 },
                { title: 'Quiz Python basics', type: 'QUIZ' },
              ],
            },
            {
              title: 'Control Flow & Functions',
              lessons: [
                { title: 'If/else, loops', type: 'VIDEO', duration: 840 },
                { title: 'Functions & Lambda', type: 'VIDEO', duration: 960 },
              ],
            },
          ],
        },
        {
          title: 'Data Analysis',
          chapters: [
            {
              title: 'NumPy & Pandas',
              lessons: [
                { title: 'NumPy arrays', type: 'VIDEO', duration: 1200 },
                { title: 'Pandas DataFrame', type: 'VIDEO', duration: 1440 },
                { title: 'Data cleaning', type: 'VIDEO', duration: 1080 },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Flutter Mobile App Development',
      slug: 'flutter-mobile-app-development',
      shortDescription: 'Xây dựng ứng dụng mobile đa nền tảng với Flutter và Dart.',
      description:
        '<h2>Học Flutter từ A-Z</h2><ul><li>Dart programming</li><li>Flutter widgets</li><li>State management</li><li>Firebase integration</li></ul>',
      price: 449000,
      level: 'BEGINNER',
      instructorIdx: 2,
      categorySlug: 'mobile-development',
      tagNames: ['Flutter', 'Kotlin', 'Swift'],
      sections: [
        {
          title: 'Dart & Flutter Basics',
          chapters: [
            {
              title: 'Ngôn ngữ Dart',
              isFreePreview: true,
              lessons: [
                { title: 'Dart syntax', type: 'VIDEO', duration: 600 },
                { title: 'OOP in Dart', type: 'VIDEO', duration: 900 },
              ],
            },
            {
              title: 'Flutter Widgets',
              lessons: [
                { title: 'StatelessWidget & StatefulWidget', type: 'VIDEO', duration: 1080 },
                { title: 'Layout widgets', type: 'VIDEO', duration: 960 },
                { title: 'Quiz Widgets', type: 'QUIZ' },
              ],
            },
          ],
        },
        {
          title: 'State Management',
          chapters: [
            {
              title: 'Provider & Riverpod',
              lessons: [
                { title: 'Provider pattern', type: 'VIDEO', duration: 1200 },
                { title: 'Riverpod advanced', type: 'VIDEO', duration: 1380 },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Docker & Kubernetes thực chiến',
      slug: 'docker-kubernetes-thuc-chien',
      shortDescription: 'Containerize ứng dụng và deploy lên Kubernetes cluster.',
      description:
        '<h2>DevOps cho Developer</h2><ul><li>Docker basics & Dockerfile</li><li>Docker Compose</li><li>Kubernetes architecture</li><li>CI/CD pipeline</li></ul>',
      price: 549000,
      level: 'ADVANCED',
      instructorIdx: 0,
      categorySlug: 'devops-cloud',
      tagNames: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux'],
      sections: [
        {
          title: 'Docker',
          chapters: [
            {
              title: 'Docker Fundamentals',
              isFreePreview: true,
              lessons: [
                { title: 'Container vs VM', type: 'VIDEO', duration: 720 },
                { title: 'Dockerfile best practices', type: 'VIDEO', duration: 1200 },
              ],
            },
            {
              title: 'Docker Compose',
              lessons: [
                { title: 'Multi-container apps', type: 'VIDEO', duration: 1080 },
                { title: 'Networking & Volumes', type: 'VIDEO', duration: 960 },
              ],
            },
          ],
        },
        {
          title: 'Kubernetes',
          chapters: [
            {
              title: 'K8s Architecture',
              lessons: [
                { title: 'Pods, Services, Deployments', type: 'VIDEO', duration: 1440 },
                { title: 'Helm charts', type: 'VIDEO', duration: 1200 },
                { title: 'Quiz K8s', type: 'QUIZ' },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Deep Learning với PyTorch',
      slug: 'deep-learning-pytorch',
      shortDescription: 'Neural networks, CNN, RNN, Transformers với PyTorch framework.',
      description:
        '<h2>AI/ML nâng cao</h2><ul><li>Neural Network fundamentals</li><li>CNN for Computer Vision</li><li>RNN/LSTM for NLP</li><li>Transformer architecture</li></ul>',
      price: 699000,
      level: 'ADVANCED',
      instructorIdx: 1,
      categorySlug: 'data-science',
      tagNames: ['Deep Learning', 'Python', 'Computer Vision', 'NLP'],
      sections: [
        {
          title: 'Neural Networks',
          chapters: [
            {
              title: 'Perceptron & MLP',
              isFreePreview: true,
              lessons: [
                { title: 'Forward & Backward propagation', type: 'VIDEO', duration: 1800 },
                {
                  title: 'Activation functions',
                  type: 'TEXT',
                  textContent:
                    '<h3>Activation Functions</h3><p>ReLU, Sigmoid, Tanh, Softmax...</p>',
                },
              ],
            },
            {
              title: 'CNN',
              lessons: [
                { title: 'Convolutional layers', type: 'VIDEO', duration: 1500 },
                { title: 'Image classification project', type: 'VIDEO', duration: 2400 },
                { title: 'CNN Quiz', type: 'QUIZ' },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'HTML, CSS & JavaScript cho người mới',
      slug: 'html-css-javascript-co-ban',
      shortDescription: 'Khóa học lập trình web miễn phí dành cho người mới bắt đầu.',
      description:
        '<h2>Bắt đầu hành trình lập trình</h2><ul><li>HTML5 semantic</li><li>CSS3 & Flexbox/Grid</li><li>JavaScript ES6+</li></ul>',
      price: 0, // FREE
      level: 'BEGINNER',
      instructorIdx: 0,
      categorySlug: 'web-development',
      tagNames: ['HTML', 'CSS', 'JavaScript'],
      sections: [
        {
          title: 'HTML & CSS',
          chapters: [
            {
              title: 'HTML Basics',
              isFreePreview: true,
              lessons: [
                { title: 'HTML tags & structure', type: 'VIDEO', duration: 600 },
                { title: 'Forms & Tables', type: 'VIDEO', duration: 480 },
              ],
            },
            {
              title: 'CSS Styling',
              lessons: [
                { title: 'Selectors & Properties', type: 'VIDEO', duration: 720 },
                { title: 'Flexbox & Grid', type: 'VIDEO', duration: 900 },
              ],
            },
          ],
        },
        {
          title: 'JavaScript',
          chapters: [
            {
              title: 'JS Fundamentals',
              lessons: [
                { title: 'Variables & Types', type: 'VIDEO', duration: 600 },
                { title: 'Functions & Scope', type: 'VIDEO', duration: 780 },
                { title: 'DOM Manipulation', type: 'VIDEO', duration: 900 },
                { title: 'JS Quiz', type: 'QUIZ' },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'React Native Cross-Platform',
      slug: 'react-native-cross-platform',
      shortDescription: 'Xây dựng ứng dụng iOS/Android với React Native và Expo.',
      description:
        '<h2>Mobile Development với JavaScript</h2><ul><li>React Native core</li><li>Navigation</li><li>Native modules</li><li>App Store deployment</li></ul>',
      price: 399000,
      level: 'INTERMEDIATE',
      instructorIdx: 2,
      categorySlug: 'mobile-development',
      tagNames: ['React Native', 'JavaScript', 'TypeScript'],
      sections: [
        {
          title: 'React Native Basics',
          chapters: [
            {
              title: 'Expo & Setup',
              isFreePreview: true,
              lessons: [
                { title: 'Expo setup', type: 'VIDEO', duration: 540 },
                { title: 'Core components', type: 'VIDEO', duration: 900 },
              ],
            },
            {
              title: 'Navigation',
              lessons: [
                { title: 'React Navigation', type: 'VIDEO', duration: 1200 },
                { title: 'Tab & Stack navigators', type: 'VIDEO', duration: 1080 },
                { title: 'Navigation Quiz', type: 'QUIZ' },
              ],
            },
          ],
        },
      ],
    },
  ];

  interface CreatedCourse {
    id: string;
    title: string;
    price: number;
    instructorId: string;
    lessonIds: string[];
    totalLessons: number;
    totalDuration: number;
  }

  const createdCourses: CreatedCourse[] = [];

  for (const spec of courseSpecs) {
    const instructorId = instructors[spec.instructorIdx]!.id;

    // Create course
    const course = await prisma.course.upsert({
      where: { slug: spec.slug },
      update: {},
      create: {
        title: spec.title,
        slug: spec.slug,
        shortDescription: spec.shortDescription,
        description: spec.description,
        price: spec.price,
        originalPrice: spec.price > 0 ? Math.round(spec.price * 1.3) : undefined,
        thumbnailUrl: courseThumbnail(spec.slug),
        level: spec.level,
        status: 'PUBLISHED',
        instructorId,
        categoryId: categories[spec.categorySlug],
        publishedAt: daysAgo(randomBetween(10, 40)),
        createdAt: daysAgo(randomBetween(40, 60)),
      },
    });

    // Tags
    for (const tagName of spec.tagNames) {
      if (tags[tagName]) {
        await prisma.courseTag.upsert({
          where: { courseId_tagId: { courseId: course.id, tagId: tags[tagName]! } },
          update: {},
          create: { courseId: course.id, tagId: tags[tagName]! },
        });
      }
    }

    // Sections → Chapters → Lessons
    const allLessonIds: string[] = [];
    let courseTotalLessons = 0;
    let courseTotalDuration = 0;

    for (let si = 0; si < spec.sections.length; si++) {
      const sectionSpec = spec.sections[si]!;
      const section = await prisma.section.create({
        data: {
          title: sectionSpec.title,
          order: si + 1,
          courseId: course.id,
        },
      });

      for (let ci = 0; ci < sectionSpec.chapters.length; ci++) {
        const chapterSpec = sectionSpec.chapters[ci]!;
        let chapterDuration = 0;
        let chapterLessonCount = 0;

        const chapter = await prisma.chapter.create({
          data: {
            title: chapterSpec.title,
            order: ci + 1,
            price: chapterSpec.price,
            isFreePreview: chapterSpec.isFreePreview ?? false,
            sectionId: section.id,
          },
        });

        for (let li = 0; li < chapterSpec.lessons.length; li++) {
          const lessonSpec = chapterSpec.lessons[li]!;
          const lesson = await prisma.lesson.create({
            data: {
              title: lessonSpec.title,
              type: lessonSpec.type,
              order: li + 1,
              chapterId: chapter.id,
              estimatedDuration:
                lessonSpec.type === 'VIDEO'
                  ? sampleVideo(courseTotalLessons + li).duration
                  : lessonSpec.duration,
              textContent: lessonSpec.textContent,
              videoUrl:
                lessonSpec.type === 'VIDEO' ? sampleVideo(courseTotalLessons + li).url : undefined,
            },
          });
          allLessonIds.push(lesson.id);
          chapterLessonCount++;
          const lessonDuration =
            lessonSpec.type === 'VIDEO'
              ? sampleVideo(courseTotalLessons + li).duration
              : (lessonSpec.duration ?? 0);
          chapterDuration += lessonDuration;

          // Create quiz for QUIZ type lessons
          if (lessonSpec.type === 'QUIZ') {
            const quiz = await prisma.quiz.create({
              data: {
                lessonId: lesson.id,
                passingScore: 0.6,
                maxAttempts: 3,
              },
            });
            // 3 questions per quiz
            for (let qi = 0; qi < 3; qi++) {
              const question = await prisma.quizQuestion.create({
                data: {
                  quizId: quiz.id,
                  question: `Câu hỏi ${qi + 1} về ${chapterSpec.title}?`,
                  explanation: `Đáp án đúng vì lý do liên quan đến ${chapterSpec.title}.`,
                  order: qi + 1,
                },
              });
              const correctIdx = randomBetween(0, 3);
              for (let oi = 0; oi < 4; oi++) {
                await prisma.quizOption.create({
                  data: {
                    questionId: question.id,
                    text: `Đáp án ${String.fromCharCode(65 + oi)}`,
                    isCorrect: oi === correctIdx,
                    order: oi + 1,
                  },
                });
              }
            }
          }
        }

        // Update chapter counters
        await prisma.chapter.update({
          where: { id: chapter.id },
          data: { lessonsCount: chapterLessonCount, totalDuration: chapterDuration },
        });

        courseTotalLessons += chapterLessonCount;
        courseTotalDuration += chapterDuration;
      }
    }

    // Update course counters
    await prisma.course.update({
      where: { id: course.id },
      data: { totalLessons: courseTotalLessons, totalDuration: courseTotalDuration },
    });

    createdCourses.push({
      id: course.id,
      title: spec.title,
      price: spec.price,
      instructorId,
      lessonIds: allLessonIds,
      totalLessons: courseTotalLessons,
      totalDuration: courseTotalDuration,
    });
  }
  console.log(`✓ ${createdCourses.length} courses with curriculum`);

  // ============================================================
  // 5. ENROLLMENTS + ORDERS + EARNINGS (simulate purchases)
  // ============================================================

  // Define who buys what
  const purchaseMap = [
    // [studentIdx, courseIdx] — courseIdx maps to createdCourses
    [0, 0],
    [0, 1],
    [0, 6], // An: React, NestJS, HTML(free)
    [1, 0],
    [1, 2],
    [1, 6], // Mai: React, Python, HTML(free)
    [2, 1],
    [2, 4], // Tuấn: NestJS, Docker
    [3, 2],
    [3, 5], // Hương: Python, Deep Learning
    [4, 0],
    [4, 3],
    [4, 6], // Sơn: React, Flutter, HTML(free)
    [5, 2],
    [5, 6], // Yến: Python, HTML(free)
    [6, 0],
    [6, 1],
    [6, 4], // Minh: React, NestJS, Docker
    [7, 3],
    [7, 7], // Hạnh: Flutter, React Native
    [8, 0],
    [8, 5], // Hiếu: React, Deep Learning
    [9, 2],
    [9, 3],
    [9, 6], // Linh: Python, Flutter, HTML(free)
  ];

  // Track instructor earnings for counter reconciliation
  const instructorEarnings: Record<
    string,
    { revenue: number; students: Set<string>; balance: number }
  > = {};
  for (const inst of instructors) {
    instructorEarnings[inst.id] = { revenue: 0, students: new Set(), balance: 0 };
  }

  for (const [si, ci] of purchaseMap) {
    const student = students[si!]!;
    const course = createdCourses[ci!]!;

    // Check if enrollment already exists
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: student.id, courseId: course.id } },
    });
    if (existing) continue;

    if (course.price > 0) {
      // PAID course → create order + earning
      const orderCode = generateOrderCode();
      const commissionAmount = Math.round(course.price * COMMISSION_RATE);
      const netAmount = course.price - commissionAmount;
      const paidAt = daysAgo(randomBetween(3, 25));

      const order = await prisma.order.create({
        data: {
          userId: student.id,
          totalAmount: course.price,
          discountAmount: 0,
          finalAmount: course.price,
          orderCode,
          status: 'COMPLETED',
          paidAt,
          createdAt: paidAt,
          items: {
            create: {
              type: 'COURSE',
              courseId: course.id,
              price: course.price,
              discount: 0,
              title: course.title,
            },
          },
        },
        include: { items: true },
      });

      // Earning for instructor
      await prisma.earning.create({
        data: {
          instructorId: course.instructorId,
          orderItemId: order.items[0]!.id,
          amount: course.price,
          commissionRate: COMMISSION_RATE,
          commissionAmount,
          netAmount,
          status: 'AVAILABLE',
          availableAt: paidAt,
          createdAt: paidAt,
        },
      });

      // Track for counters
      const tracker = instructorEarnings[course.instructorId]!;
      tracker.revenue += netAmount;
      tracker.balance += netAmount;
      tracker.students.add(student.id);
    }

    // Create enrollment
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        type: 'FULL',
        progress: 0,
        createdAt: daysAgo(randomBetween(2, 20)),
      },
    });

    // Track student count for free courses too
    const tracker = instructorEarnings[course.instructorId]!;
    tracker.students.add(student.id);
  }

  // Update course totalStudents
  for (const course of createdCourses) {
    const count = await prisma.enrollment.count({ where: { courseId: course.id } });
    await prisma.course.update({
      where: { id: course.id },
      data: { totalStudents: count },
    });
  }

  // Update instructor profiles from DB aggregates (most accurate)
  for (const inst of instructors) {
    const [courseCount, earningsAgg, uniqueStudents] = await Promise.all([
      prisma.course.count({
        where: { instructorId: inst.id, status: 'PUBLISHED' },
      }),
      prisma.earning.aggregate({
        where: { instructorId: inst.id },
        _sum: { netAmount: true },
      }),
      prisma.enrollment.findMany({
        where: { course: { instructorId: inst.id } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);
    const totalRevenue = earningsAgg._sum.netAmount ?? 0;
    await prisma.instructorProfile.update({
      where: { userId: inst.id },
      data: {
        totalRevenue,
        totalStudents: uniqueStudents.length,
        totalCourses: courseCount,
        availableBalance: totalRevenue,
      },
    });
  }

  const totalEnrollments = await prisma.enrollment.count();
  const totalOrders = await prisma.order.count();
  console.log(`✓ ${totalEnrollments} enrollments, ${totalOrders} orders, earnings synced`);

  // ============================================================
  // 6. LESSON PROGRESS (simulate learning)
  // ============================================================

  // Progress map: [studentIdx, courseIdx, progressPercent]
  const progressMap = [
    [0, 0, 0.75],
    [0, 1, 0.3],
    [0, 6, 1.0],
    [1, 0, 1.0],
    [1, 2, 0.5],
    [2, 1, 0.6],
    [3, 2, 1.0],
    [3, 5, 0.2],
    [4, 0, 0.4],
    [4, 3, 0.8],
    [6, 0, 1.0],
    [6, 1, 0.45],
    [8, 0, 0.55],
    [9, 2, 0.7],
  ];

  for (const [si, ci, percent] of progressMap) {
    const student = students[si!]!;
    const course = createdCourses[ci!]!;
    const lessonsToComplete = Math.floor(course.lessonIds.length * (percent as number));

    for (let i = 0; i < lessonsToComplete; i++) {
      const lessonId = course.lessonIds[i]!;
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: student.id, lessonId } },
        update: {},
        create: {
          userId: student.id,
          lessonId,
          isCompleted: true,
          watchedPercent: 1.0,
          lastPosition: 0,
        },
      });
    }

    // Update enrollment progress
    const completedCount = await prisma.lessonProgress.count({
      where: { userId: student.id, lessonId: { in: course.lessonIds }, isCompleted: true },
    });
    const progress = course.totalLessons > 0 ? completedCount / course.totalLessons : 0;
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: student.id, courseId: course.id } },
      data: { progress: Math.round(progress * 100) / 100 },
    });

    // Certificate for 100% completion
    if (percent === 1.0) {
      const verifyCode = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await prisma.certificate.upsert({
        where: { userId_courseId: { userId: student.id, courseId: course.id } },
        update: {},
        create: {
          userId: student.id,
          courseId: course.id,
          certificateUrl: `https://sslm.com/certificates/${verifyCode}`,
          verifyCode,
        },
      });
    }
  }

  const totalProgress = await prisma.lessonProgress.count();
  const totalCerts = await prisma.certificate.count();
  console.log(`✓ ${totalProgress} lesson progress records, ${totalCerts} certificates`);

  // ============================================================
  // 7. REVIEWS (students review courses they've progressed in)
  // ============================================================

  const reviewData = [
    // [studentIdx, courseIdx, rating, comment]
    [0, 0, 5, 'Khóa học rất hay và chi tiết! Giảng viên giải thích dễ hiểu.'],
    [0, 6, 5, 'Khóa miễn phí mà chất lượng tuyệt vời, rất phù hợp cho người mới.'],
    [1, 0, 4, 'Nội dung tốt, nhưng một số phần hơi nhanh. Tổng thể vẫn rất đáng học.'],
    [1, 2, 5, 'Python cho DS giải thích rất rõ ràng, có nhiều ví dụ thực tế.'],
    [2, 1, 4, 'NestJS backend rất chuyên nghiệp, học được nhiều pattern hay.'],
    [3, 2, 5, 'Chị Lan dạy data science rất dễ hiểu, recommend cho ai muốn học DS.'],
    [3, 5, 4, 'Deep Learning hơi khó nhưng nội dung chất lượng cao.'],
    [4, 0, 5, 'React Next.js toàn diện thật, đủ để build dự án thực tế.'],
    [4, 3, 4, 'Flutter course khá ổn, mong có thêm phần animation.'],
    [6, 0, 4, 'Đã áp dụng được vào dự án công ty. Cảm ơn thầy Đức!'],
    [6, 1, 5, 'Backend master đúng nghĩa, từ cơ bản đến deploy production.'],
    [6, 4, 5, 'Docker K8s thực chiến, rất cần cho DevOps roadmap.'],
    [8, 0, 4, 'Khóa hay, phần hooks giải thích sâu. 4 sao vì muốn thêm ví dụ.'],
    [9, 2, 5, 'Dễ hiểu, phù hợp người chuyển từ ngành khác sang IT.'],
    [9, 3, 4, 'Flutter nhập môn tốt, cần cập nhật thêm Flutter 3.x mới.'],
  ];

  for (const [si, ci, rating, comment] of reviewData) {
    const student = students[si as number]!;
    const course = createdCourses[ci as number]!;
    await prisma.review.upsert({
      where: { userId_courseId: { userId: student.id, courseId: course.id } },
      update: {},
      create: {
        userId: student.id,
        courseId: course.id,
        rating: rating as number,
        comment: comment as string,
        createdAt: daysAgo(randomBetween(1, 15)),
      },
    });
  }

  // Recalculate avgRating + reviewCount for each course
  for (const course of createdCourses) {
    const agg = await prisma.review.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.course.update({
      where: { id: course.id },
      data: {
        avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        reviewCount: agg._count.rating,
      },
    });
  }
  console.log(`✓ ${reviewData.length} reviews with ratings synced`);

  // ============================================================
  // 8. COUPONS
  // ============================================================

  const couponData = [
    {
      code: 'WELCOME20',
      type: 'PERCENTAGE' as const,
      value: 20,
      maxDiscount: 200000,
      instructorIdx: 0,
      courseIdxs: [0, 1],
    },
    {
      code: 'PYTHON50K',
      type: 'FIXED_AMOUNT' as const,
      value: 50000,
      instructorIdx: 1,
      courseIdxs: [2],
    },
    {
      code: 'MOBILE15',
      type: 'PERCENTAGE' as const,
      value: 15,
      maxDiscount: 100000,
      instructorIdx: 2,
      courseIdxs: [3, 7],
    },
  ];

  for (const c of couponData) {
    const existing = await prisma.coupon.findUnique({ where: { code: c.code } });
    if (existing) continue;

    const coupon = await prisma.coupon.create({
      data: {
        code: c.code,
        type: c.type,
        value: c.value,
        maxDiscount: c.maxDiscount,
        usageLimit: 100,
        maxUsesPerUser: 1,
        startDate: daysAgo(30),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
        instructorId: instructors[c.instructorIdx]!.id,
      },
    });

    for (const courseIdx of c.courseIdxs) {
      await prisma.couponCourse.create({
        data: { couponId: coupon.id, courseId: createdCourses[courseIdx]!.id },
      });
    }
  }
  console.log(`✓ ${couponData.length} coupons`);

  // ============================================================
  // 9. SOCIAL (posts, comments, likes, follows)
  // ============================================================

  const allUsers = [...instructors, ...students];

  // Follows
  const followPairs = [
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
    [9, 0], // students follow instructor Đức
    [3, 1],
    [5, 1],
    [8, 1], // students follow instructor Lan
    [4, 2],
    [7, 2], // students follow instructor Hoàng
    [3, 4],
    [4, 6],
    [6, 8],
    [7, 9], // students follow each other
  ];

  for (const [followerIdx, followingIdx] of followPairs) {
    const followerId = allUsers[followerIdx! + 3]?.id ?? students[followerIdx!]?.id; // offset for students
    const followingId = allUsers[followingIdx!]?.id;
    if (!followerId || !followingId || followerId === followingId) continue;

    try {
      await prisma.follow.create({
        data: { followerId, followingId },
      });
    } catch {
      // Skip duplicate
    }
  }

  // Reconcile follower/following counts
  await prisma.$executeRaw`
    UPDATE users SET
      follower_count = (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id),
      following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id)
    WHERE deleted_at IS NULL
  `;
  console.log('✓ Follows with counters');

  // Posts
  const postData = [
    {
      authorIdx: 0,
      content: 'Vừa release khóa React & Next.js mới! Ai muốn học fullstack hãy đăng ký nhé 🚀',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 1,
      content: 'Chia sẻ notebook phân tích dữ liệu COVID-19 bằng Pandas. Link trong comment.',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 2,
      content: 'Flutter 3.x có nhiều cải tiến performance đáng kể. Đang cập nhật khóa học.',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 3,
      content: 'Vừa hoàn thành khóa React! Cảm ơn thầy @Đức rất nhiều 💪',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 4,
      content: 'Có ai đang học Docker không? Cùng trao đổi kinh nghiệm nhé!',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 5,
      content:
        'Tips: Dùng useMemo và useCallback đúng cách sẽ cải thiện performance React app rất nhiều.',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 6,
      content: 'So sánh NestJS vs Express: NestJS structure tốt hơn nhiều cho dự án lớn.',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 0,
      content:
        '5 design patterns cần biết khi code TypeScript backend:\n1. Repository\n2. Factory\n3. Strategy\n4. Observer\n5. Decorator',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 1,
      content: 'Machine Learning không khó như bạn nghĩ. Bắt đầu với Scikit-learn và bạn sẽ thấy!',
      type: 'TEXT' as const,
    },
    {
      authorIdx: 7,
      content: 'Mới bắt đầu học lập trình, cảm thấy hơi overwhelmed. Có ai tips gì không?',
      type: 'TEXT' as const,
    },
  ];

  const createdPosts: Array<{ id: string; authorIdx: number }> = [];
  for (const p of postData) {
    const authorId = p.authorIdx < 3 ? instructors[p.authorIdx]!.id : students[p.authorIdx - 3]!.id;
    const post = await prisma.post.create({
      data: {
        authorId,
        type: p.type,
        content: p.content,
        createdAt: daysAgo(randomBetween(1, 20)),
      },
    });
    createdPosts.push({ id: post.id, authorIdx: p.authorIdx });
  }

  // Comments
  const commentData = [
    { postIdx: 0, authorOffset: 3, content: 'Đăng ký rồi! Hype quá!' },
    { postIdx: 0, authorOffset: 6, content: 'Khóa cũ hay lắm, khóa mới chắc càng tuyệt.' },
    { postIdx: 3, authorOffset: 0, content: 'Chúc mừng em! Cố gắng phát huy nhé 💪' },
    { postIdx: 4, authorOffset: 6, content: 'Mình đang học Docker, cùng trao đổi nhé!' },
    { postIdx: 6, authorOffset: 0, content: 'Đúng rồi, NestJS có DI container rất mạnh.' },
    {
      postIdx: 9,
      authorOffset: 1,
      content: 'Bắt đầu từ HTML/CSS rồi lên JavaScript. Đừng vội nhé!',
    },
    {
      postIdx: 9,
      authorOffset: 0,
      content: 'Mình có khóa miễn phí cho người mới, em tham khảo nhé.',
    },
    { postIdx: 7, authorOffset: 6, content: 'Decorator pattern trong NestJS rất powerful!' },
  ];

  for (const c of commentData) {
    const post = createdPosts[c.postIdx]!;
    const authorId =
      c.authorOffset < 3 ? instructors[c.authorOffset]!.id : students[c.authorOffset - 3]!.id;
    await prisma.comment.create({
      data: {
        postId: post.id,
        authorId,
        content: c.content,
        createdAt: daysAgo(randomBetween(0, 15)),
      },
    });
  }

  // Likes (random likes on posts)
  for (const post of createdPosts) {
    const likerCount = randomBetween(2, 6);
    const likers = students.sort(() => Math.random() - 0.5).slice(0, likerCount);
    for (const liker of likers) {
      try {
        await prisma.like.create({
          data: { userId: liker.id, postId: post.id },
        });
      } catch {
        // Skip duplicate
      }
    }
  }

  // Reconcile post counters
  await prisma.$executeRaw`
    UPDATE posts SET
      like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id),
      comment_count = (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id)
    WHERE deleted_at IS NULL
  `;
  console.log(`✓ ${createdPosts.length} posts, comments, likes`);

  // ============================================================
  // 10. Q&A (questions + answers)
  // ============================================================

  const qnaData = [
    {
      authorIdx: 3,
      courseIdx: 0,
      tagName: 'React',
      title: 'useEffect chạy 2 lần trong Strict Mode?',
      content: 'Mình thấy useEffect chạy 2 lần khi dev, đây là bug hay feature?',
    },
    {
      authorIdx: 4,
      courseIdx: 1,
      tagName: 'NestJS',
      title: 'Cách inject service vào guard?',
      content: 'Mình muốn inject UserService vào AuthGuard nhưng bị circular dependency.',
    },
    {
      authorIdx: 5,
      courseIdx: 2,
      tagName: 'Python',
      title: 'Pandas groupby chậm với dataset lớn?',
      content: 'Dataset 1 triệu rows, groupby mất 30s. Có cách optimize không?',
    },
    {
      authorIdx: 6,
      courseIdx: 0,
      tagName: 'Next.js',
      title: 'Server Component có thể dùng useState?',
      content: 'Tại sao Server Component không dùng được hooks?',
    },
    {
      authorIdx: 7,
      courseIdx: 3,
      tagName: 'Flutter',
      title: 'Hot reload không hoạt động?',
      content: 'Sau khi thêm package mới, hot reload không reflect changes.',
    },
  ];

  for (const q of qnaData) {
    const authorId = students[q.authorIdx - 3]!.id;
    const question = await prisma.question.create({
      data: {
        title: q.title,
        content: q.content,
        authorId,
        courseId: createdCourses[q.courseIdx]!.id,
        tagId: tags[q.tagName],
        createdAt: daysAgo(randomBetween(1, 10)),
      },
    });

    // Instructor answers
    const instructorId = createdCourses[q.courseIdx]!.instructorId;
    const answer = await prisma.answer.create({
      data: {
        questionId: question.id,
        authorId: instructorId,
        content: `Câu hỏi hay! Đây là cách giải quyết vấn đề "${q.title}"...`,
        createdAt: daysAgo(randomBetween(0, 5)),
      },
    });

    // Mark as best answer
    await prisma.question.update({
      where: { id: question.id },
      data: { bestAnswerId: answer.id, answerCount: 1 },
    });
  }
  console.log(`✓ ${qnaData.length} questions with answers`);

  // ============================================================
  // 11. ANALYTICS SNAPSHOTS (30 days of data)
  // ============================================================

  for (let d = 30; d >= 1; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setHours(0, 0, 0, 0);

    const snapshots = [
      {
        type: 'DAILY_USERS' as const,
        data: { students: randomBetween(0, 3), instructors: randomBetween(0, 1) },
      },
      { type: 'DAILY_REVENUE' as const, data: { revenue: randomBetween(0, 5) * 100000 } },
      { type: 'DAILY_ENROLLMENTS' as const, data: { count: randomBetween(0, 4) } },
      { type: 'DAILY_COURSES' as const, data: { count: randomBetween(0, 1) } },
    ];

    for (const s of snapshots) {
      await prisma.analyticsSnapshot.upsert({
        where: { date_type: { date, type: s.type } },
        update: { data: s.data },
        create: { date, type: s.type, data: s.data },
      });
    }
  }
  console.log('✓ 30 days of analytics snapshots');

  // ============================================================
  // 12. TAG COURSE COUNTS
  // ============================================================

  await prisma.$executeRaw`
    UPDATE tags SET
      course_count = (SELECT COUNT(*) FROM course_tags WHERE course_tags.tag_id = tags.id)
  `;
  console.log('✓ Tag course counts synced');

  // ============================================================
  // SUMMARY
  // ============================================================

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.order.count(),
    prisma.earning.count(),
    prisma.review.count(),
    prisma.post.count(),
    prisma.question.count(),
  ]);
  console.log('\n🎉 Seed completed!');
  console.log(`   Users: ${counts[0]} | Courses: ${counts[1]} | Enrollments: ${counts[2]}`);
  console.log(`   Orders: ${counts[3]} | Earnings: ${counts[4]} | Reviews: ${counts[5]}`);
  console.log(`   Posts: ${counts[6]} | Questions: ${counts[7]}`);
  console.log('\n📝 All accounts password: Password@123');
  console.log('   Admin: admin@sslm.com / Admin@123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
