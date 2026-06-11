import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { PlatformSettingsService } from '@/modules/platform-settings/platform-settings.service';

const mockPrisma = {
  withdrawal: { findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};

const mockQueue = { addAdminNotification: jest.fn() };
// Returns the provided fallback for any setting key (minimum_withdrawal -> 50000).
const mockPlatformSettings = { get: jest.fn((_key: string, fallback: unknown) => fallback) };

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: PlatformSettingsService, useValue: mockPlatformSettings },
      ],
    }).compile();

    service = module.get(WithdrawalsService);
    jest.clearAllMocks();
  });

  describe('requestWithdrawal', () => {
    const dto = {
      amount: 500000,
      bankInfo: { bankName: 'MB', accountNumber: '012345', accountName: 'TEST' },
    };

    // Builds a transaction-client mock for the in-transaction flow.
    const makeTx = (over: { pending?: unknown; debitCount?: number; created?: unknown }) => ({
      withdrawal: {
        findFirst: jest.fn().mockResolvedValue(over.pending ?? null),
        create: jest
          .fn()
          .mockResolvedValue(over.created ?? { id: 'w-1', amount: 500000, status: 'PENDING' }),
      },
      instructorProfile: {
        updateMany: jest.fn().mockResolvedValue({ count: over.debitCount ?? 1 }),
      },
    });

    it('should reject below-minimum amounts before opening a transaction', async () => {
      await expect(
        service.requestWithdrawal('instr-1', { ...dto, amount: 1000 } as never),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw if a pending withdrawal already exists', async () => {
      const tx = makeTx({ pending: { id: 'w-old' } });
      mockPrisma.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      );

      await expect(service.requestWithdrawal('instr-1', dto as never)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.instructorProfile.updateMany).not.toHaveBeenCalled();
    });

    it('should throw when the guarded debit matches no row (insufficient balance)', async () => {
      const tx = makeTx({ debitCount: 0 });
      mockPrisma.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      );

      await expect(service.requestWithdrawal('instr-1', dto as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.withdrawal.create).not.toHaveBeenCalled();
    });

    it('should debit atomically (guarded) and create the withdrawal', async () => {
      const tx = makeTx({ debitCount: 1 });
      mockPrisma.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
        fn(tx),
      );

      const result = await service.requestWithdrawal('instr-1', dto as never);

      // The decrement only applies when the balance still covers the amount.
      expect(tx.instructorProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'instr-1', availableBalance: { gte: 500000 } },
        data: { availableBalance: { decrement: 500000 } },
      });
      expect(result.amount).toBe(500000);
      expect(mockQueue.addAdminNotification).toHaveBeenCalledWith(
        'WITHDRAWAL_PENDING',
        expect.objectContaining({ withdrawalId: 'w-1', amount: 500000, instructorId: 'instr-1' }),
      );
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
