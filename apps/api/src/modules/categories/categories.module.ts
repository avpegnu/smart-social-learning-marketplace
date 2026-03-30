import { Module } from '@nestjs/common';
import { CategoriesController, TagsController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController, TagsController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
