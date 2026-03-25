import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  follow: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockNotifications = { create: jest.fn().mockResolvedValue({}) };

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  fullName: 'Test User',
  avatarUrl: null,
  bio: 'Hello world',
  role: 'STUDENT',
  status: 'ACTIVE',
  followerCount: 10,
  followingCount: 5,
  notificationPreferences: null,
  createdAt: new Date('2024-01-01'),
  instructorProfile: null,
};

const MOCK_PUBLIC_USER = {
  id: 'user-1',
  fullName: 'Test User',
  avatarUrl: null,
  bio: 'Hello world',
  role: 'STUDENT',
  followerCount: 10,
  followingCount: 5,
  createdAt: new Date('2024-01-01'),
  instructorProfile: null,
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  // ==================== getMe ====================

  describe('getMe', () => {
    it('should return current user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);

      const result = await service.getMe('user-1');

      expect(result).toEqual(MOCK_USER);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          notificationPreferences: true,
          instructorProfile: true,
        }),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.getMe('nonexistent');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse();
        expect(response).toMatchObject({ code: 'USER_NOT_FOUND' });
      }
    });
  });

  // ==================== getPublicProfile ====================

  describe('getPublicProfile', () => {
    it('should return public profile with isFollowing null when not logged in', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);

      const result = await service.getPublicProfile('user-1');

      expect(result).toEqual({ ...MOCK_PUBLIC_USER, isFollowing: null });
    });

    it('should return public profile with isFollowing true when following', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: 'user-2',
        followingId: 'user-1',
      });

      const result = await service.getPublicProfile('user-1', 'user-2');

      expect(result.isFollowing).toBe(true);
    });

    it('should return public profile with isFollowing false when not following', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);
      mockPrisma.follow.findUnique.mockResolvedValue(null);

      const result = await service.getPublicProfile('user-1', 'user-2');

      expect(result.isFollowing).toBe(false);
    });

    it('should return isFollowing null when viewing own profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_PUBLIC_USER);

      const result = await service.getPublicProfile('user-1', 'user-1');

      expect(result.isFollowing).toBeNull();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.getPublicProfile('nonexistent');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse();
        expect(response).toMatchObject({ code: 'USER_NOT_FOUND' });
      }
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile', () => {
    it('should update and return updated fields', async () => {
      const updated = { id: 'user-1', fullName: 'New Name', avatarUrl: null, bio: 'New bio' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', {
        fullName: 'New Name',
        bio: 'New bio',
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { fullName: 'New Name', bio: 'New bio' },
        select: { id: true, fullName: true, avatarUrl: true, bio: true },
      });
    });
  });

  // ==================== updateNotificationPreferences ====================

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences', async () => {
      const prefs = { NEW_FOLLOWER: { inApp: true, email: false } };
      const updated = { id: 'user-1', notificationPreferences: prefs };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateNotificationPreferences('user-1', prefs);

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { notificationPreferences: prefs },
        select: { id: true, notificationPreferences: true },
      });
    });
  });

  // ==================== follow ====================

  describe('follow', () => {
    it('should follow a user and return FOLLOWED message', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.follow('user-1', 'user-2');

      expect(result).toEqual({ message: 'FOLLOWED' });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-2', deletedAt: null },
        select: { id: true },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when following self', async () => {
      try {
        await service.follow('user-1', 'user-1');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ code: 'CANNOT_FOLLOW_SELF' });
      }
    });

    it('should throw NotFoundException when target user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.follow('user-1', 'nonexistent');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse();
        expect(response).toMatchObject({ code: 'USER_NOT_FOUND' });
      }
    });

    it('should throw ConflictException on duplicate follow (P2002)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      try {
        await service.follow('user-1', 'user-2');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = (error as ConflictException).getResponse();
        expect(response).toMatchObject({ code: 'ALREADY_FOLLOWING' });
      }
    });

    it('should rethrow non-P2002 errors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      const genericError = new Error('DB connection failed');
      mockPrisma.$transaction.mockRejectedValue(genericError);

      await expect(service.follow('user-1', 'user-2')).rejects.toThrow('DB connection failed');
    });
  });

  // ==================== unfollow ====================

  describe('unfollow', () => {
    it('should unfollow a user and return UNFOLLOWED message', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: 'user-1',
        followingId: 'user-2',
      });
      mockPrisma.$transaction.mockResolvedValue(undefined);

      const result = await service.unfollow('user-1', 'user-2');

      expect(result).toEqual({ message: 'UNFOLLOWED' });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not following', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null);

      try {
        await service.unfollow('user-1', 'user-2');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse();
        expect(response).toMatchObject({ code: 'NOT_FOLLOWING' });
      }
    });
  });

  // ==================== getFollowers ====================

  describe('getFollowers', () => {
    const pagination = { page: 1, limit: 20, skip: 0 };

    it('should return paginated followers with isFollowing null when not logged in', async () => {
      const followData = [
        { follower: { id: 'f1', fullName: 'Follower 1', avatarUrl: null, bio: null } },
        { follower: { id: 'f2', fullName: 'Follower 2', avatarUrl: null, bio: null } },
      ];
      mockPrisma.follow.findMany.mockResolvedValue(followData);
      mockPrisma.follow.count.mockResolvedValue(2);

      const result = await service.getFollowers('user-1', pagination);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
      expect(result.data[0]).toMatchObject({ id: 'f1', isFollowing: null });
    });

    it('should enrich with isFollowing status when logged in', async () => {
      const followData = [
        { follower: { id: 'f1', fullName: 'Follower 1', avatarUrl: null, bio: null } },
        { follower: { id: 'f2', fullName: 'Follower 2', avatarUrl: null, bio: null } },
      ];
      mockPrisma.follow.findMany
        .mockResolvedValueOnce(followData) // getFollowers query
        .mockResolvedValueOnce([{ followingId: 'f1' }]); // enrichWithFollowStatus query
      mockPrisma.follow.count.mockResolvedValue(2);

      const result = await service.getFollowers('user-1', pagination, 'current-user');

      expect(result.data[0]).toMatchObject({ id: 'f1', isFollowing: true });
      expect(result.data[1]).toMatchObject({ id: 'f2', isFollowing: false });
    });
  });

  // ==================== getFollowing ====================

  describe('getFollowing', () => {
    const pagination = { page: 1, limit: 20, skip: 0 };

    it('should return paginated following list', async () => {
      const followData = [
        { following: { id: 'f1', fullName: 'Following 1', avatarUrl: null, bio: null } },
      ];
      mockPrisma.follow.findMany.mockResolvedValue(followData);
      mockPrisma.follow.count.mockResolvedValue(1);

      const result = await service.getFollowing('user-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: 'f1', isFollowing: null });
    });
  });

  // ==================== isFollowing ====================

  describe('isFollowing', () => {
    it('should return true when follow relationship exists', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: 'user-1',
        followingId: 'user-2',
      });

      const result = await service.isFollowing('user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false when follow relationship does not exist', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null);

      const result = await service.isFollowing('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });
});
