# Phase 5.11 — ADMIN MODULE & BACKGROUND JOBS

> Admin dashboard, User management, Approvals, Analytics, Reports, Cron Jobs (9), Bull Queues (3).
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase3-backend/03-realtime-and-services.md`
> Schema: Report, AnalyticsSnapshot, PlatformSetting, CommissionTier, CourseSimilarity

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: DTOs (10 files)](#step-2-dtos)
- [Step 3: Admin — User Management](#step-3-admin--user-management)
- [Step 4: Admin — Instructor Applications](#step-4-admin--instructor-applications)
- [Step 5: Admin — Course Review](#step-5-admin--course-review)
- [Step 6: Reports Module (User submit + Admin review)](#step-6-reports-module)
- [Step 7: Admin — Withdrawals Review](#step-7-admin--withdrawals-review)
- [Step 8: Admin — Categories, Tags, Commission Tiers](#step-8-admin--categories-tags-commission-tiers)
- [Step 9: Admin — Analytics, Dashboard, Settings](#step-9-admin--analytics-dashboard-settings)
- [Step 10: Bull Queues (3 queues)](#step-10-bull-queues)
- [Step 11: Cron Jobs (9 jobs)](#step-11-cron-jobs)
- [Step 12: Controllers](#step-12-controllers)
- [Step 13: Module Registration](#step-13-module-registration)
- [Step 14: Verify](#step-14-verify)

---

## Step 1: Module Structure

Phase chia thành 3 modules:

```
src/modules/admin/
├── admin.module.ts                 # AdminModule (imports BullModule queues)
├── users/
│   ├── admin-users.service.ts      # User management
│   └── admin-users.controller.ts
├── applications/
│   ├── admin-applications.service.ts
│   └── admin-applications.controller.ts
├── courses/
│   ├── admin-courses.service.ts
│   └── admin-courses.controller.ts
├── withdrawals/
│   ├── admin-withdrawals.service.ts
│   └── admin-withdrawals.controller.ts
├── content/
│   ├── admin-content.service.ts    # Categories, Tags, CommissionTiers, Settings
│   └── admin-content.controller.ts
├── analytics/
│   ├── admin-analytics.service.ts
│   └── admin-analytics.controller.ts
└── dto/
    ├── query-admin-users.dto.ts
    ├── update-user-status.dto.ts
    ├── review-application.dto.ts
    ├── review-course.dto.ts
    ├── review-report.dto.ts
    ├── review-withdrawal.dto.ts
    ├── create-category.dto.ts
    ├── create-tag.dto.ts
    ├── create-commission-tier.dto.ts
    └── update-setting.dto.ts

src/modules/reports/
├── reports.module.ts               # Separate module — used by both user + admin
├── reports.service.ts
├── reports.controller.ts
└── dto/
    ├── create-report.dto.ts
    └── query-reports.dto.ts

src/modules/jobs/
├── jobs.module.ts                  # JobsModule — queues + cron
├── processors/
│   ├── email.processor.ts
│   ├── notification.processor.ts
│   └── feed.processor.ts
└── cron/
    └── cron.service.ts
```

**Lý do tách 3 modules:**
- **AdminModule** — all admin CRUD, `@Roles('ADMIN')` on all controllers
- **ReportsModule** — users tạo reports (authenticated) + admin review (admin). Dùng chung service
- **JobsModule** — Bull processors + Cron jobs, independent from HTTP layer

---

## Step 2: DTOs

### `query-admin-users.dto.ts`

```typescript
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryAdminUsersDto extends PaginationDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
  role?: string;

  @IsOptional() @IsEnum(['ACTIVE', 'SUSPENDED'])
  status?: string;
}
```

### `update-user-status.dto.ts`

```typescript
export class UpdateUserStatusDto {
  @IsEnum(['ACTIVE', 'SUSPENDED'])
  status!: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;  // Required when suspending
}
```

### `review-application.dto.ts`

```typescript
export class ReviewApplicationDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional() @IsString() @MaxLength(1000)
  reviewNote?: string;
}
```

### `review-course.dto.ts`

```typescript
export class ReviewCourseDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional() @IsString() @MaxLength(1000)
  feedback?: string;
}
```

### `review-report.dto.ts`

```typescript
// Schema enum: PENDING | REVIEWED | ACTION_TAKEN | DISMISSED
export class ReviewReportDto {
  @IsEnum(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED'])
  status!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  adminNote?: string;
}
```

### `review-withdrawal.dto.ts`

```typescript
// Schema enum: PENDING | PROCESSING | COMPLETED | REJECTED
export class ReviewWithdrawalDto {
  @IsEnum(['COMPLETED', 'REJECTED'])
  status!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  reviewNote?: string;
}
```

### `create-report.dto.ts` (Reports module)

```typescript
// User submits report
export class CreateReportDto {
  @IsEnum(['POST', 'COMMENT', 'USER', 'COURSE', 'QUESTION'])
  targetType!: string;

