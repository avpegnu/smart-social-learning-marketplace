import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma, ReportTargetType, ReportStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateReportDto } from './dto/create-report.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryReportsDto } from './dto/query-reports.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewReportDto } from '../admin/dto/review-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async create(userId: string, dto: CreateReportDto) {
    // Prevent duplicate pending report
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: dto.targetType as ReportTargetType,
        targetId: dto.targetId,
        status: 'PENDING',
      },
    });
    if (existing) {
      throw new ConflictException({ code: 'REPORT_ALREADY_EXISTS' });
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType as ReportTargetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
      },
    });

    this.queue.addAdminNotification('NEW_REPORT', {
      reportId: report.id,
      targetType: dto.targetType,
      reason: dto.reason,
    });

    return report;
  }

  async getReports(query: QueryReportsDto) {
    const where: Prisma.ReportWhereInput = {
      ...(query.status && {
        status: query.status as ReportStatus,
      }),
      ...(query.targetType && {
        targetType: query.targetType as ReportTargetType,
      }),
    };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return createPaginatedResult(reports, total, query.page, query.limit);
  }

  async reviewReport(reportId: string, adminId: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
    }
    if (report.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'REPORT_ALREADY_REVIEWED',
      });
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status as ReportStatus,
        reviewedById: adminId,
        reviewNote: dto.adminNote,
        reviewedAt: new Date(),
      },
    });
  }
}
