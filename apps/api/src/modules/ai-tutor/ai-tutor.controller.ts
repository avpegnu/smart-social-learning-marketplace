import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AiTutorService } from './ai-tutor.service';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { CurrentUser, Roles } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Role } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AskQuestionDto } from './dto/ask-question.dto';

@Controller('ai/tutor')
@ApiTags('AI Tutor')
@ApiBearerAuth()
export class AiTutorController {
  constructor(
    @Inject(AiTutorService)
    private readonly service: AiTutorService,
    @Inject(EmbeddingsService)
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask AI tutor a question (RAG)' })
  async ask(@CurrentUser() user: JwtPayload, @Body() dto: AskQuestionDto) {
    return this.service.askQuestion(user.sub, dto);
  }

  @Post('ask-stream')
  @ApiOperation({ summary: 'Ask AI tutor with SSE streaming response' })
  async askStream(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AskQuestionDto,
    @Req() req: { setTimeout: (ms: number) => void },
    @Res() res: Response,
  ) {
    // Disable request timeout for long-running SSE stream
    req.setTimeout(0);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.service.askQuestionStream(user.sub, dto)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error: unknown) {
      const code =
        error instanceof Object && 'getResponse' in error
          ? ((error as { getResponse: () => { code?: string } }).getResponse().code ??
            'INTERNAL_ERROR')
          : 'INTERNAL_ERROR';
      res.write(`data: ${JSON.stringify({ type: 'error', code })}\n\n`);
    }

    res.end();
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get remaining daily AI quota' })
  async getQuota(@CurrentUser() user: JwtPayload) {
    return this.service.getQuota(user.sub);
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

  @Post('index/:courseId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INSTRUCTOR)
  @ApiOperation({ summary: 'Index course content for AI Tutor (admin/instructor)' })
  async indexCourse(@Param('courseId', ParseCuidPipe) courseId: string) {
    await this.embeddingsService.indexCourseContent(courseId);
    return { message: 'Course indexed successfully' };
  }
}
