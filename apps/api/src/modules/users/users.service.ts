import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { QueueService } from '@/modules/jobs/queue.service';
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  // ==================== SEARCH ====================

  async searchUsers(query: string) {
    if (!query || query.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        fullName: { contains: query, mode: 'insensitive' },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: PUBLIC_USER_SELECT,
      take: 20,
      orderBy: { fullName: 'asc' },
    });
  }

  // ==================== PROFILE ====================

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
    preferences: Record<string, { inApp: boolean; email?: boolean }>,
  ) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: preferences },
      select: { id: true, notificationPreferences: true },
    });

    // Invalidate cached preferences
    await this.redis.del(`notif_prefs:${userId}`);

    return result;
  }

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new BadRequestException({ code: 'INVALID_CREDENTIALS' });
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException({ code: 'INVALID_CURRENT_PASSWORD' });
    }

    const hash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    return { message: 'PASSWORD_CHANGED' };
  }

  // ==================== FOLLOW SYSTEM ====================

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException({ code: 'CANNOT_FOLLOW_SELF' });
    }

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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'ALREADY_FOLLOWING' });
      }
      throw error;
    }

    // Notify the followed user
    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
      select: { fullName: true },
    });
    this.queue.addNotification(followingId, 'FOLLOW', {
      userId: followerId,
      fullName: follower?.fullName,
    });

    return { message: 'FOLLOWED' };
  }

  async unfollow(followerId: string, followingId: string) {
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

  async getFollowers(userId: string, pagination: PaginationDto, currentUserId?: string) {
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: PUBLIC_USER_SELECT } },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    const users = data.map((f) => f.follower);
    const enriched = await this.enrichWithFollowStatus(users, currentUserId);

    return createPaginatedResult(enriched, total, pagination.page, pagination.limit);
  }

  async getFollowing(userId: string, pagination: PaginationDto, currentUserId?: string) {
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: PUBLIC_USER_SELECT } },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    const users = data.map((f) => f.following);
    const enriched = await this.enrichWithFollowStatus(users, currentUserId);

    return createPaginatedResult(enriched, total, pagination.page, pagination.limit);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }

  // ==================== PRIVATE HELPERS ====================

  private async enrichWithFollowStatus<T extends { id: string }>(
    users: T[],
    currentUserId?: string,
  ): Promise<(T & { isFollowing: boolean | null })[]> {
    if (!currentUserId || users.length === 0) {
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
