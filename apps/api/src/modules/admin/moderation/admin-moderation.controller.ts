import { Controller, Delete, Param, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { AdminModerationService } from './admin-moderation.service';

@Controller('admin/moderation')
@ApiTags('Admin — Moderation')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminModerationController {
  constructor(
    @Inject(AdminModerationService)
    private readonly moderation: AdminModerationService,
  ) {}

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Admin soft-delete a post' })
  async deletePost(@Param('id', ParseCuidPipe) id: string) {
    return this.moderation.deletePost(id);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Admin soft-delete a comment' })
  async deleteComment(@Param('id', ParseCuidPipe) id: string) {
    return this.moderation.deleteComment(id);
  }

  @Delete('questions/:id')
  @ApiOperation({ summary: 'Admin soft-delete a question' })
  async deleteQuestion(@Param('id', ParseCuidPipe) id: string) {
    return this.moderation.deleteQuestion(id);
  }

  @Delete('answers/:id')
  @ApiOperation({ summary: 'Admin soft-delete an answer' })
  async deleteAnswer(@Param('id', ParseCuidPipe) id: string) {
    return this.moderation.deleteAnswer(id);
  }
}
