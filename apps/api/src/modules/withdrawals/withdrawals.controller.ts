import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Controller('instructor/withdrawals')
@ApiTags('Instructor — Withdrawals')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class WithdrawalsController {
  constructor(
    @Inject(WithdrawalsService) private readonly withdrawalsService: WithdrawalsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Request withdrawal' })
  async requestWithdrawal(@CurrentUser() user: JwtPayload, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalsService.requestWithdrawal(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get withdrawal history' })
  async getWithdrawalHistory(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.withdrawalsService.getWithdrawalHistory(user.sub, query);
  }
}
