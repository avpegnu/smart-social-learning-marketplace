import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Admin account
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sslm.com' },
    update: {},
    create: {
      email: 'admin@sslm.com',
      passwordHash: await bcrypt.hash('Admin@123', 12),
      fullName: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      provider: 'LOCAL',
    },
  });
  console.warn(`Admin created: ${admin.email}`);

  // 2. Categories
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

  for (const cat of categoryData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.warn(`${categoryData.length} categories created`);

  // 3. Tags
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

  for (const name of tagNames) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }
  console.warn(`${tagNames.length} tags created`);

  // 4. Commission tiers
  const tiers = [
    { minRevenue: 0, rate: 0.3 },
    { minRevenue: 10000000, rate: 0.25 },
    { minRevenue: 50000000, rate: 0.2 },
  ];

  await prisma.commissionTier.deleteMany();
  for (const tier of tiers) {
    await prisma.commissionTier.create({ data: tier });
  }
  console.warn(`${tiers.length} commission tiers created`);

  // 5. Platform settings
  const settings = [
    { key: 'min_withdrawal_amount', value: 200000 },
    { key: 'order_expiry_minutes', value: 15 },
    { key: 'refund_period_days', value: 7 },
    { key: 'refund_max_progress', value: 0.1 },
    { key: 'ai_daily_limit', value: 10 },
    { key: 'review_min_progress', value: 0.3 },
    { key: 'lesson_complete_threshold', value: 0.8 },
  ];

  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.warn(`${settings.length} platform settings created`);
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
