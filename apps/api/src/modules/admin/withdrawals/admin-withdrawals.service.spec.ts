import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AdminWithdrawalsService', () => {
  let service: AdminWithdrawalsService;
  const tx = {
    withdrawal: { update: jest.fn() },
    earning: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    instructorProfile: {
      update: jest.fn(),
    },
  };
  const prisma = {
    withdrawal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(tx)),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminWithdrawalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminWithdrawalsService);
    jest.clearAllMocks();
  });

  describe('processWithdrawal', () => {
    const withdrawal = {
      id: 'w1',
      instructorId: 'inst1',
      amount: 500000,
      status: 'PENDING',
    };

    it('should complete and mark earnings as withdrawn', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(withdrawal);
      tx.withdrawal.update.mockResolvedValue({
        ...withdrawal,
        status: 'COMPLETED',
      });
      tx.earning.findMany.mockResolvedValue([
        { id: 'e1', netAmount: 300000 },
        { id: 'e2', netAmount: 200000 },
      ]);

      await service.processWithdrawal('w1', 'admin1', {
        status: 'COMPLETED',
      });

      expect(tx.earning.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['e1', 'e2'] } },
        data: { status: 'WITHDRAWN' },
      });
    });

    it('should reject and refund available balance to instructor profile', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(withdrawal);
      tx.withdrawal.update.mockResolvedValue({
        ...withdrawal,
        status: 'REJECTED',
      });

      await service.processWithdrawal('w1', 'admin1', {
        status: 'REJECTED',
      });

      expect(tx.earning.findMany).not.toHaveBeenCalled();
      expect(tx.earning.updateMany).not.toHaveBeenCalled();
      expect(tx.instructorProfile.update).toHaveBeenCalledWith({
        where: { userId: 'inst1' },
        data: { availableBalance: { increment: 500000 } },
      });
    });

    it('should throw if not found', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(null);
      await expect(
        service.processWithdrawal('x', 'admin1', {
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if not pending', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue({
        ...withdrawal,
        status: 'COMPLETED',
      });
      await expect(
        service.processWithdrawal('w1', 'admin1', {
          status: 'COMPLETED',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
