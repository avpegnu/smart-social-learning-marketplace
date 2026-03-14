import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order from cart (checkout)' })
  async createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get order history' })
  async getOrderHistory(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.ordersService.getOrderHistory(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail' })
  async findById(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.ordersService.findById(id, user.sub);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get order status (for payment page polling)' })
  async getOrderStatus(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.ordersService.getOrderStatus(id, user.sub);
  }
}
