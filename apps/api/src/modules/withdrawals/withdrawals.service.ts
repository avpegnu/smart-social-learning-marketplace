import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import type { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async requestWithdrawal(instructorId: string, dto: CreateWithdrawalDto) {
    // 1. Check no pending withdrawal exists
    const pending = await this.prisma.withdrawal.findFirst({
      where: { instructorId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException({ code: 'WITHDRAWAL_PENDING_EXISTS' });
    }

    // 2. Check available balance (only AVAILABLE earnings)
    const available = await this.prisma.earning.aggregate({
      where: { instructorId, status: 'AVAILABLE' },
      _sum: { netAmount: true },
    });
    const balance = available._sum.netAmount ?? 0;

    if (dto.amount > balance) {
      throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE' });
    }

    // 3. Create withdrawal + lock earnings in transaction
    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: {
          instructorId,
          amount: dto.amount,
          bankInfo: dto.bankInfo as unknown as Prisma.InputJsonValue,
        },
      });

      // Lock earnings: mark enough AVAILABLE earnings as WITHDRAWN (FIFO)
      let remaining = dto.amount;
      const availableEarnings = await tx.earning.findMany({
        where: { instructorId, status: 'AVAILABLE' },
        orderBy: { createdAt: 'asc' },
      });

      for (const earning of availableEarnings) {
        if (remaining <= 0) break;
        await tx.earning.update({
          where: { id: earning.id },
          data: { status: 'WITHDRAWN' },
        });
        remaining -= earning.netAmount;
      }

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
