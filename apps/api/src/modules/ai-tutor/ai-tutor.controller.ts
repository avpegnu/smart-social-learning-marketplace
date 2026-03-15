import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiTutorService } from './ai-tutor.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AskQuestionDto } from './dto/ask-question.dto';

@Controller('ai/tutor')
@ApiTags('AI Tutor')
@ApiBearerAuth()
export class AiTutorController {
  constructor(
    @Inject(AiTutorService)
    private readonly service: AiTutorService,
  ) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask AI tutor a question (RAG)' })
  async ask(@CurrentUser() user: JwtPayload, @Body() dto: AskQuestionDto) {
    return this.service.askQuestion(user.sub, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List AI chat sessions' })
  async getSessions(@CurrentUser() user: JwtPayload, @Query('courseId') courseId?: string) {
    return this.service.getSessions(user.sub, courseId);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get session message history' })
  async getSessionMessages(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getSessionMessages(id, user.sub);
  }
}
