import { Module } from '@nestjs/common';
import { CouponsModule } from '@/modules/coupons/coupons.module';
import { CartController } from './cart.controller';
import { WishlistController } from './wishlist.controller';
import { CartService } from './cart.service';

@Module({
  imports: [CouponsModule],
  controllers: [CartController, WishlistController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
