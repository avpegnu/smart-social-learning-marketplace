import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  const prisma = {
    report: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReportsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a report', async () => {
      prisma.report.findFirst.mockResolvedValue(null);
      prisma.report.create.mockResolvedValue({ id: 'r1' });

      const result = await service.create('u1', {
        targetType: 'POST',
        targetId: 'p1',
        reason: 'Spam content',
      });

      expect(result.id).toBe('r1');
    });

    it('should prevent duplicate pending report', async () => {
      prisma.report.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('u1', {
          targetType: 'POST',
          targetId: 'p1',
          reason: 'Spam',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getReports', () => {
    it('should return paginated reports', async () => {
      prisma.report.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.getReports({
        page: 1,
        limit: 20,
        skip: 0,
      } as never);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.report.findMany.mockResolvedValue([]);
      prisma.report.count.mockResolvedValue(0);

      await service.getReports({
        page: 1,
        limit: 20,
        skip: 0,
        status: 'PENDING',
      } as never);

      const where = prisma.report.findMany.mock.calls[0]![0]!.where;
      expect(where.status).toBe('PENDING');
    });
  });

  describe('reviewReport', () => {
    it('should review a pending report', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'PENDING',
      });
      prisma.report.update.mockResolvedValue({
        id: 'r1',
        status: 'DISMISSED',
      });

      const result = await service.reviewReport('r1', 'admin1', {
        status: 'DISMISSED',
        adminNote: 'Not a violation',
      });

      expect(result.status).toBe('DISMISSED');
    });

    it('should throw if not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(
        service.reviewReport('x', 'admin1', {
          status: 'DISMISSED',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if already reviewed', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'ACTION_TAKEN',
      });
      await expect(
        service.reviewReport('r1', 'admin1', {
          status: 'DISMISSED',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
