# Phase 5.15 — TESTING & DEPLOYMENT

> Backend tests (Jest + Supertest), Frontend tests (Vitest), CI/CD, Production deployment.
> Tham chiếu: `docs/phase1-analysis/04-tech-stack-and-implementation.md`

---

## Mục lục

- [Step 1: Backend Unit Tests (Jest)](#step-1-backend-unit-tests-jest)
- [Step 2: Backend Integration Tests (Supertest)](#step-2-backend-integration-tests-supertest)
- [Step 3: Frontend Component Tests (Vitest)](#step-3-frontend-component-tests-vitest)
- [Step 4: Test Coverage Requirements](#step-4-test-coverage-requirements)
- [Step 5: CI/CD with GitHub Actions](#step-5-cicd-with-github-actions)
- [Step 6: Production — Neon.tech (PostgreSQL)](#step-6-production--neontech-postgresql)
- [Step 7: Production — Upstash (Redis)](#step-7-production--upstash-redis)
- [Step 8: Production — Render.com (Backend)](#step-8-production--rendercom-backend)
- [Step 9: Production — Vercel (Frontend)](#step-9-production--vercel-frontend)
- [Step 10: Production Checklist](#step-10-production-checklist)

---

## Step 1: Backend Unit Tests (Jest)

### Test pattern — Services

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  describe('register', () => {
    it('should create user and send verification email', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      prisma.user.create = jest.fn().mockResolvedValue({ id: 'test-id' });

      const result = await service.register({
        email: 'test@test.com',
        password: 'Test1234',
        fullName: 'Test User',
      });

      expect(result.message).toBe('REGISTER_SUCCESS');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'test@test.com', password: 'Test1234', fullName: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
```

### Key services to test:

- AuthService (register, login, refresh, verify, reset)
- UsersService (profile, follow/unfollow)
- CoursesService (CRUD, search)
- OrdersService (create order, checkout flow)
- ProgressService (segments merge, completion)
- NotificationsService (create, mark read)

### Test guards and pipes:

- JwtAuthGuard (public vs protected routes)
- RolesGuard (role checking)
- ParseCuidPipe (valid/invalid CUID)

---

## Step 2: Backend Integration Tests (Supertest)

### Setup test database

```typescript
// test/setup.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  // Apply same pipes, filters, interceptors as main.ts
  await app.init();
  return app;
}
```

### Test flow example

```typescript
// test/auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/register → 201', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'Test1234', fullName: 'Test User' })
      .expect(201);
  });

  it('POST /api/auth/login → 200 with accessToken', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'Test1234' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.accessToken).toBeDefined();
      });
  });

  it('GET /api/users/me → 401 without token', () => {
    return request(app.getHttpServer()).get('/api/users/me').expect(401);
  });
});
```

---

## Step 3: Frontend Component Tests (Vitest)

### Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom --workspace=apps/student-portal
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Test pattern

```typescript
import { render, screen } from '@testing-library/react';
import { CourseCard } from '@/components/features/CourseCard';

describe('CourseCard', () => {
  it('renders course title and price', () => {
    render(<CourseCard course={{ title: 'NestJS', price: 499000 }} />);
    expect(screen.getByText('NestJS')).toBeInTheDocument();
    expect(screen.getByText('499,000đ')).toBeInTheDocument();
  });
});
```

---

## Step 4: Test Coverage Requirements

| Area                | Target | Priority |
| ------------------- | ------ | -------- |
| Auth service        | 90%    | Critical |
| Order/payment flow  | 85%    | Critical |
| Course CRUD         | 80%    | High     |
| Progress tracking   | 80%    | High     |
| Social features     | 70%    | Medium   |
| Admin features      | 70%    | Medium   |
| Frontend components | 60%    | Medium   |

---

## Step 5: CI/CD with GitHub Actions

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: sslm_test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx prisma migrate deploy --schema apps/api/src/prisma/schema.prisma
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/sslm_test
      - run: npm run test --workspace=apps/api
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/sslm_test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
```

---

## Step 6: Production — Neon.tech (PostgreSQL)

1. Create Neon project → get connection strings
2. Set `DATABASE_URL` and `DIRECT_URL` (with pooler for main, direct for migrations)
3. Run migration: `npx prisma migrate deploy`
4. Run raw SQL: pgvector extension, tsvector trigger
5. Run seed: `npx prisma db seed`

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
```

---

## Step 7: Production — Upstash (Redis)

1. Create Upstash Redis database
2. Get REST URL and token
3. Configure ioredis with Upstash connection string

```env
UPSTASH_REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

---

## Step 8: Production — Render.com (Backend)

1. Create Web Service → connect GitHub repo
2. Build command: `cd apps/api && npm run build`
3. Start command: `cd apps/api && node dist/main.js`
4. Environment variables: all `.env` values
5. Health check path: `/api`
6. Auto-deploy on push to main

### Render `render.yaml` (optional)

```yaml
services:
  - type: web
    name: sslm-api
    runtime: node
    plan: free
    buildCommand: npm ci && cd apps/api && npx prisma generate && npm run build
    startCommand: cd apps/api && node dist/main.js
    healthCheckPath: /api
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromGroup: sslm-secrets
```

---

## Step 9: Production — Vercel (Frontend)

### Student Portal

1. Create Vercel project → import from GitHub
2. Root directory: `apps/student-portal`
3. Framework: Next.js
4. Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
5. Custom domain: `student.sslm.com` (or default Vercel domain)

### Management Portal

1. Create second Vercel project
2. Root directory: `apps/management-portal`
3. Same env vars but different URL

### Turborepo on Vercel

```json
// vercel.json (student-portal)
{
  "installCommand": "npm install",
  "buildCommand": "cd ../.. && npx turbo build --filter=student-portal"
}
```

---

## Step 10: Production Checklist

### Security

- [ ] All secrets in environment variables (not committed)
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Helmet middleware added
- [ ] HTTPS enforced
- [ ] httpOnly cookies for refresh token
- [ ] Input validation on all endpoints

### Performance

- [ ] Database indexes verified
- [ ] Redis caching for hot data
- [ ] Image optimization (Cloudinary transforms)
- [ ] Next.js ISR for semi-static pages
- [ ] Bundle size checked

### Monitoring

- [ ] Error tracking (Sentry — 5K errors/month free)
- [ ] Logging configured
- [ ] Health check endpoint

### Data

- [ ] Database backup strategy (Neon auto-backup)
- [ ] Seed data for demo
- [ ] Admin account created

### Deployment

- [ ] CI/CD pipeline green
- [ ] All environment variables set on all platforms
- [ ] DNS configured for custom domains
- [ ] SSL certificates active
- [ ] WebSocket CORS configured
- [ ] Cron jobs running
- [ ] Bull queues processing

### Testing

- [ ] Auth flow works end-to-end
- [ ] Course purchase flow works
- [ ] Chat real-time works
- [ ] AI Tutor responds correctly
- [ ] Dark mode renders correctly
- [ ] Both locales (vi/en) work
- [ ] Mobile responsive (student portal)
- [ ] Desktop layout (management portal)
