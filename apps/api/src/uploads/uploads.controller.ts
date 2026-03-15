import { Controller, Post, Delete, Param, Body, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { MediaService } from '@/modules/media/media.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SignUploadDto } from '@/modules/media/dto/sign-upload.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CompleteUploadDto } from '@/modules/media/dto/complete-upload.dto';

@Controller('uploads')
@ApiTags('Uploads')
@ApiBearerAuth()
export class UploadsController {
  constructor(
    @Inject(MediaService)
    private readonly mediaService: MediaService,
  ) {}

  @Post('sign')
  @ApiOperation({ summary: 'Generate signed upload params' })
  async sign(@CurrentUser() user: JwtPayload, @Body() dto: SignUploadDto) {
    return this.mediaService.signAndCreatePending(user.sub, dto);
  }

  @Post(':mediaId/complete')
  @ApiOperation({ summary: 'Confirm upload complete' })
  async complete(
    @Param('mediaId', ParseCuidPipe) mediaId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.mediaService.completeUpload(mediaId, user.sub, dto);
  }

  @Delete(':mediaId')
  @ApiOperation({ summary: 'Delete media file' })
  async deleteMedia(
    @Param('mediaId', ParseCuidPipe) mediaId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.deleteMedia(mediaId, user.sub);
  }
}
