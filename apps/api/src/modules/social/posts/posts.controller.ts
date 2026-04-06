import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PostsService } from './posts.service';
import { CommentsService } from '../comments/comments.service';
import { InteractionsService } from '../interactions/interactions.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreatePostDto } from '../dto/create-post.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdatePostDto } from '../dto/update-post.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCommentDto } from '../dto/create-comment.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SharePostDto } from '../dto/share-post.dto';

@Controller('posts')
@ApiTags('Posts')
export class PostsController {
  constructor(
    @Inject(PostsService) private readonly postsService: PostsService,
    @Inject(CommentsService)
    private readonly commentsService: CommentsService,
    @Inject(InteractionsService)
    private readonly interactionsService: InteractionsService,
  ) {}

  @ApiBearerAuth()
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a new post' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.sub, dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get post detail' })
  async findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return this.postsService.findById(id, user?.sub);
  }

  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update post (owner only)' })
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete post (owner only)' })
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.postsService.delete(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/share')
  @ApiOperation({ summary: 'Share a post' })
  async share(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SharePostDto,
  ) {
    return this.postsService.share(user.sub, id, dto.content);
  }

  @ApiBearerAuth()
  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like on a post' })
  async toggleLike(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.interactionsService.toggleLike(user.sub, id);
  }

  @ApiBearerAuth()
  @Post(':id/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark on a post' })
  async toggleBookmark(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.interactionsService.toggleBookmark(user.sub, id);
  }

  @Public()
  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  async getComments(@Param('id', ParseCuidPipe) id: string, @Query() query: PaginationDto) {
    return this.commentsService.getByPost(id, query);
  }

  @ApiBearerAuth()
  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a post' })
  async addComment(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @Delete(':postId/comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment (owner only)' })
  async deleteComment(
    @Param('postId', ParseCuidPipe) postId: string,
    @Param('commentId', ParseCuidPipe) commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.delete(commentId, user.sub, postId);
  }
}
