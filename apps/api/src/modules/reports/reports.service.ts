import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma, ReportTargetType, ReportStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { AdminModerationService } from '@/modules/admin/moderation/admin-moderation.service';
import { AdminUsersService } from '@/modules/admin/users/admin-users.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateReportDto } from './dto/create-report.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryReportsDto } from './dto/query-reports.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewReportDto } from '../admin/dto/review-report.dto';

export interface TargetPreview {
  text: string;
  authorName: string;
  context?: string;
  viewPath?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(AdminModerationService) private readonly moderation: AdminModerationService,
    @Inject(AdminUsersService) private readonly adminUsers: AdminUsersService,
  ) {}

  async create(userId: string, dto: CreateReportDto) {
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
    const targetTypes = query.targetType
      ? (query.targetType.split(',') as ReportTargetType[])
      : undefined;

    const where: Prisma.ReportWhereInput = {
      ...(query.status && { status: query.status as ReportStatus }),
      ...(targetTypes &&
        (targetTypes.length === 1
          ? { targetType: targetTypes[0] }
          : { targetType: { in: targetTypes } })),
    };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          reviewedBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    const enriched = await this.enrichWithPreviews(reports);
    return createPaginatedResult(enriched, total, query.page, query.limit);
  }

  async reviewReport(reportId: string, adminId: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
    }
    if (report.status !== 'PENDING') {
      throw new BadRequestException({ code: 'REPORT_ALREADY_REVIEWED' });
    }

    // Execute action if provided
    if (dto.action === 'DELETE_CONTENT') {
      try {
        await this.moderation.deleteByTargetType(report.targetType, report.targetId);
      } catch (err) {
        this.logger.warn(
          `Failed to delete ${report.targetType}:${report.targetId}: ${(err as Error).message}`,
        );
      }
    }

    if (dto.action === 'SUSPEND_USER' && report.targetType === 'USER') {
      try {
        await this.adminUsers.updateUserStatus(report.targetId, { status: 'SUSPENDED' } as {
          status: string;
        });
      } catch (err) {
        this.logger.warn(`Failed to suspend user ${report.targetId}: ${(err as Error).message}`);
      }
    }

    // Update report status
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status as ReportStatus,
        reviewedById: adminId,
        reviewNote: dto.adminNote,
        reviewedAt: new Date(),
      },
    });

    // Auto-resolve other PENDING reports on the same target
    if (dto.action === 'DELETE_CONTENT' || dto.action === 'SUSPEND_USER') {
      await this.prisma.report.updateMany({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: 'PENDING',
          id: { not: reportId },
        },
        data: {
          status: 'ACTION_TAKEN' as ReportStatus,
          reviewedById: adminId,
          reviewNote: 'Auto-resolved',
          reviewedAt: new Date(),
        },
      });
    }

    // Notify reporter
    this.queue.addNotification(report.reporterId, 'REPORT_RESOLVED', {
      reportId: report.id,
      targetType: report.targetType,
      status: dto.status,
    });

    return updated;
  }

  // ── Content preview enrichment ──

  private async enrichWithPreviews(
    reports: Array<{ targetType: string; targetId: string; [key: string]: unknown }>,
  ) {
    const grouped = new Map<string, string[]>();
    for (const r of reports) {
      const ids = grouped.get(r.targetType) ?? [];
      ids.push(r.targetId as string);
      grouped.set(r.targetType, ids);
    }

    const previews = new Map<string, TargetPreview>();

    const postIds = grouped.get('POST');
    if (postIds?.length) {
      const posts = await this.prisma.post.findMany({
        where: { id: { in: postIds } },
        select: {
          id: true,
          content: true,
          deletedAt: true,
          author: { select: { fullName: true } },
        },
      });
      for (const p of posts) {
        previews.set(`POST:${p.id}`, {
          text: p.deletedAt ? '[Deleted]' : (p.content?.slice(0, 200) ?? ''),
          authorName: p.author.fullName,
          viewPath: `/social`,
        });
      }
    }

    const commentIds = grouped.get('COMMENT');
    if (commentIds?.length) {
      const comments = await this.prisma.comment.findMany({
        where: { id: { in: commentIds } },
        select: {
          id: true,
          content: true,
          deletedAt: true,
          author: { select: { fullName: true } },
          post: { select: { id: true, content: true, author: { select: { fullName: true } } } },
        },
      });
      for (const c of comments) {
        previews.set(`COMMENT:${c.id}`, {
          text: c.deletedAt ? '[Deleted]' : (c.content?.slice(0, 200) ?? ''),
          authorName: c.author.fullName,
          context: `Post by ${c.post.author.fullName}: "${c.post.content?.slice(0, 80) ?? ''}..."`,
          viewPath: `/social`,
        });
      }
    }

    const questionIds = grouped.get('QUESTION');
    if (questionIds?.length) {
      const questions = await this.prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, title: true, deletedAt: true, author: { select: { fullName: true } } },
      });
      for (const q of questions) {
        previews.set(`QUESTION:${q.id}`, {
          text: q.deletedAt ? '[Deleted]' : q.title,
          authorName: q.author.fullName,
          viewPath: `/qna/${q.id}`,
        });
      }
    }

    const answerIds = grouped.get('ANSWER');
    if (answerIds?.length) {
      const answers = await this.prisma.answer.findMany({
        where: { id: { in: answerIds } },
        select: {
          id: true,
          content: true,
          deletedAt: true,
          author: { select: { fullName: true } },
          question: { select: { id: true, title: true } },
        },
      });
      for (const a of answers) {
        previews.set(`ANSWER:${a.id}`, {
          text: a.deletedAt ? '[Deleted]' : (a.content?.slice(0, 200) ?? ''),
          authorName: a.author.fullName,
          context: `Question: "${a.question.title}"`,
          viewPath: `/qna/${a.question.id}`,
        });
      }
    }

    const userIds = grouped.get('USER');
    if (userIds?.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, status: true },
      });
      for (const u of users) {
        previews.set(`USER:${u.id}`, {
          text: u.status as string,
          authorName: u.fullName,
          viewPath: `/profile/${u.id}`,
        });
      }
    }

    const courseIds = grouped.get('COURSE');
    if (courseIds?.length) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          instructor: { select: { fullName: true } },
        },
      });
      for (const c of courses) {
        previews.set(`COURSE:${c.id}`, {
          text: c.title,
          authorName: c.instructor.fullName,
          context: `Status: ${c.status}`,
          viewPath: `/courses/${c.slug}`,
        });
      }
    }

    return reports.map((r) => ({
      ...r,
      targetPreview: previews.get(`${r.targetType}:${r.targetId}`) ?? null,
    }));
  }
}
