import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProgressDto } from '../dto/update-progress.dto';

@Controller('learning')
@ApiTags('Learning — Progress')
@ApiBearerAuth()
export class ProgressController {
  constructor(@Inject(ProgressService) private readonly progressService: ProgressService) {}

  @Put('progress/:lessonId')
  @ApiOperation({ summary: 'Update video lesson progress (segments)' })
  async updateProgress(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.progressService.updateLessonProgress(user.sub, lessonId, dto);
  }

  @Post('lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Mark text lesson as completed' })
  async completeLesson(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.progressService.completeLesson(user.sub, lessonId);
  }

  @Get('progress/:courseId')
  @ApiOperation({ summary: 'Get course progress with lesson statuses' })
  async getCourseProgress(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.progressService.getCourseProgress(user.sub, courseId);
  }
}
