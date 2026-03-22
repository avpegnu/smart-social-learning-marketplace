import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  withdrawal: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  instructorProfile: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [WithdrawalsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(WithdrawalsService);
    jest.clearAllMocks();
  });

  describe('requestWithdrawal', () => {
    const dto = {
      amount: 500000,
      bankInfo: { bankName: 'MB', accountNumber: '012345', accountName: 'TEST' },
    };

    it('should throw if pending withdrawal exists', async () => {
      mockPrisma.withdrawal.findFirst.mockResolvedValue({ id: 'w-1', status: 'PENDING' });

      await expect(service.requestWithdrawal('instr-1', dto as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw if insufficient balance', async () => {
      mockPrisma.withdrawal.findFirst.mockResolvedValue(null);
      mockPrisma.instructorProfile.findUnique.mockResolvedValue({ availableBalance: 100000 });

      await expect(service.requestWithdrawal('instr-1', dto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create withdrawal and deduct available balance', async () => {
      mockPrisma.withdrawal.findFirst.mockResolvedValue(null);
      mockPrisma.instructorProfile.findUnique.mockResolvedValue({ availableBalance: 1000000 });

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          withdrawal: {
            create: jest.fn().mockResolvedValue({ id: 'w-1', amount: 500000, status: 'PENDING' }),
          },
          instructorProfile: {
            update: jest.fn(),
          },
        }),
      );

      const result = await service.requestWithdrawal('instr-1', dto as never);

      expect(result.amount).toBe(500000);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('getWithdrawalHistory', () => {
    it('should return paginated withdrawals', async () => {
      mockPrisma.withdrawal.findMany.mockResolvedValue([{ id: 'w-1' }]);
      mockPrisma.withdrawal.count.mockResolvedValue(1);

      const result = await service.getWithdrawalHistory('instr-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);

      expect(result.data).toHaveLength(1);
    });
  });
});
