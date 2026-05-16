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
    ├── update-notification-preferences.dto.ts
    └── query-users.dto.ts
```

---

## Step 2: Users DTOs

### 2.1 `dto/update-profile.dto.ts`

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

### 2.2 `dto/update-notification-preferences.dto.ts`

```typescript
import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    example: {
      FOLLOW: { inApp: true, email: true },
      POST_LIKE: { inApp: true, email: false },
      NEW_MESSAGE: { inApp: true, email: false },
    },
  })
  @IsObject()
  preferences: Record<string, { inApp: boolean; email: boolean }>;
}
```

---

## Step 3: Users Service

### 3.1 `users.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

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

  async getPublicProfile(userId: string) {
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
          select: { headline: true, expertise: true, totalStudents: true, totalCourses: true },
        },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, fullName: true, avatarUrl: true, bio: true },
    });
  }

  async updateNotificationPreferences(userId: string, preferences: Record<string, unknown>) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: preferences },
    });
  }

  // ==================== FOLLOW SYSTEM ====================
  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

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

    return { message: 'FOLLOWED' };
  }

  async unfollow(followerId: string, followingId: string) {
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

  async getFollowers(userId: string, pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, fullName: true, avatarUrl: true } } },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    return createPaginatedResult(
      data.map((f) => f.follower),
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async getFollowing(userId: string, pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, fullName: true, avatarUrl: true } } },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return createPaginatedResult(
      data.map((f) => f.following),
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }
}
```

---

## Step 4: Users Controller

### 4.1 `users.controller.ts`

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('me/notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.sub, dto.preferences);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public user profile' })
  async getPublicProfile(@Param('id', ParseCuidPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a user' })
  async follow(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.usersService.follow(user.sub, id);
  }

  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  async unfollow(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.usersService.unfollow(user.sub, id);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Get followers list' })
  async getFollowers(@Param('id', ParseCuidPipe) id: string, @Query() query: PaginationDto) {
    return this.usersService.getFollowers(id, query);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Get following list' })
  async getFollowing(@Param('id', ParseCuidPipe) id: string, @Query() query: PaginationDto) {
    return this.usersService.getFollowing(id, query);
  }
}
```

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
import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({ example: ['JavaScript', 'React', 'Node.js'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  expertise: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiPropertyOptional()
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
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInstructorProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  biography?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ example: [{ name: 'AWS', institution: 'Amazon', year: 2023 }] })
  @IsOptional()
  qualifications?: unknown;

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
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateApplicationDto } from './dto/create-application.dto';
import type { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';

@Injectable()
export class InstructorService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== APPLICATION ====================
  async submitApplication(userId: string, dto: CreateApplicationDto) {
    // Check if already instructor
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'INSTRUCTOR') {
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
      include: { user: { select: { fullName: true, email: true, avatarUrl: true } } },
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
    const [profile, recentOrders, courseCount] = await Promise.all([
      this.prisma.instructorProfile.findUnique({ where: { userId } }),
      this.prisma.earning.findMany({
        where: { instructorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { orderItem: { select: { title: true, price: true } } },
      }),
      this.prisma.course.count({ where: { instructorId: userId, deletedAt: null } }),
    ]);

    return {
      totalStudents: profile?.totalStudents || 0,
      totalCourses: courseCount,
      totalRevenue: profile?.totalRevenue || 0,
      recentEarnings: recentOrders,
    };
  }
}
```

---

## Step 8: Instructor Controller

### 8.1 `instructor.controller.ts`

```typescript
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstructorService } from './instructor.service';
import { CurrentUser, Roles } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';

@Controller('instructor')
@ApiTags('Instructor')
export class InstructorController {
  constructor(private readonly instructorService: InstructorService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Submit instructor application' })
  async submitApplication(@CurrentUser() user: JwtPayload, @Body() dto: CreateApplicationDto) {
    return this.instructorService.submitApplication(user.sub, dto);
  }

  @Get('application-status')
  @ApiOperation({ summary: 'Check application status' })
  async getApplicationStatus(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getApplicationStatus(user.sub);
  }

  @Get('profile')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get instructor profile' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getProfile(user.sub);
  }

  @Patch('profile')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Update instructor profile' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateInstructorProfileDto) {
    return this.instructorService.updateProfile(user.sub, dto);
  }

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

- [ ] GET /api/users/me — returns current user
- [ ] PATCH /api/users/me — updates profile
- [ ] GET /api/users/:id — returns public profile
- [ ] POST /api/users/:id/follow — follow user (updates counters)
- [ ] DELETE /api/users/:id/follow — unfollow user
- [ ] GET /api/users/:id/followers — paginated followers list
- [ ] GET /api/users/:id/following — paginated following list
- [ ] POST /api/instructor/apply — submits application
- [ ] GET /api/instructor/application-status — returns applications
- [ ] GET /api/instructor/profile — returns instructor profile (INSTRUCTOR only)
- [ ] PATCH /api/instructor/profile — updates instructor profile
- [ ] GET /api/instructor/dashboard — returns dashboard stats
- [ ] Follow/unfollow uses Prisma transaction for counter consistency
