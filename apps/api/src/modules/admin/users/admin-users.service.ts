import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryAdminUsersDto } from '../dto/query-admin-users.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';

@Injectable()
export class AdminUsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getUsers(query: QueryAdminUsersDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role as Role }),
      ...(query.status && { status: query.status as UserStatus }),
      ...(query.search && {
        OR: [
          {
            fullName: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          },
          {
            email: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
      deletedAt: null,
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return createPaginatedResult(users, total, query.page, query.limit);
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.role === 'ADMIN') {
      throw new ForbiddenException({ code: 'CANNOT_MODIFY_ADMIN' });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status as UserStatus },
    });
  }
}
