import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminApplicationsService } from './admin-applications.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AdminApplicationsService', () => {
  let service: AdminApplicationsService;
  const tx = {
    instructorApplication: { update: jest.fn() },
    user: { update: jest.fn() },
    instructorProfile: { upsert: jest.fn() },
  };
  const prisma = {
    instructorApplication: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(tx)),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminApplicationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminApplicationsService);
    jest.clearAllMocks();
  });

  describe('reviewApplication', () => {
    const application = {
      id: 'app1',
      userId: 'u1',
      status: 'PENDING',
      expertise: ['React'],
      experience: '5 years',
    };

    it('should approve and promote user to instructor', async () => {
      prisma.instructorApplication.findUnique.mockResolvedValue(application);
      tx.instructorApplication.update.mockResolvedValue({
        ...application,
        status: 'APPROVED',
      });

      await service.reviewApplication('app1', 'admin1', {
        approved: true,
      });

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { role: 'INSTRUCTOR' },
        }),
      );
      expect(tx.instructorProfile.upsert).toHaveBeenCalled();
    });

    it('should reject without promoting', async () => {
      prisma.instructorApplication.findUnique.mockResolvedValue(application);
      tx.instructorApplication.update.mockResolvedValue({
        ...application,
        status: 'REJECTED',
      });

      await service.reviewApplication('app1', 'admin1', {
        approved: false,
        reviewNote: 'Not enough experience',
      });

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.instructorProfile.upsert).not.toHaveBeenCalled();
    });

    it('should throw if not found', async () => {
      prisma.instructorApplication.findUnique.mockResolvedValue(null);
      await expect(service.reviewApplication('x', 'admin1', { approved: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if already reviewed', async () => {
      prisma.instructorApplication.findUnique.mockResolvedValue({
        ...application,
        status: 'APPROVED',
      });
      await expect(
        service.reviewApplication('app1', 'admin1', {
          approved: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
