# Phase 5.11 — ADMIN MODULE & BACKGROUND JOBS

> Admin dashboard, User management, Approvals, Analytics, Cron Jobs (9), Bull Queues (3).
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase3-backend/03-realtime-and-services.md`

---

## Mục lục

- [Step 1: Admin Module Structure](#step-1-admin-module-structure)
- [Step 2: Admin Service — User Management](#step-2-admin-service--user-management)
- [Step 3: Admin Service — Instructor Applications](#step-3-admin-service--instructor-applications)
- [Step 4: Admin Service — Course Review](#step-4-admin-service--course-review)
- [Step 5: Admin Service — Reports & Moderation](#step-5-admin-service--reports--moderation)
- [Step 6: Admin Service — Withdrawals Review](#step-6-admin-service--withdrawals-review)
- [Step 7: Admin Service — Categories & Tags CRUD](#step-7-admin-service--categories--tags-crud)
- [Step 8: Admin Service — Analytics & Settings](#step-8-admin-service--analytics--settings)
- [Step 9: Bull Queues (3 queues)](#step-9-bull-queues-3-queues)
- [Step 10: Cron Jobs (9 jobs)](#step-10-cron-jobs-9-jobs)
- [Step 11: Controllers](#step-11-controllers)
- [Step 12: Verify](#step-12-verify)

---

## Step 1: Admin Module Structure

```
src/modules/admin/
├── admin.module.ts
├── admin.controller.ts
├── admin.service.ts
├── instructor-apps/
│   ├── instructor-apps.controller.ts
│   └── instructor-apps.service.ts
├── course-reviews/
│   ├── course-reviews.controller.ts
│   └── course-reviews.service.ts
├── reports/
│   ├── reports.controller.ts
│   └── reports.service.ts
├── analytics/
│   ├── analytics.controller.ts
│   └── analytics.service.ts
└── dto/
    ├── review-application.dto.ts
    ├── review-course.dto.ts
    ├── review-report.dto.ts
    ├── review-withdrawal.dto.ts
    ├── create-category.dto.ts
    └── update-setting.dto.ts
```

---

## Step 2: Admin Service — User Management

```typescript
async getUsers(query: AdminQueryUsersDto) {
  const where = {
    ...(query.role && { role: query.role }),
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    deletedAt: null,
  };

  const [users, total] = await Promise.all([
    this.prisma.user.findMany({
      where,
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.user.count({ where }),
  ]);
  return createPaginatedResult(users, total, query.page, query.limit);
}

async updateUserStatus(userId: string, status: UserStatus) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { status },
  });
}
```

---

## Step 3: Admin Service — Instructor Applications

```typescript
async reviewApplication(applicationId: string, adminId: string, dto: ReviewApplicationDto) {
  const application = await this.prisma.instructorApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND' });

  return this.prisma.$transaction(async (tx) => {
    // Update application
    const updated = await tx.instructorApplication.update({
      where: { id: applicationId },
      data: {
        status: dto.approved ? 'APPROVED' : 'REJECTED',
        reviewedById: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });

    // If approved, promote user to INSTRUCTOR and create profile
    if (dto.approved) {
      await tx.user.update({
        where: { id: application.userId },
        data: { role: 'INSTRUCTOR' },
      });

      await tx.instructorProfile.create({
        data: {
          userId: application.userId,
          expertise: application.expertise,
          experience: application.experience,
        },
      });
    }

    // Send notification
    // ...

    return updated;
  });
}
```

---

## Step 4: Admin Service — Course Review

```typescript
async reviewCourse(courseId: string, adminId: string, dto: ReviewCourseDto) {
  const course = await this.prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== 'PENDING_REVIEW') {
    throw new BadRequestException({ code: 'COURSE_NOT_PENDING_REVIEW' });
  }

  const newStatus = dto.approved ? 'PUBLISHED' : 'REJECTED';
  return this.prisma.course.update({
    where: { id: courseId },
    data: {
      status: newStatus,
      publishedAt: dto.approved ? new Date() : undefined,
    },
  });
  // Send notification to instructor
}
```

---

## Step 5: Admin Service — Reports & Moderation

```typescript
async getReports(query: PaginationDto) {
  return this.prisma.report.findMany({
    where: { status: 'PENDING' },
    include: { reporter: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
    skip: query.skip,
    take: query.limit,
  });
}

async reviewReport(reportId: string, adminId: string, dto: ReviewReportDto) {
  return this.prisma.report.update({
    where: { id: reportId },
    data: {
      status: dto.actionTaken ? 'ACTION_TAKEN' : 'DISMISSED',
      reviewedById: adminId,
      reviewNote: dto.reviewNote,
      reviewedAt: new Date(),
    },
  });
}
```

---

## Step 6: Admin Service — Withdrawals Review

```typescript
async processWithdrawal(withdrawalId: string, adminId: string, dto: ReviewWithdrawalDto) {
  return this.prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: dto.approved ? 'COMPLETED' : 'REJECTED',
        reviewedById: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });

    if (dto.approved) {
      // Mark corresponding earnings as WITHDRAWN
      await tx.earning.updateMany({
        where: { instructorId: withdrawal.instructorId, status: 'AVAILABLE' },
        data: { status: 'WITHDRAWN' },
      });
    }

    return withdrawal;
  });
}
```

---

## Step 7: Admin Service — Categories & Tags CRUD

```typescript
// Categories
async createCategory(dto: CreateCategoryDto) {
  const slug = generateSlug(dto.name);
  return this.prisma.category.create({ data: { ...dto, slug } });
}

