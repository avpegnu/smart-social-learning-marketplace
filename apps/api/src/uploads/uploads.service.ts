import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadsService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('cloudinary.cloudName'),
      api_key: this.configService.get('cloudinary.apiKey'),
      api_secret: this.configService.get('cloudinary.apiSecret'),
    });
  }

  async generateSignedUploadParams(folder: string) {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      this.configService.get('cloudinary.apiSecret') || '',
    );

    return {
      timestamp,
      signature,
      folder,
      cloudName: this.configService.get('cloudinary.cloudName'),
      apiKey: this.configService.get('cloudinary.apiKey'),
    };
  }

  // Ký params để upload video ở dạng authenticated (không public).
  // FE gửi kèm type=authenticated + folder + timestamp + signature khi POST lên Cloudinary.
  generateVideoUploadSignature() {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'courses/videos';
    const type = 'authenticated';
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp, type },
      this.configService.get('cloudinary.apiSecret') || '',
    );

    return {
      timestamp,
      signature,
      folder,
      type,
      cloudName: this.configService.get('cloudinary.cloudName'),
      apiKey: this.configService.get('cloudinary.apiKey'),
    };
  }

  // Sinh URL có chữ ký cho video authenticated. Không có chữ ký thì Cloudinary từ chối.
  getSignedVideoUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      type: 'authenticated',
      sign_url: true,
      secure: true,
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  // chưa dùng
  async getVideoInfo(publicId: string): Promise<UploadApiResponse> {
    return cloudinary.api.resource(publicId, { resource_type: 'video' });
  }
}