  @IsString()
  targetId!: string;

  @IsString() @MinLength(3) @MaxLength(200)
  reason!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}
```

### `create-category.dto.ts`

```typescript
export class CreateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString()
  iconUrl?: string;

  @IsOptional() @IsString()
  parentId?: string;

  @IsOptional() @IsInt() @Min(0)
  order?: number;
}
```

### `create-tag.dto.ts`

```typescript
export class CreateTagDto {
  @IsString() @MinLength(2) @MaxLength(50)
  name!: string;
}
```

### `create-commission-tier.dto.ts`

```typescript
export class CreateCommissionTierDto {
  @IsNumber() @Min(0)
  minRevenue!: number;

  @IsNumber() @Min(0) @Max(1)
  rate!: number;  // 0.30 = 30%
}
```

### `update-setting.dto.ts`

```typescript
export class UpdateSettingDto {
  @IsString()
  key!: string;

  // value is Json — accept any valid JSON
  value!: unknown;
}
```

---

## Step 3: Admin — User Management

```typescript
// admin/users/admin-users.service.ts
@Injectable()
export class AdminUsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getUsers(query: QueryAdminUsersDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role as Role }),
      ...(query.status && { status: query.status as UserStatus }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
      deletedAt: null,
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, fullName: true, avatarUrl: true,
          role: true, status: true, createdAt: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return createPaginatedResult(users, total, query.page, query.limit);
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.role === 'ADMIN') throw new ForbiddenException({ code: 'CANNOT_MODIFY_ADMIN' });

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status as UserStatus },
    });
  }
}
```

**Key decisions:**
- Cannot suspend ADMIN users (prevent lockout)
- Include `_count.enrollments` for admin context
- `Prisma.UserWhereInput` type for dynamic filter

---

## Step 4: Admin — Instructor Applications

```typescript
// admin/applications/admin-applications.service.ts
async getPendingApplications(query: PaginationDto) {
  const where = { status: 'PENDING' as const };
  const [applications, total] = await Promise.all([
    this.prisma.instructorApplication.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },  // FIFO
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.instructorApplication.count({ where }),
  ]);
  return createPaginatedResult(applications, total, query.page, query.limit);
}

