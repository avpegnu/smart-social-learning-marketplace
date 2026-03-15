import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminUsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminUsersService);
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const users = [{ id: 'u1', email: 'test@test.com' }];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(result.data).toEqual(users);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by role and status', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({
        page: 1,
        limit: 20,
        skip: 0,
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
      } as never);

      const where = prisma.user.findMany.mock.calls[0]![0]!.where;
      expect(where.role).toBe('INSTRUCTOR');
      expect(where.status).toBe('ACTIVE');
    });

    it('should search by name and email', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({
        page: 1,
        limit: 20,
        skip: 0,
        search: 'test',
      } as never);

      const where = prisma.user.findMany.mock.calls[0]![0]!.where;
      expect(where.OR).toHaveLength(2);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'STUDENT',
      });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        status: 'SUSPENDED',
      });

      const result = await service.updateUserStatus('u1', {
        status: 'SUSPENDED',
      });
      expect(result.status).toBe('SUSPENDED');
    });

    it('should throw if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUserStatus('x', { status: 'SUSPENDED' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent suspending admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'ADMIN',
      });
      await expect(service.updateUserStatus('u1', { status: 'SUSPENDED' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
