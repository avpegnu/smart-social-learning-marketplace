import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewWithdrawalDto } from '../dto/review-withdrawal.dto';

@Injectable()
export class AdminWithdrawalsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPendingWithdrawals(query: PaginationDto) {
    const where = { status: 'PENDING' as const };

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        include: {
          instructor: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return createPaginatedResult(withdrawals, total, query.page, query.limit);
  }

  async processWithdrawal(withdrawalId: string, adminId: string, dto: ReviewWithdrawalDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) {
      throw new NotFoundException({ code: 'WITHDRAWAL_NOT_FOUND' });
    }
    if (withdrawal.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'WITHDRAWAL_NOT_PENDING',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: dto.status as WithdrawalStatus,
          reviewedById: adminId,
          reviewNote: dto.reviewNote,
          reviewedAt: new Date(),
        },
      });

      if (dto.status === 'COMPLETED') {
        // Mark AVAILABLE earnings as WITHDRAWN (up to withdrawal amount)
        const earnings = await tx.earning.findMany({
          where: {
            instructorId: withdrawal.instructorId,
            status: 'AVAILABLE',
          },
          orderBy: { createdAt: 'asc' },
        });

        let remaining = withdrawal.amount;
        const earningIds: string[] = [];
        for (const earning of earnings) {
          if (remaining <= 0) break;
          earningIds.push(earning.id);
          remaining -= earning.netAmount;
        }

        if (earningIds.length > 0) {
          await tx.earning.updateMany({
            where: { id: { in: earningIds } },
            data: { status: 'WITHDRAWN' },
          });
        }
      }
      if (dto.status === 'REJECTED') {
        // Refund the locked amount back to available balance
        await tx.instructorProfile.update({
          where: { userId: withdrawal.instructorId },
          data: { availableBalance: { increment: withdrawal.amount } },
        });
      }

      return updated;
    });
  }
}
