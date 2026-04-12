import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async requestWithdrawal(instructorId: string, dto: CreateWithdrawalDto) {
    // 1. Check no pending withdrawal exists
    const pending = await this.prisma.withdrawal.findFirst({
      where: { instructorId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException({ code: 'WITHDRAWAL_PENDING_EXISTS' });
    }

    // 2. Check available balance from instructor profile
    const profile = await this.prisma.instructorProfile.findUnique({
      where: { userId: instructorId },
      select: { availableBalance: true },
    });
    const balance = profile?.availableBalance ?? 0;

    if (dto.amount > balance) {
      throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE' });
    }

    // 3. Create withdrawal + deduct balance
    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: {
          instructorId,
          amount: dto.amount,
          bankInfo: dto.bankInfo as unknown as Prisma.InputJsonValue,
        },
      });

      // Deduct from available balance
      await tx.instructorProfile.update({
        where: { userId: instructorId },
        data: { availableBalance: { decrement: dto.amount } },
      });

      // Notify admins
      this.queue.addAdminNotification('WITHDRAWAL_PENDING', {
        withdrawalId: withdrawal.id,
        amount: dto.amount,
        instructorId,
      });

      return withdrawal;
    });
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
