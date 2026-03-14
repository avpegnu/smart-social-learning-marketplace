import { Body, Controller, Delete, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AddCartItemDto } from './dto/add-cart-item.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MergeCartDto } from './dto/merge-cart.dto';

@Controller('cart')
@ApiTags('Cart')
@ApiBearerAuth()
export class CartController {
  constructor(
    @Inject(CartService) private readonly cartService: CartService,
    @Inject(CouponsService) private readonly couponsService: CouponsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get cart items' })
  async getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCart(user.sub);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  async addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.sub, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId', ParseCuidPipe) itemId: string,
  ) {
    return this.cartService.removeItem(user.sub, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear cart' })
  async clearCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.clearCart(user.sub);
  }

  @Post('merge')
  @ApiOperation({ summary: 'Merge localStorage cart after login' })
  async mergeCart(@CurrentUser() user: JwtPayload, @Body() dto: MergeCartDto) {
    return this.cartService.mergeCart(user.sub, dto.items);
  }

  @Post('apply-coupon')
  @ApiOperation({ summary: 'Preview coupon discount on cart' })
  async applyCoupon(@CurrentUser() user: JwtPayload, @Body('code') code: string) {
    const cart = await this.cartService.getCart(user.sub);
    const cartItems = cart.items.map((item) => ({
      courseId: item.courseId,
      price: item.price,
    }));

    const { discount } = await this.couponsService.validateAndCalculateDiscount(
      code,
      user.sub,
      cartItems,
    );

    return {
      coupon: { code },
      discount,
      subtotal: cart.subtotal,
      total: cart.subtotal - discount,
    };
  }
}
