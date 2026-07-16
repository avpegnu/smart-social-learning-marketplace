import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';

// ConfigService giả trả cloud creds test cho cloudinary.config()
const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      'cloudinary.cloudName': 'demo-cloud',
      'cloudinary.apiKey': 'test-api-key',
      'cloudinary.apiSecret': 'test-api-secret',
    };
    return map[key];
  }),
};

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UploadsService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    service = module.get(UploadsService);
  });

  describe('getSignedVideoUrl', () => {
    it('should build a signed authenticated video URL for the public_id', () => {
      const url = service.getSignedVideoUrl('courses/videos/abc123');

      expect(url).toContain('demo-cloud');
      expect(url).toContain('/video/authenticated/');
      expect(url).toContain('courses/videos/abc123');
      // Chữ ký của Cloudinary có tiền tố s--...--
      expect(url).toMatch(/\/s--[^/]+--\//);
    });
  });

  describe('generateVideoUploadSignature', () => {
    it('should return signed params with authenticated type and video folder', () => {
      const params = service.generateVideoUploadSignature();

      expect(params.type).toBe('authenticated');
      expect(params.folder).toBe('courses/videos');
      expect(params.cloudName).toBe('demo-cloud');
      expect(params.apiKey).toBe('test-api-key');
      expect(typeof params.timestamp).toBe('number');
      expect(typeof params.signature).toBe('string');
      expect(params.signature.length).toBeGreaterThan(0);
      // Không được lộ api_secret ra ngoài
      expect(JSON.stringify(params)).not.toContain('test-api-secret');
    });
  });
});
