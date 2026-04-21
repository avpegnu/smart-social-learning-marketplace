import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { InteractionsService } from '../interactions/interactions.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';

@Controller()
@ApiTags('Feed')
@ApiBearerAuth()
export class FeedController {
  constructor(
    @Inject(FeedService) private readonly feedService: FeedService,
    @Inject(InteractionsService)
    private readonly interactionsService: InteractionsService,
  ) {}

  @Public()
  @Get('feed/trending')
  @ApiOperation({ summary: 'Get top 5 trending posts (last 7 days)' })
  async getTrending() {
    return this.feedService.getTrending();
  }

  @Public()
  @Get('feed/public')
  @ApiOperation({ summary: 'Get public feed (all posts, no auth required)' })
  async getPublicFeed(@CurrentUser() user: JwtPayload | undefined, @Query() query: PaginationDto) {
    return this.feedService.getPublicFeed(user?.sub, query);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get personal news feed' })
  async getFeed(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.feedService.getFeed(user.sub, query);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'Get bookmarked posts' })
  async getBookmarks(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.interactionsService.getBookmarks(user.sub, query);
  }
}