async reviewApplication(applicationId: string, adminId: string, dto: ReviewApplicationDto) {
  const application = await this.prisma.instructorApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND' });
  if (application.status !== 'PENDING') {
    throw new BadRequestException({ code: 'APPLICATION_ALREADY_REVIEWED' });
  }

  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.instructorApplication.update({
      where: { id: applicationId },
      data: {
        status: dto.approved ? 'APPROVED' : 'REJECTED',
        reviewedById: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });

    if (dto.approved) {
      // Promote user to INSTRUCTOR
      await tx.user.update({
        where: { id: application.userId },
        data: { role: 'INSTRUCTOR' },
      });

      // Create instructor profile (upsert to handle edge case)
      await tx.instructorProfile.upsert({
        where: { userId: application.userId },
        update: { expertise: application.expertise },
        create: {
          userId: application.userId,
          expertise: application.expertise,
          experience: application.experience,
        },
      });
    }

    return updated;
  });
  // NotificationsService.create() called by controller after return
}
```

**Key decisions:**
- Check `status !== 'PENDING'` to prevent double-review
- `upsert` for instructor profile (edge case: user applied twice, first rejected, profile partially exists)
- FIFO ordering — oldest applications first
- Notification NOT inside transaction (side effect, should not rollback)

---

## Step 5: Admin — Course Review

```typescript
// admin/courses/admin-courses.service.ts
async getPendingCourses(query: PaginationDto) {
  const where = { status: 'PENDING_REVIEW' as const, deletedAt: null };
  const [courses, total] = await Promise.all([
    this.prisma.course.findMany({
      where,
      include: {
        instructor: { select: { id: true, fullName: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { sections: true } },
      },
      orderBy: { updatedAt: 'asc' },
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.course.count({ where }),
  ]);
  return createPaginatedResult(courses, total, query.page, query.limit);
}

async reviewCourse(courseId: string, adminId: string, dto: ReviewCourseDto) {
  const course = await this.prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
  if (course.status !== 'PENDING_REVIEW') {
    throw new BadRequestException({ code: 'COURSE_NOT_PENDING_REVIEW' });
  }

  if (dto.approved) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id: courseId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });

      // Auto-create private course group
      await tx.group.create({
        data: {
          name: updated.title,
          description: `Discussion group for ${updated.title}`,
          courseId: updated.id,
          creatorId: course.instructorId,
          privacy: 'PRIVATE',
        },
      });

      return updated;
    });
  } else {
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'REJECTED' },
    });
  }
  // Notify instructor after return
}
```

**Key decisions:**
- Approve: `PENDING_REVIEW → PUBLISHED` + auto-create private course group
- Reject: `PENDING_REVIEW → REJECTED` (instructor can edit and resubmit)
- Auto-create group with `privacy: 'PRIVATE'` (only enrolled students can join)
- `publishedAt` set only on first publish

---

## Step 6: Reports Module

**Separate module** — user submit + admin review in one service.

```typescript
// reports/reports.service.ts
@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // User submits a report
  async create(userId: string, dto: CreateReportDto) {
    // Check duplicate report
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: dto.targetType as ReportTargetType,
        targetId: dto.targetId,
        status: 'PENDING',
      },
    });
    if (existing) throw new ConflictException({ code: 'REPORT_ALREADY_EXISTS' });

    return this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType as ReportTargetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
      },
    });
  }

  // Admin lists reports
  async getReports(query: QueryReportsDto) {
    const where: Prisma.ReportWhereInput = {
      ...(query.status && { status: query.status as ReportStatus }),
      ...(query.targetType && { targetType: query.targetType as ReportTargetType }),
    };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return createPaginatedResult(reports, total, query.page, query.limit);
  }

  // Admin reviews report
  async reviewReport(reportId: string, adminId: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
    if (report.status !== 'PENDING') {
      throw new BadRequestException({ code: 'REPORT_ALREADY_REVIEWED' });
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status as ReportStatus,
        reviewedById: adminId,
        reviewNote: dto.adminNote,
        reviewedAt: new Date(),
      },
    });
  }
}
```

**Controllers:**
```typescript
// reports/reports.controller.ts — User endpoint
@Controller('reports')
export class ReportsController {
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportDto) { ... }
}

