import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { PlatformSettingsService } from '@/modules/platform-settings/platform-settings.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(PlatformSettingsService) private readonly platformSettings: PlatformSettingsService,
  ) {}

  async requestWithdrawal(instructorId: string, dto: CreateWithdrawalDto) {
    const minWithdrawal = this.platformSettings.get<number>('minimum_withdrawal', 50000);
    if (dto.amount < minWithdrawal) {
      throw new BadRequestException({ code: 'BELOW_MINIMUM_WITHDRAWAL', minimum: minWithdrawal });
    }

    // Run the pending-check + balance debit inside one transaction so two
    // concurrent requests cannot both pass a stale balance check (TOCTOU). The
    // guarded updateMany only decrements when the balance still covers the amount,
    // and the row lock serializes racing requests — preventing double-withdrawal
    // or a negative balance.
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.withdrawal.findFirst({
        where: { instructorId, status: 'PENDING' },
        select: { id: true },
      });
      if (pending) {
        throw new ConflictException({ code: 'WITHDRAWAL_PENDING_EXISTS' });
      }

      const debit = await tx.instructorProfile.updateMany({
        where: { userId: instructorId, availableBalance: { gte: dto.amount } },
        data: { availableBalance: { decrement: dto.amount } },
      });
      if (debit.count === 0) {
        throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE' });
      }

      return tx.withdrawal.create({
        data: {
          instructorId,
          amount: dto.amount,
          bankInfo: dto.bankInfo as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // Notify admins (fire-and-forget, outside the transaction)
    this.queue.addAdminNotification('WITHDRAWAL_PENDING', {
      withdrawalId: withdrawal.id,
      amount: dto.amount,
      instructorId,
    });

    return withdrawal;
  }

  async getWithdrawalHistory(instructorId: string, query: PaginationDto) {
    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { instructorId },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.withdrawal.count({ where: { instructorId } }),
    ]);
    return createPaginatedResult(withdrawals, total, query.page, query.limit);
  }
}