async updateCategory(id: string, dto: UpdateCategoryDto) {
  return this.prisma.category.update({ where: { id }, data: dto });
}

async deleteCategory(id: string) {
  // Check if courses exist under this category
  const count = await this.prisma.course.count({ where: { categoryId: id } });
  if (count > 0) throw new BadRequestException({ code: 'CATEGORY_HAS_COURSES' });
  return this.prisma.category.delete({ where: { id } });
}

// Tags — similar CRUD pattern
// Commission Tiers — similar CRUD pattern
// Platform Settings — key/value upsert pattern
```

---

## Step 8: Admin Service — Analytics & Settings

```typescript
async getDashboard() {
  const [totalUsers, totalCourses, totalRevenue, todayOrders] = await Promise.all([
    this.prisma.user.count({ where: { deletedAt: null } }),
    this.prisma.course.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    this.prisma.earning.aggregate({ _sum: { amount: true } }),
    this.prisma.order.count({
      where: { status: 'COMPLETED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return { totalUsers, totalCourses, totalRevenue: totalRevenue._sum.amount || 0, todayOrders };
}

async getAnalytics(type: AnalyticsType, fromDate: Date, toDate: Date) {
  return this.prisma.analyticsSnapshot.findMany({
    where: { type, date: { gte: fromDate, lte: toDate } },
    orderBy: { date: 'asc' },
  });
}
```

---

## Step 9: Bull Queues (3 queues)

### Install

```bash
npm install @nestjs/bullmq bullmq
```

### Setup in `app.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';

BullModule.forRoot({
  connection: {
    host: 'localhost',
    port: 6379,
  },
}),
BullModule.registerQueue(
  { name: 'email' },
  { name: 'notification' },
  { name: 'feed' },
),
```

### Queue 1: Email Queue

```typescript
// src/queues/email.processor.ts
@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'verification':
        return this.mailService.sendVerificationEmail(job.data.to, job.data.token);
      case 'reset-password':
        return this.mailService.sendResetPasswordEmail(job.data.to, job.data.token);
      case 'order-receipt':
        return this.mailService.sendOrderReceiptEmail(
          job.data.to,
          job.data.orderId,
          job.data.amount,
        );
      // course-approved, withdrawal-completed
    }
  }
}
```

### Queue 2: Notification Queue

```typescript
@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  async process(job: Job) {
    // Create notification + push via gateway
  }
}
```

### Queue 3: Feed Queue

```typescript
@Processor('feed')
export class FeedProcessor extends WorkerHost {
  async process(job: Job) {
    switch (job.name) {
      case 'fanout':
        // Create FeedItems for all followers of post author
        break;
      case 'cleanup':
        // Remove old feed items (keep max 1000/user)
        break;
    }
  }
}
```

---

## Step 10: Cron Jobs (9 jobs)

### Setup: `src/cron/cron.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class CronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // 1. Expire pending orders (every 1 min)
  @Cron('*/1 * * * *')
  async expirePendingOrders() {
    await this.prisma.order.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  // 2. Sync view counts from Redis to DB (every 5 min)
  @Cron('*/5 * * * *')
  async syncViewCounts() {
    const keys = await this.redis.keys('course_views:*');
    for (const key of keys) {
      const courseId = key.replace('course_views:', '');
      const views = parseInt((await this.redis.get(key)) || '0', 10);
      if (views > 0) {
        await this.prisma.course.update({
          where: { id: courseId },
          data: { viewCount: { increment: views } },
        });
        await this.redis.del(key);
      }
    }
  }

  // 3. Release available earnings (daily 1 AM)
  @Cron('0 1 * * *')
  async releaseAvailableEarnings() {
    const holdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await this.prisma.earning.updateMany({
      where: { status: 'PENDING', createdAt: { lt: holdDate } },
      data: { status: 'AVAILABLE' },
    });
  }

  // 4. Cleanup failed uploads (daily 2 AM)
  @Cron('0 2 * * *')
  async cleanupFailedUploads() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.media.updateMany({
      where: { status: 'UPLOADING', createdAt: { lt: cutoff } },
      data: { status: 'FAILED' },
    });
  }

  // 5. Compute analytics snapshot (daily 2 AM)
  @Cron('0 2 * * *')
  async computeAnalyticsSnapshot() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [users, revenue, enrollments] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: today } },
        _sum: { finalAmount: true },
      }),
      this.prisma.enrollment.count({ where: { createdAt: { gte: today } } }),
    ]);

    const snapshots = [
      { date: today, type: 'DAILY_USERS' as const, data: { count: users } },
      {
        date: today,
        type: 'DAILY_REVENUE' as const,
        data: { amount: revenue._sum.finalAmount || 0 },
      },
      { date: today, type: 'DAILY_ENROLLMENTS' as const, data: { count: enrollments } },
    ];

    for (const s of snapshots) {
      await this.prisma.analyticsSnapshot.upsert({
        where: { date_type: { date: s.date, type: s.type } },
        update: { data: s.data },
        create: s,
      });
    }
  }

  // 6. Cleanup expired tokens (daily 3 AM)
  @Cron('0 3 * * *')
  async cleanupExpiredTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // 7. Compute recommendation matrix (daily 3 AM)
  @Cron('0 3 * * *')
  async computeRecommendationMatrix() {
    // Calls RecommendationsService.computeAll()
    // Content-based + Collaborative + Hybrid (50/50)
  }

  // 8. Cleanup old feed items (weekly Sunday 4 AM)
  @Cron('0 4 * * 0')
  async cleanupOldFeedItems() {
    // Keep max 1000 items per user
    await this.prisma.$executeRaw`
      DELETE FROM feed_items
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at DESC
          ) as rn FROM feed_items
        ) ranked WHERE rn > 1000
      )
    `;
  }

  // 9. Reconcile counters (weekly Sunday 5 AM)
  @Cron('0 5 * * 0')
  async reconcileCounters() {
    // Fix post like/comment counts
    const posts = await this.prisma.post.findMany({ where: { deletedAt: null } });
    for (const post of posts) {
      const [likes, comments] = await Promise.all([
        this.prisma.like.count({ where: { postId: post.id } }),
        this.prisma.comment.count({ where: { postId: post.id } }),
      ]);
      await this.prisma.post.update({
        where: { id: post.id },
        data: { likeCount: likes, commentCount: comments },
      });
    }
    // Similar for User follower/following counts, Course counters, etc.
  }
}
```

---

## Step 11: Controllers

All admin routes require `@Roles('ADMIN')`:

| Method  | Path                                   | Description              |
| ------- | -------------------------------------- | ------------------------ |
| GET     | /api/admin/dashboard                   | Platform dashboard stats |
| GET     | /api/admin/users                       | List users               |
| PATCH   | /api/admin/users/:id/status            | Suspend/activate         |
| GET     | /api/admin/instructor-applications     | Pending applications     |
| PATCH   | /api/admin/instructor-applications/:id | Approve/reject           |
| GET     | /api/admin/courses/pending             | Pending course reviews   |
| PATCH   | /api/admin/courses/:id/review          | Approve/reject course    |
| GET     | /api/admin/reports                     | Moderation reports       |
| PATCH   | /api/admin/reports/:id                 | Take action              |
| GET     | /api/admin/withdrawals                 | Pending withdrawals      |
| PATCH   | /api/admin/withdrawals/:id             | Process withdrawal       |
| CRUD    | /api/admin/categories                  | Category management      |
| CRUD    | /api/admin/tags                        | Tag management           |
| CRUD    | /api/admin/commission-tiers            | Commission tiers         |
| GET/PUT | /api/admin/settings                    | Platform settings        |
| GET     | /api/admin/analytics                   | Analytics data           |

---

## Step 12: Verify

### Checklist

- [ ] Admin dashboard returns correct stats
- [ ] User management: list, filter, suspend/activate
- [ ] Instructor application approve → role change + profile creation
- [ ] Course review approve → status PUBLISHED + publishedAt set
- [ ] Report review works (action taken / dismissed)
- [ ] Withdrawal processing works
- [ ] Category/Tag CRUD works
- [ ] Bull queues process jobs (email, notification, feed)
- [ ] Cron: order expiry runs every minute
- [ ] Cron: view count sync from Redis to DB
- [ ] Cron: earnings release after 7 days
- [ ] Cron: analytics snapshot computed daily
- [ ] Cron: expired tokens cleaned up
- [ ] Cron: recommendation matrix computed nightly
- [ ] Cron: feed items cleaned up weekly
- [ ] Cron: counters reconciled weekly
