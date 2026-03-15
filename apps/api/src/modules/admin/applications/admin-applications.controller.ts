import { Controller, Get, Patch, Param, Query, Body, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { AdminApplicationsService } from './admin-applications.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewApplicationDto } from '../dto/review-application.dto';

@Controller('admin/applications')
@ApiTags('Admin — Applications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminApplicationsController {
  constructor(
    @Inject(AdminApplicationsService)
    private readonly service: AdminApplicationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List pending instructor applications' })
  async getPending(@Query() query: PaginationDto) {
    return this.service.getPendingApplications(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve or reject application' })
  async review(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.service.reviewApplication(id, user.sub, dto);
  }
}
