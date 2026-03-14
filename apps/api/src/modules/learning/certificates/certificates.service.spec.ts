import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '@/prisma/prisma.service';

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'ABCD1234-5678-9012-3456-789012345678'),
}));

const mockPrisma = {
  certificate: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'app.url') return 'https://sslm.com';
    return '';
  }),
};

describe('CertificatesService', () => {
  let service: CertificatesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(CertificatesService);
    jest.clearAllMocks();
  });

  describe('generateCertificate', () => {
    it('should return existing certificate if already exists', async () => {
      const existing = { id: 'cert-1', verifyCode: 'ABCD1234' };
      mockPrisma.certificate.findUnique.mockResolvedValueOnce(existing); // userId_courseId check

      const result = await service.generateCertificate('user-1', 'course-1');

      expect(result).toEqual(existing);
      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('should create new certificate with verify code', async () => {
      mockPrisma.certificate.findUnique
        .mockResolvedValueOnce(null) // userId_courseId check
        .mockResolvedValueOnce(null); // verifyCode uniqueness check
      mockPrisma.certificate.create.mockResolvedValue({
        id: 'cert-1',
        verifyCode: 'ABCD1234',
        certificateUrl: 'https://sslm.com/certificates/ABCD1234',
      });

      const result = await service.generateCertificate('user-1', 'course-1');

      expect(result.verifyCode).toBe('ABCD1234');
      expect(result.certificateUrl).toContain('sslm.com/certificates/ABCD1234');
    });
  });

  describe('verifyCertificate', () => {
    it('should return certificate info', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({
        verifyCode: 'ABCD1234',
        createdAt: new Date('2024-01-15'),
        user: { fullName: 'Student A' },
        course: { title: 'React', instructor: { fullName: 'Teacher B' } },
      });

      const result = await service.verifyCertificate('ABCD1234');

      expect(result.valid).toBe(true);
      expect(result.studentName).toBe('Student A');
      expect(result.instructorName).toBe('Teacher B');
    });

    it('should throw if code not found', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      await expect(service.verifyCertificate('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyCertificates', () => {
    it('should return user certificates', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([{ id: 'cert-1' }]);

      const result = await service.getMyCertificates('user-1');

      expect(result).toHaveLength(1);
    });
  });
});