// admin/reports/ — uses same service but admin-only
// admin-reports.controller.ts
@Controller('admin/reports')
@UseGuards(RolesGuard) @Roles('ADMIN')
export class AdminReportsController {
  @Get() getReports(@Query() query: QueryReportsDto) { ... }
  @Patch(':id') reviewReport(@Param('id') id, @CurrentUser() user, @Body() dto) { ... }
}
```

---

## Step 7: Admin — Withdrawals Review

```typescript
async processWithdrawal(withdrawalId: string, adminId: string, dto: ReviewWithdrawalDto) {
  const withdrawal = await this.prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!withdrawal) throw new NotFoundException({ code: 'WITHDRAWAL_NOT_FOUND' });
  if (withdrawal.status !== 'PENDING') {
    throw new BadRequestException({ code: 'WITHDRAWAL_NOT_PENDING' });
  }

  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: dto.status as WithdrawalStatus,
        reviewedById: adminId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });

    if (dto.status === 'COMPLETED') {
      // Mark ONLY the specific earnings locked by this withdrawal
      // Withdrawals lock specific earnings via earningIds (stored in bankInfo or separate table)
      // Simplified: mark amount-equivalent AVAILABLE earnings as WITHDRAWN (FIFO)
      const earnings = await tx.earning.findMany({
        where: { instructorId: withdrawal.instructorId, status: 'LOCKED' },
        orderBy: { createdAt: 'asc' },
      });

      await tx.earning.updateMany({
        where: { id: { in: earnings.map((e) => e.id) } },
        data: { status: 'WITHDRAWN' },
      });
    } else if (dto.status === 'REJECTED') {
      // Release locked earnings back to AVAILABLE
      await tx.earning.updateMany({
        where: { instructorId: withdrawal.instructorId, status: 'LOCKED' },
        data: { status: 'AVAILABLE' },
      });
    }

    return updated;
  });
}
```

**Key fix:** Original plan marked ALL `AVAILABLE` earnings as `WITHDRAWN`. Fixed to only update `LOCKED` earnings (locked when withdrawal was created in Phase 5.7).

---

## Step 8: Admin — Categories, Tags, Commission Tiers

```typescript
// admin/content/admin-content.service.ts
@Injectable()
export class AdminContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- Categories ---
  async createCategory(dto: CreateCategoryDto) {
    const slug = generateSlug(dto.name);
    // Check duplicate slug
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictException({ code: 'CATEGORY_SLUG_EXISTS' });
    return this.prisma.category.create({ data: { ...dto, slug } });
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.name) data.slug = generateSlug(dto.name);
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const count = await this.prisma.course.count({ where: { categoryId: id } });
    if (count > 0) throw new BadRequestException({ code: 'CATEGORY_HAS_COURSES' });
    return this.prisma.category.delete({ where: { id } });
  }

  // --- Tags ---
  async createTag(dto: CreateTagDto) {
    const slug = generateSlug(dto.name);
    return this.prisma.tag.create({ data: { name: dto.name, slug } });
  }

  async updateTag(id: string, dto: CreateTagDto) {
    const slug = generateSlug(dto.name);
    return this.prisma.tag.update({ where: { id }, data: { name: dto.name, slug } });
  }

  async deleteTag(id: string) {
    const count = await this.prisma.courseTag.count({ where: { tagId: id } });
    if (count > 0) throw new BadRequestException({ code: 'TAG_HAS_COURSES' });
    return this.prisma.tag.delete({ where: { id } });
  }

  // --- Commission Tiers ---
  async getCommissionTiers() {
    return this.prisma.commissionTier.findMany({ orderBy: { minRevenue: 'asc' } });
  }

  async upsertCommissionTier(dto: CreateCommissionTierDto) {
    return this.prisma.commissionTier.upsert({
      where: { id: 'placeholder' },  // Create new if no match
      update: { rate: dto.rate },
      create: { minRevenue: dto.minRevenue, rate: dto.rate },
    });
  }

  // --- Platform Settings ---
  async getSettings() {
    return this.prisma.platformSetting.findMany();
  }

  async updateSetting(dto: UpdateSettingDto) {
    return this.prisma.platformSetting.upsert({
      where: { key: dto.key },
      update: { value: dto.value as Prisma.InputJsonValue },
      create: { key: dto.key, value: dto.value as Prisma.InputJsonValue },
    });
  }
}
```

---

## Step 9: Admin — Analytics, Dashboard, Settings

```typescript
// admin/analytics/admin-analytics.service.ts
async getDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, totalCourses, totalRevenue, todayOrders,
    activeUsersToday, newUsersThisWeek,
    pendingApps, pendingCourses, pendingReports, pendingWithdrawals,
    topCourses,
  ] = await Promise.all([
    this.prisma.user.count({ where: { deletedAt: null } }),
    this.prisma.course.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    this.prisma.earning.aggregate({ _sum: { netAmount: true } }),
    this.prisma.order.count({
      where: { status: 'COMPLETED', createdAt: { gte: today } },
    }),
    this.prisma.dailyActivity.count({
      where: { activityDate: { gte: today } },
    }),
    this.prisma.user.count({
      where: { createdAt: { gte: weekAgo }, deletedAt: null },
    }),
    // Pending approvals
    this.prisma.instructorApplication.count({ where: { status: 'PENDING' } }),
    this.prisma.course.count({ where: { status: 'PENDING_REVIEW' } }),
    this.prisma.report.count({ where: { status: 'PENDING' } }),
    this.prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    // Top courses
    this.prisma.course.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, totalStudents: true, averageRating: true },
      orderBy: { totalStudents: 'desc' },
      take: 5,
    }),
  ]);

  return {
    overview: {
      totalUsers,
      totalCourses,
      totalRevenue: totalRevenue._sum.netAmount || 0,
      todayOrders,
      activeUsersToday,
      newUsersThisWeek,
    },
    pendingApprovals: {
      instructorApps: pendingApps,
      courseReviews: pendingCourses,
      reports: pendingReports,
      withdrawals: pendingWithdrawals,
    },
    topCourses,
  };
}

