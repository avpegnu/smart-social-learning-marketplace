import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

const mockUsersService = {
  getMe: jest.fn(),
  getPublicProfile: jest.fn(),
  updateProfile: jest.fn(),
  updateNotificationPreferences: jest.fn(),
  follow: jest.fn(),
  unfollow: jest.fn(),
  getFollowers: jest.fn(),
  getFollowing: jest.fn(),
};

const MOCK_JWT: JwtPayload = { sub: 'user-1', role: 'STUDENT' };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get(UsersController);
    jest.clearAllMocks();
  });

  // ==================== getMe ====================

  describe('getMe', () => {
    it('should call usersService.getMe with user id', async () => {
      const mockProfile = { id: 'user-1', email: 'test@example.com' };
      mockUsersService.getMe.mockResolvedValue(mockProfile);

      const result = await controller.getMe(MOCK_JWT);

      expect(result).toEqual(mockProfile);
      expect(mockUsersService.getMe).toHaveBeenCalledWith('user-1');
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile', () => {
    it('should call usersService.updateProfile with user id and dto', async () => {
      const dto = { fullName: 'New Name' };
      const updated = { id: 'user-1', fullName: 'New Name', avatarUrl: null, bio: null };
      mockUsersService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile(MOCK_JWT, dto);

      expect(result).toEqual(updated);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    });
  });

  // ==================== updateNotificationPreferences ====================

  describe('updateNotificationPreferences', () => {
    it('should call usersService with preferences from dto', async () => {
      const prefs = { NEW_FOLLOWER: { inApp: true, email: false } };
      const dto = { preferences: prefs } as never;
      mockUsersService.updateNotificationPreferences.mockResolvedValue({
        id: 'user-1',
        notificationPreferences: prefs,
      });

      await controller.updateNotificationPreferences(MOCK_JWT, dto);

      expect(mockUsersService.updateNotificationPreferences).toHaveBeenCalledWith('user-1', prefs);
    });
  });

  // ==================== getPublicProfile ====================

  describe('getPublicProfile', () => {
    it('should pass currentUserId when user is logged in', async () => {
      const profile = { id: 'user-2', fullName: 'Other', isFollowing: true };
      mockUsersService.getPublicProfile.mockResolvedValue(profile);

      const result = await controller.getPublicProfile('user-2', MOCK_JWT);

      expect(result).toEqual(profile);
      expect(mockUsersService.getPublicProfile).toHaveBeenCalledWith('user-2', 'user-1');
    });

    it('should pass undefined when user is not logged in', async () => {
      const profile = { id: 'user-2', fullName: 'Other', isFollowing: null };
      mockUsersService.getPublicProfile.mockResolvedValue(profile);

      const result = await controller.getPublicProfile('user-2', undefined);

      expect(result).toEqual(profile);
      expect(mockUsersService.getPublicProfile).toHaveBeenCalledWith('user-2', undefined);
    });
  });

  // ==================== follow ====================

  describe('follow', () => {
    it('should call usersService.follow with follower and following ids', async () => {
      mockUsersService.follow.mockResolvedValue({ message: 'FOLLOWED' });

      const result = await controller.follow(MOCK_JWT, 'user-2');

      expect(result).toEqual({ message: 'FOLLOWED' });
      expect(mockUsersService.follow).toHaveBeenCalledWith('user-1', 'user-2');
    });
  });

  // ==================== unfollow ====================

  describe('unfollow', () => {
    it('should call usersService.unfollow with follower and following ids', async () => {
      mockUsersService.unfollow.mockResolvedValue({ message: 'UNFOLLOWED' });

      const result = await controller.unfollow(MOCK_JWT, 'user-2');

      expect(result).toEqual({ message: 'UNFOLLOWED' });
      expect(mockUsersService.unfollow).toHaveBeenCalledWith('user-1', 'user-2');
    });
  });

  // ==================== getFollowers ====================

  describe('getFollowers', () => {
    it('should pass currentUserId from jwt to service', async () => {
      const query = { page: 1, limit: 20 } as never;
      const paginatedResult = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      mockUsersService.getFollowers.mockResolvedValue(paginatedResult);

      const result = await controller.getFollowers('user-2', query, MOCK_JWT);

      expect(result).toEqual(paginatedResult);
      expect(mockUsersService.getFollowers).toHaveBeenCalledWith('user-2', query, 'user-1');
    });

    it('should pass undefined when user is not logged in', async () => {
      const query = { page: 1, limit: 20 } as never;
      mockUsersService.getFollowers.mockResolvedValue({ data: [], meta: {} });

      await controller.getFollowers('user-2', query, undefined);

      expect(mockUsersService.getFollowers).toHaveBeenCalledWith('user-2', query, undefined);
    });
  });

  // ==================== getFollowing ====================

  describe('getFollowing', () => {
    it('should pass currentUserId from jwt to service', async () => {
      const query = { page: 1, limit: 20 } as never;
      const paginatedResult = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      mockUsersService.getFollowing.mockResolvedValue(paginatedResult);

      const result = await controller.getFollowing('user-2', query, MOCK_JWT);

      expect(result).toEqual(paginatedResult);
      expect(mockUsersService.getFollowing).toHaveBeenCalledWith('user-2', query, 'user-1');
    });
  });
});
