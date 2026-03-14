import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CertificatesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async generateCertificate(userId: string, courseId: string) {
    // Idempotent — don't create duplicate
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return existing;

    // Generate unique verify code (retry on collision)
    let verifyCode = '';
    for (let i = 0; i < 3; i++) {
      verifyCode = crypto.randomUUID().slice(0, 8).toUpperCase();
      const exists = await this.prisma.certificate.findUnique({ where: { verifyCode } });
      if (!exists) break;
    }

    const appUrl = this.config.get<string>('app.url') ?? 'https://sslm.com';
    const certificateUrl = `${appUrl}/certificates/${verifyCode}`;

    return this.prisma.certificate.create({
      data: { userId, courseId, certificateUrl, verifyCode },
    });
  }

  async verifyCertificate(verifyCode: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { verifyCode },
      include: {
        user: { select: { fullName: true } },
        course: {
          select: {
            title: true,
            instructor: { select: { fullName: true } },
          },
        },
      },
    });
    if (!cert) throw new NotFoundException({ code: 'CERTIFICATE_NOT_FOUND' });

    return {
      valid: true,
      studentName: cert.user.fullName,
      courseName: cert.course.title,
      instructorName: cert.course.instructor.fullName,
      issuedAt: cert.createdAt,
      verifyCode: cert.verifyCode,
    };
  }

  async getMyCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: {
        course: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
