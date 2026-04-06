import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ReportsService } from './reports.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
@ApiTags('Reports')
@ApiBearerAuth()
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Submit a report' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.sub, dto);
  }
}
