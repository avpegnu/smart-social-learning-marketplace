import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@Controller('certificates')
@ApiTags('Certificates')
export class CertificatesController {
  constructor(
    @Inject(CertificatesService) private readonly certificatesService: CertificatesService,
  ) {}

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my certificates' })
  async getMyCertificates(@CurrentUser() user: JwtPayload) {
    return this.certificatesService.getMyCertificates(user.sub);
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verify certificate by code (public)' })
  async verifyCertificate(@Param('code') code: string) {
    return this.certificatesService.verifyCertificate(code);
  }
}
