# Phase 5.5 — USERS & INSTRUCTOR MODULE

> Implement User profile, Follow system, Instructor profile & applications.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`

---

## Mục lục

- [Step 1: Users Module Structure](#step-1-users-module-structure)
- [Step 2: Users DTOs](#step-2-users-dtos)
- [Step 3: Users Service](#step-3-users-service)
- [Step 4: Users Controller](#step-4-users-controller)
- [Step 5: Instructor Module Structure](#step-5-instructor-module-structure)
- [Step 6: Instructor DTOs](#step-6-instructor-dtos)
- [Step 7: Instructor Service](#step-7-instructor-service)
- [Step 8: Instructor Controller](#step-8-instructor-controller)
- [Step 9: Register Modules](#step-9-register-modules)
- [Step 10: Verify](#step-10-verify)

---

## Step 1: Users Module Structure

```
src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
└── dto/
    ├── update-profile.dto.ts
    └── update-notification-preferences.dto.ts
```

---

## Step 2: Users DTOs

### 2.1 `dto/update-profile.dto.ts`

```typescript
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'Sinh viên CNTT...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

### 2.2 `dto/update-notification-preferences.dto.ts`

```typescript
import { IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class NotificationChannel {
  @IsBoolean()
  inApp: boolean;

  @IsBoolean()
  email: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    example: {
      POST_LIKED: { inApp: true, email: false },
      NEW_FOLLOWER: { inApp: true, email: false },
      ORDER_COMPLETED: { inApp: true, email: true },
      COURSE_APPROVED: { inApp: true, email: true },
    },
  })
  @IsObject()
  preferences: Record<string, NotificationChannel>;
}
```

---

## Step 3: Users Service

### 3.1 `users.service.ts`

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  bio: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        status: true,
        followerCount: true,
        followingCount: true,
        notificationPreferences: true,
        createdAt: true,
        instructorProfile: true,
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return user;
  }

  async getPublicProfile(userId: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        followerCount: true,
        followingCount: true,
        createdAt: true,
        instructorProfile: {
          select: {
            headline: true,
            expertise: true,
            totalStudents: true,
            totalCourses: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    // Check if current user is following this user
    let isFollowing: boolean | null = null;
    if (currentUserId && currentUserId !== userId) {
      isFollowing = await this.isFollowing(currentUserId, userId);
    }

    return { ...user, isFollowing };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, fullName: true, avatarUrl: true, bio: true },
    });
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Record<string, { inApp: boolean; email: boolean }>,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: preferences },
      select: { id: true, notificationPreferences: true },
    });
  }

  // ==================== FOLLOW SYSTEM ====================

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException({ code: 'CANNOT_FOLLOW_SELF' });
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId, deletedAt: null },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    }

    try {
      await this.prisma.$transaction([
        this.prisma.follow.create({
          data: { followerId, followingId },
        }),
        this.prisma.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        }),
        this.prisma.user.update({
          where: { id: followingId },
          data: { followerCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({ code: 'ALREADY_FOLLOWING' });
      }
      throw error;
    }

    return { message: 'FOLLOWED' };
  }

  async unfollow(followerId: string, followingId: string) {
    // Verify follow relationship exists
    const existingFollow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (!existingFollow) {
      throw new NotFoundException({ code: 'NOT_FOLLOWING' });
    }

    await this.prisma.$transaction([
      this.prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      }),
      this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      }),
      this.prisma.user.update({
        where: { id: followingId },
        data: { followerCount: { decrement: 1 } },
      }),
    ]);

    return { message: 'UNFOLLOWED' };
  }

  async getFollowers(
    userId: string,
    pagination: PaginationDto,
    currentUserId?: string,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: { select: PUBLIC_USER_SELECT },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    const followers = data.map((f) => f.follower);

    // Enrich with isFollowing status if current user is logged in
    const enriched = await this.enrichWithFollowStatus(followers, currentUserId);

    return createPaginatedResult(enriched, total, pagination.page, pagination.limit);
  }

  async getFollowing(
    userId: string,
    pagination: PaginationDto,
    currentUserId?: string,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: { select: PUBLIC_USER_SELECT },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    const followings = data.map((f) => f.following);

    const enriched = await this.enrichWithFollowStatus(followings, currentUserId);

    return createPaginatedResult(enriched, total, pagination.page, pagination.limit);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }

  // ==================== PRIVATE HELPERS ====================

  private async enrichWithFollowStatus<
    T extends { id: string },
  >(users: T[], currentUserId?: string): Promise<(T & { isFollowing: boolean | null })[]> {
    if (!currentUserId) {
      return users.map((u) => ({ ...u, isFollowing: null }));
    }

    const followRecords = await this.prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: users.map((u) => u.id) },
      },
      select: { followingId: true },
    });

    const followingSet = new Set(followRecords.map((f) => f.followingId));

    return users.map((u) => ({
      ...u,
      isFollowing: u.id === currentUserId ? null : followingSet.has(u.id),
    }));
  }
}
```

---

## Step 4: Users Controller

### 4.1 `users.controller.ts`

> **Lưu ý:** DTOs phải dùng value imports (không phải `import type`) vì `ValidationPipe`
> cần runtime class reference (`emitDecoratorMetadata`). Xem pattern ở `auth.controller.ts`.

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// Value imports for DTOs — ValidationPipe needs runtime class reference
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProfileDto } from './dto/update-profile.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Put('me/notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.sub, dto.preferences);
  }

  // ==================== PUBLIC ENDPOINTS ====================
  // Note: @Public() makes these accessible without JWT.
  // CurrentUser returns undefined for unauthenticated requests.

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get public user profile' })
  async getPublicProfile(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usersService.getPublicProfile(id, user?.sub);
  }

  // ==================== FOLLOW SYSTEM (Authenticated) ====================

  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a user' })
  async follow(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.usersService.follow(user.sub, id);
  }

  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  async unfollow(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.usersService.unfollow(user.sub, id);
  }

  // ==================== PUBLIC LISTS ====================

  @Public()
  @Get(':id/followers')
  @ApiOperation({ summary: 'Get followers list' })
  async getFollowers(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: PaginationDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usersService.getFollowers(id, query, user?.sub);
  }

  @Public()
  @Get(':id/following')
  @ApiOperation({ summary: 'Get following list' })
  async getFollowing(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: PaginationDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usersService.getFollowing(id, query, user?.sub);
  }
}
```

