import { Controller, Get, Patch, Param, Query, Body, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewWithdrawalDto } from '../dto/review-withdrawal.dto';

@Controller('admin/withdrawals')
@ApiTags('Admin — Withdrawals')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminWithdrawalsController {
  constructor(
    @Inject(AdminWithdrawalsService)
    private readonly service: AdminWithdrawalsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List pending withdrawals' })
  async getPending(@Query() query: PaginationDto) {
    return this.service.getPendingWithdrawals(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve or reject withdrawal' })
  async process(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.service.processWithdrawal(id, user.sub, dto);
  }
}
