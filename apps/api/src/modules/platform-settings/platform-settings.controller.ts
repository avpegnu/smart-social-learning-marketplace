import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('platform-settings')
@ApiTags('Platform Settings')
@ApiBearerAuth()
export class PlatformSettingsController {
  constructor(
    @Inject(PlatformSettingsService)
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get public platform settings' })
  getPublicSettings() {
    return {
      minimumWithdrawal: this.settings.get<number>('minimum_withdrawal', 50000),
      defaultCommissionRate: this.settings.get<number>('default_commission_rate', 30),
      allowFreeCourses: this.settings.get<boolean>('allow_free_courses', true),
      autoApproveCourses: this.settings.get<boolean>('auto_approve_courses', false),
    };
  }
}
