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

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async getVideoInfo(publicId: string): Promise<UploadApiResponse> {
    return cloudinary.api.resource(publicId, { resource_type: 'video' });
  }
}
