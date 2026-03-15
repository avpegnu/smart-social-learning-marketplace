import { Controller, Get, Query, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { AnalyticsType } from '@prisma/client';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin')
@ApiTags('Admin — Analytics')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminAnalyticsController {
  constructor(
    @Inject(AdminAnalyticsService)
    private readonly service: AdminAnalyticsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform dashboard stats' })
  async getDashboard() {
    return this.service.getDashboard();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Analytics data by type and date range' })
  async getAnalytics(
    @Query('type') type: AnalyticsType,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getAnalytics(type, from, to);
  }
}
