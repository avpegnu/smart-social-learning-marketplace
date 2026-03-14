import { Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';

@Controller('wishlists')
@ApiTags('Wishlists')
@ApiBearerAuth()
export class WishlistController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get wishlist' })
  async getWishlist(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.cartService.getWishlist(user.sub, query);
  }

  @Post(':courseId')
  @ApiOperation({ summary: 'Add course to wishlist' })
  async addToWishlist(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.cartService.addToWishlist(user.sub, courseId);
  }

  @Delete(':courseId')
  @ApiOperation({ summary: 'Remove course from wishlist' })
  async removeFromWishlist(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.cartService.removeFromWishlist(user.sub, courseId);
  }
}
