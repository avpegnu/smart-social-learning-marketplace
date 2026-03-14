import { Body, Controller, Delete, Get, Inject, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateQuizDto } from '../dto/create-quiz.dto';

@Controller('instructor/courses/:courseId/lessons/:lessonId/quiz')
@ApiTags('Instructor — Quizzes')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class QuizzesController {
  constructor(@Inject(QuizzesService) private readonly quizzesService: QuizzesService) {}

  @Put()
  @ApiOperation({ summary: 'Create or update quiz for lesson' })
  async upsert(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: CreateQuizDto,
  ) {
    return this.quizzesService.upsertQuiz(courseId, lessonId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get quiz for lesson' })
  async get(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.quizzesService.getQuiz(courseId, lessonId, user.sub);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete quiz' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.quizzesService.deleteQuiz(courseId, lessonId, user.sub);
  }
}
