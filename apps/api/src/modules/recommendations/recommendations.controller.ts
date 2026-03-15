import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryRecommendationsDto } from './dto/query-recommendations.dto';

@Controller('recommendations')
@ApiTags('Recommendations')
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly service: RecommendationsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get course recommendations' })
  async getRecommendations(
    @CurrentUser() user: JwtPayload | undefined,
    @Query() query: QueryRecommendationsDto,
  ) {
    return this.service.getRecommendations(user?.sub ?? null, query);
  }
}
