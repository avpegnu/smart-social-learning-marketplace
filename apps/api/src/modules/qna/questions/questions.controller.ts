import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { AnswersService } from '../answers/answers.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateQuestionDto } from '../dto/create-question.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateQuestionDto } from '../dto/update-question.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryQuestionsDto } from '../dto/query-questions.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAnswerDto } from '../dto/create-answer.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MarkBestAnswerDto } from '../dto/mark-best-answer.dto';

@Controller('questions')
@ApiTags('Q&A')
export class QuestionsController {
  constructor(
    @Inject(QuestionsService)
    private readonly questionsService: QuestionsService,
    @Inject(AnswersService)
    private readonly answersService: AnswersService,
  ) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a question' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(user.sub, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List questions with filters' })
  async findAll(@Query() query: QueryQuestionsDto) {
    return this.questionsService.findAll(query);
  }

  @Public()
  @Get('similar')
  @ApiOperation({ summary: 'Find similar questions' })
  async findSimilar(@Query('title') title: string) {
    return this.questionsService.findSimilar(title);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get question detail with answers' })
  async findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return this.questionsService.findById(id, user?.sub);
  }

  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update question (owner only)' })
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete question (owner only)' })
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.questionsService.delete(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/answers')
  @ApiOperation({ summary: 'Post an answer' })
  async createAnswer(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAnswerDto,
  ) {
    return this.answersService.create(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @Put(':id/best-answer')
  @ApiOperation({ summary: 'Mark best answer (owner/instructor)' })
  async markBestAnswer(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: MarkBestAnswerDto,
  ) {
    return this.questionsService.markBestAnswer(id, dto.answerId, user.sub);
  }
}
