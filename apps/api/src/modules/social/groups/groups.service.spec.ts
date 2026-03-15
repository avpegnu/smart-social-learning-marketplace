import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  group: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  groupMember: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  post: { findMany: jest.fn(), count: jest.fn() },
  enrollment: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

describe('GroupsService', () => {
  let service: GroupsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GroupsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(GroupsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create group with owner as member', async () => {
      const group = { id: 'group-1', name: 'React Vietnam' };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.group.create.mockResolvedValue(group);
      mockPrisma.groupMember.create.mockResolvedValue({});

      const result = await service.create('user-1', {
        name: 'React Vietnam',
      } as never);
      expect(result.name).toBe('React Vietnam');
    });

    it('should set PRIVATE for course groups', async () => {
      mockPrisma.group.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.group.create.mockResolvedValue({
        id: 'g1',
        privacy: 'PRIVATE',
      });
      mockPrisma.groupMember.create.mockResolvedValue({});

      await service.create('user-1', {
        name: 'Course Group',
        courseId: 'course-1',
      } as never);
      expect(mockPrisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ privacy: 'PRIVATE' }),
        }),
      );
    });

    it('should throw ConflictException if course group exists', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create('user-1', {
          name: 'x',
          courseId: 'course-1',
        } as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('join', () => {
    it('should join public group', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        privacy: 'PUBLIC',
        courseId: null,
      });
      mockPrisma.groupMember.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.join('g1', 'user-1');
      expect(result).toEqual({ joined: true });
    });

    it('should require enrollment for private course group', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        privacy: 'PRIVATE',
        courseId: 'course-1',
      });
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);

      await expect(service.join('g1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if already member', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        privacy: 'PUBLIC',
        courseId: null,
      });
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.join('g1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('leave', () => {
    it('should leave group', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-1',
        role: 'MEMBER',
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.leave('g1', 'user-1');
      expect(result).toEqual({ left: true });
    });

    it('should prevent owner from leaving', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'owner',
        role: 'OWNER',
      });
      await expect(service.leave('g1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not member', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue(null);
      await expect(service.leave('g1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('kickMember', () => {
    it('should kick a member', async () => {
      mockPrisma.groupMember.findUnique
        .mockResolvedValueOnce({ id: 'admin', role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'target', role: 'MEMBER' });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.kickMember('g1', 'admin-user', 'target-user');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should prevent kicking owner', async () => {
      mockPrisma.groupMember.findUnique
        .mockResolvedValueOnce({ id: 'admin', role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'target', role: 'OWNER' });

      await expect(service.kickMember('g1', 'admin-user', 'owner-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