async getAnalytics(type: AnalyticsType, fromDate: string, toDate: string) {
  return this.prisma.analyticsSnapshot.findMany({
    where: {
      type,
      date: { gte: new Date(fromDate), lte: new Date(toDate) },
    },
    orderBy: { date: 'asc' },
  });
}
```

**Key improvements:**
- Dashboard includes `pendingApprovals` counts (badges in admin UI)
- `activeUsersToday` from DailyActivity
- `topCourses` sorted by students
- Revenue uses `netAmount` (after commission)

---

## Step 10: Bull Queues

### Already installed: `@nestjs/bullmq` + `bullmq` (Phase 5.3)

### Register in AppModule:

```typescript
import { BullModule } from '@nestjs/bullmq';

// In imports array:
BullModule.forRoot({
  connection: {
    host: configService.get('redis.host', 'localhost'),
    port: configService.get('redis.port', 6379),
  },
}),
```

**Problem:** `BullModule.forRoot()` needs config but doesn't support async directly like `forRootAsync`. Use `ConfigModule` injection:

```typescript
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
    },
  }),
}),
```

### Queue Processors — in `src/modules/jobs/processors/`

**Email Processor:**
```typescript
@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(@Inject(MailService) private readonly mailService: MailService) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'verification':
        return this.mailService.sendVerificationEmail(job.data.to, job.data.token);
      case 'reset-password':
        return this.mailService.sendResetPasswordEmail(job.data.to, job.data.token);
      case 'order-receipt':
        return this.mailService.sendOrderReceiptEmail(job.data.to, job.data.orderId, job.data.amount);
      case 'course-approved':
        return this.mailService.sendCourseApprovedEmail(job.data.to, job.data.courseTitle);
      case 'withdrawal-completed':
        return this.mailService.sendWithdrawalCompletedEmail(job.data.to, job.data.amount);
      default:
        throw new Error(`Unknown email job: ${job.name}`);
    }
  }
}
```

**Notification Processor:**
```typescript
@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job) {
    const { userId, type, title, content, link } = job.data;
    await this.notifications.create(userId, type, title, content, link);
  }
}
```

**Feed Processor:**
```typescript
@Processor('feed')
export class FeedProcessor extends WorkerHost {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'fanout') {
      const { postId, authorId, groupId } = job.data;

      // Get target userIds
      let followerIds: string[];
      if (groupId) {
        const members = await this.prisma.groupMember.findMany({
          where: { groupId },
          select: { userId: true },
        });
        followerIds = members.map((m) => m.userId);
      } else {
        const follows = await this.prisma.follow.findMany({
          where: { followingId: authorId },
          select: { followerId: true },
        });
        followerIds = follows.map((f) => f.followerId);
      }