> **Note về Avatar upload:** Endpoint `POST /api/users/me/avatar` (multipart upload → Cloudinary)
> sẽ được implement trong Phase Media module, vì cần Cloudinary service dependency.

---

## Step 5: Instructor Module Structure

```
src/modules/instructor/
├── instructor.module.ts
├── instructor.controller.ts
├── instructor.service.ts
└── dto/
    ├── create-application.dto.ts
    └── update-instructor-profile.dto.ts
```

---

## Step 6: Instructor DTOs

### 6.1 `dto/create-application.dto.ts`

```typescript
import { IsArray, IsOptional, IsString, ArrayMinSize, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({ example: ['JavaScript', 'React', 'Node.js'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  expertise: string[];

  @ApiPropertyOptional({ example: '5 năm kinh nghiệm phát triển web...' })
  @IsOptional()
  @IsString()
  @MinLength(50)
  experience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificateUrls?: string[];
}
```

### 6.2 `dto/update-instructor-profile.dto.ts`

```typescript
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class QualificationItem {
  @IsString()
  name: string;

  @IsString()
  institution: string;

  @IsOptional()
  @IsString()
  year?: string;
}

export class UpdateInstructorProfileDto {
  @ApiPropertyOptional({ example: 'Senior React Developer' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  biography?: string;

  @ApiPropertyOptional({ example: ['React', 'Node.js', 'TypeScript'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ example: [{ name: 'AWS', institution: 'Amazon', year: '2023' }] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualificationItem)
  qualifications?: QualificationItem[];

  @ApiPropertyOptional({ example: { github: 'https://github.com/user', linkedin: '' } })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
```

---

## Step 7: Instructor Service

