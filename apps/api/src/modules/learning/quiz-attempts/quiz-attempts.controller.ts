import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuizAttemptsService } from './quiz-attempts.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SubmitQuizDto } from '../dto/submit-quiz.dto';

@Controller('learning/lessons/:lessonId/quiz')
@ApiTags('Learning — Quiz')
@ApiBearerAuth()
export class QuizAttemptsController {
  constructor(
    @Inject(QuizAttemptsService) private readonly quizAttemptsService: QuizAttemptsService,
  ) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit quiz answers' })
  async submitQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizAttemptsService.submitQuiz(user.sub, lessonId, dto);
  }

  @Get('attempts')
  @ApiOperation({ summary: 'Get my quiz attempts' })
  async getAttempts(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.quizAttemptsService.getAttempts(user.sub, lessonId);
  }
}
