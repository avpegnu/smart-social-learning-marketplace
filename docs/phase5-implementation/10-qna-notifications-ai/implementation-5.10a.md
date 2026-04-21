# Sub-phase 5.10a — Q&A FORUM MODULE

> Questions, Answers, Votes — Stack Overflow-style Q&A cho course-specific discussions.
> Prisma models: Question, Answer, Vote

---

## Step 1: Module Structure

```
src/modules/qna/
├── qna.module.ts
├── questions/
│   ├── questions.controller.ts
│   ├── questions.service.ts
│   └── questions.service.spec.ts
├── answers/
│   ├── answers.controller.ts
│   ├── answers.service.ts
│   └── answers.service.spec.ts
└── dto/
    ├── create-question.dto.ts
    ├── update-question.dto.ts
    ├── query-questions.dto.ts
    ├── create-answer.dto.ts
    ├── vote.dto.ts
    └── dto.validation.spec.ts
```

---

## Step 2: DTOs

### 2.1 create-question.dto.ts

```typescript
import { IsString, IsOptional, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CodeSnippetDto {
  @IsString()
  language!: string;

  @IsString()
  @MaxLength(5000)
  code!: string;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;
}
```

### 2.2 update-question.dto.ts

```typescript
export class UpdateQuestionDto {
  @IsOptional() @IsString() @MinLength(10) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MinLength(20) @MaxLength(5000)
  content?: string;

  @IsOptional() @ValidateNested() @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;
}
```

### 2.3 query-questions.dto.ts

```typescript
export class QueryQuestionsDto extends PaginationDto {
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() tagId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: 'all' | 'answered' | 'unanswered';
}
```

### 2.4 create-answer.dto.ts

```typescript
export class CreateAnswerDto {
  @IsString() @MinLength(10) @MaxLength(5000)
  content!: string;

  @IsOptional() @ValidateNested() @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;
}
```

### 2.5 vote.dto.ts

```typescript
export class VoteDto {
  @IsInt() @Min(-1) @Max(1)
  value!: number;  // +1 upvote, -1 downvote, 0 remove
}
```

---

## Step 3: QuestionsService

```typescript
const AUTHOR_SELECT = { id: true, fullName: true, avatarUrl: true } as const;

@Injectable()
export class QuestionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateQuestionDto) {
    return this.prisma.question.create({
      data: {
        title: dto.title,
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
        authorId,
        courseId: dto.courseId,
        tagId: dto.tagId,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        course: { select: { id: true, title: true } },
        tag: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(query: QueryQuestionsDto) {
    const where: Prisma.QuestionWhereInput = {
      ...(query.courseId && { courseId: query.courseId }),
      ...(query.tagId && { tagId: query.tagId }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          { content: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
      ...(query.status === 'answered' && { bestAnswerId: { not: null } }),
      ...(query.status === 'unanswered' && { bestAnswerId: null }),
    };

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          author: { select: AUTHOR_SELECT },
          course: { select: { id: true, title: true } },
          tag: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    const data = questions.map((q) => ({
      ...q,
      hasBestAnswer: !!q.bestAnswerId,
    }));

    return createPaginatedResult(data, total, query.page, query.limit);
  }

  async findById(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        author: { select: AUTHOR_SELECT },
        course: { select: { id: true, title: true } },
        tag: { select: { id: true, name: true } },
        answers: {
          include: {
            author: { select: AUTHOR_SELECT },
            _count: { select: { votes: true } },
          },
          orderBy: { voteCount: 'desc' },
        },
        bestAnswer: { include: { author: { select: AUTHOR_SELECT } } },
      },
    });

    if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

    // Increment view count (fire-and-forget)
    this.prisma.question.update({
      where: { id: questionId },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {/* ignore */});

    return question;
  }

  async findSimilar(title: string, limit = 5) {
    // Simple text search — full-text search optimization later
    return this.prisma.question.findMany({
      where: {
        title: { contains: title.split(' ').slice(0, 3).join(' '), mode: 'insensitive' },
      },
      select: { id: true, title: true, answerCount: true },
      take: limit,
    });
  }

  async update(questionId: string, userId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_QUESTION_OWNER' });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        title: dto.title,
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async delete(questionId: string, userId: string) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_QUESTION_OWNER' });
    }
    return this.prisma.question.delete({ where: { id: questionId } });
  }

  async markBestAnswer(questionId: string, answerId: string, userId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

    // Owner OR course instructor can mark best answer
    const isOwner = question.authorId === userId;
    const isInstructor = question.course?.instructorId === userId;
    if (!isOwner && !isInstructor) {
      throw new ForbiddenException({ code: 'NOT_AUTHORIZED_TO_MARK_BEST' });
    }

    // Verify answer belongs to this question
    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer || answer.questionId !== questionId) {
      throw new BadRequestException({ code: 'ANSWER_NOT_FOR_THIS_QUESTION' });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: { bestAnswerId: answerId },
    });
  }
}
```

**Key points:**
- `findById` increments viewCount fire-and-forget (`.catch(() => {})`)
- `findSimilar` uses simple contains search (first 3 words of title)
- `markBestAnswer` allows both question owner AND course instructor
- `findAll` supports status filter: answered (has bestAnswer) / unanswered

---

## Step 4: AnswersService

