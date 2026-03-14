import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCouponDto } from './dto/create-coupon.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Controller('instructor/coupons')
@ApiTags('Instructor — Coupons')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class CouponsController {
  constructor(@Inject(CouponsService) private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a coupon' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCouponDto) {
    return this.couponsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List instructor coupons' })
  async getInstructorCoupons(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.couponsService.getInstructorCoupons(user.sub, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update coupon' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate coupon (soft delete)' })
  async deactivate(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.couponsService.deactivate(id, user.sub);
  }
}