### 7.1 `instructor.service.ts`

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateApplicationDto } from './dto/create-application.dto';
import type { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';

@Injectable()
export class InstructorService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== APPLICATION ====================

  async submitApplication(userId: string, dto: CreateApplicationDto) {
    // Check if already instructor
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    if (user.role === 'INSTRUCTOR') {
      throw new BadRequestException({ code: 'ALREADY_INSTRUCTOR' });
    }

    // Check pending application
    const pending = await this.prisma.instructorApplication.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      throw new BadRequestException({ code: 'APPLICATION_ALREADY_PENDING' });
    }

    return this.prisma.instructorApplication.create({
      data: { userId, ...dto },
    });
  }

  async getApplicationStatus(userId: string) {
    return this.prisma.instructorApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // ==================== PROFILE ====================

  async getProfile(userId: string) {
    const profile = await this.prisma.instructorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { fullName: true, email: true, avatarUrl: true },
        },
      },
    });
    if (!profile) throw new NotFoundException({ code: 'INSTRUCTOR_PROFILE_NOT_FOUND' });
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateInstructorProfileDto) {
    return this.prisma.instructorProfile.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  // ==================== DASHBOARD ====================

  async getDashboard(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [profile, courseCount, availableBalance, pendingBalance, recentEarnings] =
      await Promise.all([
        this.prisma.instructorProfile.findUnique({
          where: { userId },
          select: { totalStudents: true, totalCourses: true, totalRevenue: true },
        }),
        this.prisma.course.count({
          where: { instructorId: userId, deletedAt: null },
        }),
        // Available balance
        this.prisma.earning.aggregate({
          where: { instructorId: userId, status: 'AVAILABLE' },
          _sum: { netAmount: true },
        }),
        // Pending balance
        this.prisma.earning.aggregate({
          where: { instructorId: userId, status: 'PENDING' },
          _sum: { netAmount: true },
        }),
        // Recent earnings (last 30 days)
        this.prisma.earning.findMany({
          where: {
            instructorId: userId,
            createdAt: { gte: thirtyDaysAgo },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            orderItem: { select: { title: true, price: true } },
          },
        }),
      ]);

    // Course-level stats
    const courseStats = await this.prisma.course.findMany({
      where: { instructorId: userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        totalStudents: true,
        avgRating: true,
      },
      orderBy: { totalStudents: 'desc' },
      take: 10,
    });

    return {
      overview: {
        totalRevenue: profile?.totalRevenue ?? 0,
        totalStudents: profile?.totalStudents ?? 0,
        totalCourses: courseCount,
        availableBalance: availableBalance._sum.netAmount ?? 0,
        pendingBalance: pendingBalance._sum.netAmount ?? 0,
      },
      recentEarnings,
      courseStats,
    };
  }
}
```

---

## Step 8: Instructor Controller

### 8.1 `instructor.controller.ts`

> **Lưu ý:** Phải import `UseGuards` và `RolesGuard` để `@Roles()` có tác dụng.
> DTOs phải value imports (không `import type`).

```typescript
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstructorService } from './instructor.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// Value imports for DTOs — ValidationPipe needs runtime class reference
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateApplicationDto } from './dto/create-application.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';

@Controller('instructor')
@ApiTags('Instructor')
@UseGuards(RolesGuard)
export class InstructorController {
  constructor(private readonly instructorService: InstructorService) {}

  // ==================== APPLICATION (Student only) ====================

  @Post('applications')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit instructor application' })
  async submitApplication(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.instructorService.submitApplication(user.sub, dto);
  }

  @Get('applications/me')
  @ApiOperation({ summary: 'Check application status' })
  async getApplicationStatus(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getApplicationStatus(user.sub);
  }

  // ==================== PROFILE (Instructor only) ====================

  @Get('profile')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get instructor profile' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getProfile(user.sub);
  }

  @Patch('profile')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Update instructor profile' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateInstructorProfileDto,
  ) {
    return this.instructorService.updateProfile(user.sub, dto);
  }

  // ==================== DASHBOARD (Instructor only) ====================

  @Get('dashboard')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get instructor dashboard stats' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getDashboard(user.sub);
  }
}
```

---

## Step 9: Register Modules

### 9.1 `users.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### 9.2 `instructor.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';

@Module({
  controllers: [InstructorController],
  providers: [InstructorService],
  exports: [InstructorService],
})
export class InstructorModule {}
```

### 9.3 Thêm vào `app.module.ts`

```typescript
import { UsersModule } from './modules/users/users.module';
import { InstructorModule } from './modules/instructor/instructor.module';

@Module({
  imports: [
    // ...existing
    AuthModule,
    UsersModule,
    InstructorModule,
  ],
})
```

---

## Step 10: Verify

### Checklist

**Users Module:**

- [ ] GET /api/users/me — returns current user profile (authenticated)
- [ ] PATCH /api/users/me — updates profile fields
- [ ] PUT /api/users/me/notification-preferences — updates notification settings
- [ ] GET /api/users/:id — returns public profile with `isFollowing` field (@Public)
- [ ] POST /api/users/:id/follow — follow user, handles P2002 → 409 ALREADY_FOLLOWING
- [ ] DELETE /api/users/:id/follow — unfollow user, 404 if NOT_FOLLOWING
- [ ] GET /api/users/:id/followers — paginated list with `isFollowing` per item (@Public)
- [ ] GET /api/users/:id/following — paginated list with `isFollowing` per item (@Public)
- [ ] Follow/unfollow uses Prisma transaction for counter consistency
- [ ] Cannot follow self → 400 CANNOT_FOLLOW_SELF

**Instructor Module:**

- [ ] POST /api/instructor/applications — submit application (STUDENT only)
- [ ] GET /api/instructor/applications/me — returns application history
- [ ] GET /api/instructor/profile — returns instructor profile (INSTRUCTOR only)
- [ ] PATCH /api/instructor/profile — upsert instructor profile (INSTRUCTOR only)
- [ ] GET /api/instructor/dashboard — returns overview, earnings, courseStats (INSTRUCTOR only)
- [ ] @UseGuards(RolesGuard) applied on controller class
- [ ] Already instructor → 400 ALREADY_INSTRUCTOR
- [ ] Pending application exists → 400 APPLICATION_ALREADY_PENDING
