import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursePlayerService } from './course-player.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';

@Controller('courses/:courseId/learn')
@ApiTags('Course Player')
@ApiBearerAuth()
export class CoursePlayerController {
  constructor(
    @Inject(CoursePlayerService) private readonly coursePlayerService: CoursePlayerService,
  ) {}

  @Get(':lessonId')
  @ApiOperation({ summary: 'Get lesson content for course player' })
  async getLesson(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.coursePlayerService.getLesson(user.sub, courseId, lessonId);
  }
}