```typescript
@Injectable()
export class AnswersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(authorId: string, questionId: string, dto: CreateAnswerDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

    return this.prisma.$transaction(async (tx) => {
      const answer = await tx.answer.create({
        data: {
          content: dto.content,
          codeSnippet: dto.codeSnippet
            ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
            : undefined,
          authorId,
          questionId,
        },
        include: { author: { select: AUTHOR_SELECT } },
      });

      await tx.question.update({
        where: { id: questionId },
        data: { answerCount: { increment: 1 } },
      });

      return answer;
    });
  }

  async delete(answerId: string, userId: string) {
    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer || answer.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_ANSWER_OWNER' });
    }

    return this.prisma.$transaction(async (tx) => {
      // If this was best answer, unset it
      await tx.question.updateMany({
        where: { bestAnswerId: answerId },
        data: { bestAnswerId: null },
      });

      await tx.answer.delete({ where: { id: answerId } });

      await tx.question.update({
        where: { id: answer.questionId },
        data: { answerCount: { decrement: 1 } },
      });
    });
  }

  async vote(userId: string, answerId: string, value: number) {
    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer) throw new NotFoundException({ code: 'ANSWER_NOT_FOUND' });

    // Cannot vote on own answer
    if (answer.authorId === userId) {
      throw new BadRequestException({ code: 'CANNOT_VOTE_OWN_ANSWER' });
    }

    const existing = await this.prisma.vote.findUnique({
      where: { userId_answerId: { userId, answerId } },
    });

    if (value === 0 && existing) {
      // Remove vote
      await this.prisma.$transaction([
        this.prisma.vote.delete({ where: { id: existing.id } }),
        this.prisma.answer.update({
          where: { id: answerId },
          data: { voteCount: { decrement: existing.value } },
        }),
      ]);
      return { voteCount: answer.voteCount - existing.value, userVote: null };
    }

    if (existing) {
      if (existing.value === value) {
        // Same vote → remove (toggle off)
        await this.prisma.$transaction([
          this.prisma.vote.delete({ where: { id: existing.id } }),
          this.prisma.answer.update({
            where: { id: answerId },
            data: { voteCount: { decrement: value } },
          }),
        ]);
        return { voteCount: answer.voteCount - value, userVote: null };
      }

      // Different vote → change (swing by 2x)
      await this.prisma.$transaction([
        this.prisma.vote.update({ where: { id: existing.id }, data: { value } }),
        this.prisma.answer.update({
          where: { id: answerId },
          data: { voteCount: { increment: value * 2 } },
        }),
      ]);
      return { voteCount: answer.voteCount + value * 2, userVote: value };
    }

    // New vote
    await this.prisma.$transaction([
      this.prisma.vote.create({ data: { userId, answerId, value } }),
      this.prisma.answer.update({
        where: { id: answerId },
        data: { voteCount: { increment: value } },
      }),
    ]);
    return { voteCount: answer.voteCount + value, userVote: value };
  }
}
```

**Key points:**
- Vote returns `{ voteCount, userVote }` matching API doc
- Cannot vote on own answer
- value=0 explicitly removes vote
- Same value toggle: click upvote twice → remove
- Delete answer: unset bestAnswerId if this was best answer, decrement counter

---

## Step 5: Controllers

### QuestionsController

```typescript
@Controller('questions')
@ApiTags('Q&A')
@ApiBearerAuth()
export class QuestionsController {
  constructor(
    @Inject(QuestionsService) private readonly questionsService: QuestionsService,
  ) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionDto) {
    return this.questionsService.create(user.sub, dto);
  }

  @Get()
  async findAll(@Query() query: QueryQuestionsDto) {
    return this.questionsService.findAll(query);
  }

  @Get('similar')
  async findSimilar(@Query('title') title: string) {
    return this.questionsService.findSimilar(title);
  }

  @Public()
  @Get(':id')
  async findById(@Param('id', ParseCuidPipe) id: string) {
    return this.questionsService.findById(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.questionsService.delete(id, user.sub);
  }

  @Post(':id/answers')
  async createAnswer(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAnswerDto,
  ) {
    return this.answersService.create(user.sub, id, dto);
  }

  @Put(':id/best-answer')
  async markBestAnswer(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('answerId') answerId: string,
  ) {
    return this.questionsService.markBestAnswer(id, answerId, user.sub);
  }
}
```

### AnswersController

```typescript
@Controller('answers')
@ApiTags('Q&A')
@ApiBearerAuth()
export class AnswersController {
  constructor(@Inject(AnswersService) private readonly answersService: AnswersService) {}

  @Delete(':id')
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.answersService.delete(id, user.sub);
  }

  @Post(':id/vote')
  async vote(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: VoteDto,
  ) {
    return this.answersService.vote(user.sub, id, dto.value);
  }
}
```

---

## Step 6: Module & Registration

```typescript
@Module({
  controllers: [QuestionsController, AnswersController],
  providers: [QuestionsService, AnswersService],
  exports: [QuestionsService],
})
export class QnaModule {}
```

AppModule: `imports: [..., QnaModule]`

---

## Step 7: Verify

- [ ] Create question with courseId, tagId, codeSnippet
- [ ] List questions with filters (courseId, tagId, search, status)
- [ ] Question detail includes answers sorted by voteCount
- [ ] viewCount increments on detail view
- [ ] Find similar questions by title
- [ ] Update/delete question (owner only)
- [ ] Create answer with counter increment
- [ ] Delete answer: unset bestAnswer if needed, decrement counter
- [ ] Mark best answer: owner OR instructor
- [ ] Vote: upvote, downvote, toggle, change, remove
- [ ] Cannot vote on own answer
- [ ] Vote response includes voteCount + userVote
- [ ] `@Inject()` pattern, `!:` on DTOs, no `any`
- [ ] Build 0 errors, Lint 0 errors, Tests pass
