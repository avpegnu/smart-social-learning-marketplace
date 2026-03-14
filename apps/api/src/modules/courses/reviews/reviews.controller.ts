import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryReviewsDto } from '../dto/query-reviews.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateReviewDto } from '../dto/create-review.dto';

@Controller('courses/:courseId/reviews')
@ApiTags('Reviews')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get course reviews (paginated)' })
  async findByCourse(
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Query() query: QueryReviewsDto,
  ) {
    return this.reviewsService.findByCourse(courseId, query);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review (requires enrollment + 30% progress)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.sub, courseId, dto);
  }

  @Patch(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own review' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseCuidPipe) reviewId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.update(user.sub, reviewId, dto);
  }

  @Delete(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own review' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseCuidPipe) reviewId: string,
  ) {
    return this.reviewsService.delete(user.sub, reviewId);
  }
}
