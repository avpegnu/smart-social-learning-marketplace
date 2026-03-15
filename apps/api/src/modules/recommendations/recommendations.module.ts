import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { ContentBasedService } from './algorithms/content-based.service';
import { CollaborativeService } from './algorithms/collaborative.service';
import { PopularityService } from './algorithms/popularity.service';

@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService, ContentBasedService, CollaborativeService, PopularityService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
