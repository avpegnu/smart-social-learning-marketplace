import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { QuestionBanksService } from './question-banks.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateQuestionBankDto, UpdateQuestionBankDto } from './dto/create-question-bank.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateBankQuestionDto, BatchCreateBankQuestionsDto } from './dto/create-bank-question.dto';

@Controller('instructor/question-banks')
@ApiTags('Question Banks')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.INSTRUCTOR, Role.ADMIN)
export class QuestionBanksController {
  constructor(
    @Inject(QuestionBanksService)
    private readonly service: QuestionBanksService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a question bank' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionBankDto) {
    return this.service.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List question banks' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question bank detail with questions' })
  async findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update question bank name/description' })
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateQuestionBankDto,
  ) {
    return this.service.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete question bank' })
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.service.delete(id, user.sub);
    return { message: 'Question bank deleted' };
  }

  @Post(':id/questions')
  @ApiOperation({ summary: 'Add a question to bank' })
  async addQuestion(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBankQuestionDto,
  ) {
    return this.service.addQuestion(id, user.sub, dto);
  }

  @Post(':id/questions/batch')
  @ApiOperation({ summary: 'Add multiple questions to bank' })
  async addQuestionsBatch(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: BatchCreateBankQuestionsDto,
  ) {
    return this.service.addQuestionsBatch(id, user.sub, dto.questions);
  }

  @Patch(':id/questions/:questionId')
  @ApiOperation({ summary: 'Update a question in bank' })
  async updateQuestion(
    @Param('id', ParseCuidPipe) id: string,
    @Param('questionId', ParseCuidPipe) questionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBankQuestionDto,
  ) {
    return this.service.updateQuestion(id, questionId, user.sub, dto);
  }

  @Delete(':id/questions/:questionId')
  @ApiOperation({ summary: 'Delete a question from bank' })
  async deleteQuestion(
    @Param('id', ParseCuidPipe) id: string,
    @Param('questionId', ParseCuidPipe) questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.deleteQuestion(id, questionId, user.sub);
    return { message: 'Question deleted' };
  }
}