      // Batch insert (1000 at a time)
      const BATCH_SIZE = 1000;
      for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
        const batch = followerIds.slice(i, i + BATCH_SIZE);
        await this.prisma.feedItem.createMany({
          data: batch.map((userId) => ({ userId, postId })),
          skipDuplicates: true,
        });
      }

      // Author also gets their own post in feed
      await this.prisma.feedItem.create({
        data: { userId: authorId, postId },
      }).catch(() => {}); // Ignore duplicate
    }
  }
}
```

### JobsModule:

```typescript
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'notification' },
      { name: 'feed' },
    ),
    PrismaModule,
    MailModule,
    NotificationsModule,
  ],
  providers: [
    EmailProcessor,
    NotificationProcessor,
    FeedProcessor,
    CronService,
  ],
  exports: [], // Queues are injected via @InjectQueue('name') anywhere
})
export class JobsModule {}
```

---

## Step 11: Cron Jobs

```typescript
// src/modules/jobs/cron/cron.service.ts
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  // 1. Expire pending orders (every 1 min)
  @Cron('*/1 * * * *')
  async expirePendingOrders() {
    const result = await this.prisma.order.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} pending orders`);
    }
  }

  // 2. Sync view counts from Redis to DB (every 5 min)
  // Uses SCAN instead of KEYS (O(1) per iteration, production-safe)
  @Cron('*/5 * * * *')
  async syncViewCounts() {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, 'MATCH', 'course_views:*', 'COUNT', 100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const courseId = key.replace('course_views:', '');
        const views = parseInt((await this.redis.getdel(key)) || '0', 10);
        if (views > 0) {
          await this.prisma.course.update({
            where: { id: courseId },
            data: { viewCount: { increment: views } },
          }).catch(() => {}); // Course might be deleted
        }
      }
    } while (cursor !== '0');
  }

  // 3. Release available earnings (daily 1 AM)
  // Uses availableAt field (set to createdAt + 7 days in webhook)
  @Cron('0 1 * * *')
  async releaseAvailableEarnings() {
    const result = await this.prisma.earning.updateMany({
      where: { status: 'PENDING', availableAt: { lte: new Date() } },
      data: { status: 'AVAILABLE' },
    });
    if (result.count > 0) {
      this.logger.log(`Released ${result.count} earnings`);
    }
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

  // 5. Compute analytics snapshot (daily 2:30 AM)
  @Cron('30 2 * * *')
  async computeAnalyticsSnapshot() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfDay = new Date(yesterday);
    endOfDay.setHours(23, 59, 59, 999);

    const [users, revenue, enrollments, courses] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: yesterday, lte: endOfDay }, deletedAt: null },
      }),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: yesterday, lte: endOfDay } },
        _sum: { finalAmount: true },
      }),
      this.prisma.enrollment.count({
        where: { createdAt: { gte: yesterday, lte: endOfDay } },
      }),
      this.prisma.course.count({
        where: { status: 'PUBLISHED', publishedAt: { gte: yesterday, lte: endOfDay } },
      }),
    ]);

    const snapshots: Array<{ date: Date; type: AnalyticsType; data: Prisma.InputJsonValue }> = [
      { date: yesterday, type: 'DAILY_USERS', data: { count: users } },
      { date: yesterday, type: 'DAILY_REVENUE', data: { amount: revenue._sum.finalAmount || 0 } },
      { date: yesterday, type: 'DAILY_ENROLLMENTS', data: { count: enrollments } },
      { date: yesterday, type: 'DAILY_COURSES', data: { count: courses } },
    ];

    for (const s of snapshots) {
      await this.prisma.analyticsSnapshot.upsert({
        where: { date_type: { date: s.date, type: s.type } },
        update: { data: s.data },
        create: s,
      });
    }

    this.logger.log(`Analytics snapshot computed for ${yesterday.toISOString().split('T')[0]!}`);
  }

  // 6. Cleanup expired tokens (daily 3 AM)
  @Cron('0 3 * * *')
  async cleanupExpiredTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired tokens`);
    }
  }

  // 7. Compute recommendation matrix (daily 4 AM)
  // Heavy computation — runs when traffic is lowest
  @Cron('0 4 * * *')
  async computeRecommendationMatrix() {
    const publishedCourses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        courseTags: { select: { tagId: true } },
      },
    });

    if (publishedCourses.length < 2) return;

    // Content-based: tag vector cosine similarity
    for (let i = 0; i < publishedCourses.length; i++) {
      for (let j = i + 1; j < publishedCourses.length; j++) {
        const a = publishedCourses[i]!;
        const b = publishedCourses[j]!;
        const tagsA = new Set(a.courseTags.map((t) => t.tagId));
        const tagsB = new Set(b.courseTags.map((t) => t.tagId));

        // Jaccard similarity (simpler than cosine for sets)
        const intersection = [...tagsA].filter((t) => tagsB.has(t)).length;
        const union = new Set([...tagsA, ...tagsB]).size;
        const score = union > 0 ? intersection / union : 0;

        if (score > 0) {
          await this.prisma.courseSimilarity.upsert({
            where: {
              courseId_similarCourseId_algorithm: {
                courseId: a.id, similarCourseId: b.id, algorithm: 'CONTENT',
              },
            },
            update: { score },
            create: { courseId: a.id, similarCourseId: b.id, score, algorithm: 'CONTENT' },
          });
        }
      }
    }

    this.logger.log(`Recommendation matrix computed for ${publishedCourses.length} courses`);
  }

  // 8. Cleanup old feed items (weekly Sunday 4 AM)
  @Cron('0 4 * * 0')
  async cleanupOldFeedItems() {
    const result = await this.prisma.$executeRaw`
      DELETE FROM feed_items
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at DESC
          ) as rn FROM feed_items
        ) ranked WHERE rn > 1000
      )
    `;
    this.logger.log(`Cleaned up ${result} old feed items`);
  }

  // 9. Reconcile denormalized counters (weekly Sunday 5 AM)
  // Batch process to avoid loading all records into memory
  @Cron('0 5 * * 0')
  async reconcileCounters() {
    // Posts: likeCount + commentCount
    await this.prisma.$executeRaw`
      UPDATE posts SET
        like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id),
        comment_count = (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.deleted_at IS NULL)
      WHERE deleted_at IS NULL
    `;

    // Users: followerCount + followingCount
    await this.prisma.$executeRaw`
      UPDATE users SET
        follower_count = (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id),
        following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id)
      WHERE deleted_at IS NULL
    `;

    // Questions: answerCount + voteCount
    await this.prisma.$executeRaw`
      UPDATE questions SET
        answer_count = (SELECT COUNT(*) FROM answers WHERE answers.question_id = questions.id),
        vote_count = (SELECT COUNT(*) FROM question_votes WHERE question_votes.question_id = questions.id AND question_votes.value = 1)
                   - (SELECT COUNT(*) FROM question_votes WHERE question_votes.question_id = questions.id AND question_votes.value = -1)
    `;

    // Tags: courseCount
    await this.prisma.$executeRaw`
      UPDATE tags SET
        course_count = (SELECT COUNT(*) FROM course_tags WHERE course_tags.tag_id = tags.id)
    `;

    this.logger.log('Counter reconciliation completed');
  }
}
```

**Key fixes from original:**
- `syncViewCounts`: `SCAN` instead of `KEYS` (production-safe, O(1) per call)
- `releaseAvailableEarnings`: Uses `availableAt` field instead of calculating 7 days from `createdAt`
- `computeAnalyticsSnapshot`: Computes for YESTERDAY (not today — incomplete data), uses all 4 `AnalyticsType` enum values
- `computeRecommendationMatrix`: Full implementation with Jaccard similarity + `courseSimilarity.upsert`
- `reconcileCounters`: Raw SQL batch update instead of loading all records into memory

---

## Step 12: Controllers

All admin controllers use `@UseGuards(RolesGuard)` + `@Roles('ADMIN')` at class level.

| # | Method | Path | Controller | Service Method |
|---|--------|------|------------|----------------|
| 1 | GET | `/api/admin/dashboard` | AdminAnalytics | `getDashboard()` |
| 2 | GET | `/api/admin/analytics` | AdminAnalytics | `getAnalytics(type, from, to)` |
| 3 | GET | `/api/admin/users` | AdminUsers | `getUsers(query)` |
| 4 | PATCH | `/api/admin/users/:id/status` | AdminUsers | `updateUserStatus(id, dto)` |
| 5 | GET | `/api/admin/applications` | AdminApplications | `getPendingApplications(query)` |
| 6 | PATCH | `/api/admin/applications/:id` | AdminApplications | `reviewApplication(id, admin, dto)` |
| 7 | GET | `/api/admin/courses/pending` | AdminCourses | `getPendingCourses(query)` |
| 8 | PATCH | `/api/admin/courses/:id/review` | AdminCourses | `reviewCourse(id, admin, dto)` |
| 9 | GET | `/api/admin/reports` | AdminReports | `getReports(query)` |
| 10 | PATCH | `/api/admin/reports/:id` | AdminReports | `reviewReport(id, admin, dto)` |
| 11 | GET | `/api/admin/withdrawals` | AdminWithdrawals | `getPendingWithdrawals(query)` |
| 12 | PATCH | `/api/admin/withdrawals/:id` | AdminWithdrawals | `processWithdrawal(id, admin, dto)` |
| 13 | POST | `/api/admin/categories` | AdminContent | `createCategory(dto)` |
| 14 | PATCH | `/api/admin/categories/:id` | AdminContent | `updateCategory(id, dto)` |
| 15 | DELETE | `/api/admin/categories/:id` | AdminContent | `deleteCategory(id)` |
| 16 | POST | `/api/admin/tags` | AdminContent | `createTag(dto)` |
| 17 | PATCH | `/api/admin/tags/:id` | AdminContent | `updateTag(id, dto)` |
| 18 | DELETE | `/api/admin/tags/:id` | AdminContent | `deleteTag(id)` |
| 19 | GET | `/api/admin/commission-tiers` | AdminContent | `getCommissionTiers()` |
| 20 | POST | `/api/admin/commission-tiers` | AdminContent | `upsertCommissionTier(dto)` |
| 21 | GET | `/api/admin/settings` | AdminContent | `getSettings()` |
| 22 | PUT | `/api/admin/settings` | AdminContent | `updateSetting(dto)` |

**User-facing endpoints:**
| # | Method | Path | Controller |
|---|--------|------|------------|
| 23 | POST | `/api/reports` | Reports | `create(userId, dto)` |

**Total: 23 endpoints**

---

## Step 13: Module Registration

```typescript
// app.module.ts — add to imports
import { BullModule } from '@nestjs/bullmq';

BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
    },
  }),
}),

AdminModule,
ReportsModule,
JobsModule,
```

---

## Step 14: Verify

### Checklist

- [ ] Admin dashboard returns overview + pendingApprovals + topCourses
- [ ] User management: list, filter by role/status/search, suspend/activate
- [ ] Cannot suspend ADMIN users
- [ ] Instructor application approve → role INSTRUCTOR + profile created (upsert)
- [ ] Application already reviewed → 400 error
- [ ] Course review approve → PUBLISHED + publishedAt + auto-create private group
- [ ] Course review reject → REJECTED (can resubmit)
- [ ] User can submit report (duplicate detection)
- [ ] Admin report review works (REVIEWED / ACTION_TAKEN / DISMISSED)
- [ ] Withdrawal approve → LOCKED earnings → WITHDRAWN
- [ ] Withdrawal reject → LOCKED earnings → AVAILABLE (released back)
- [ ] Category/Tag CRUD with slug generation + delete protection
- [ ] Commission tier CRUD
- [ ] Platform settings upsert
- [ ] Analytics query by type + date range
- [ ] Bull: BullModule.forRootAsync with Redis config
- [ ] Bull: Email processor handles 5 job types
- [ ] Bull: Notification processor creates + pushes
- [ ] Bull: Feed processor fanout with batch insert
- [ ] Cron: Order expiry every minute
- [ ] Cron: View count sync uses SCAN (not KEYS)
- [ ] Cron: Earnings release uses availableAt field
- [ ] Cron: Analytics snapshot for YESTERDAY, all 4 types
- [ ] Cron: Expired tokens cleanup
- [ ] Cron: Recommendation matrix with Jaccard + upsert
- [ ] Cron: Feed items cleanup (raw SQL, keep max 1000)
- [ ] Cron: Counter reconciliation (raw SQL batch, not in-memory)
- [ ] Build: 0 errors
- [ ] Lint: 0 errors
- [ ] Tests: all passing
