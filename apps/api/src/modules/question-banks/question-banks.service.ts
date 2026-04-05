import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { CreateQuestionBankDto, UpdateQuestionBankDto } from './dto/create-question-bank.dto';
import type { CreateBankQuestionDto } from './dto/create-bank-question.dto';
import type { CreateBankTagDto, UpdateBankTagDto } from './dto/bank-tag.dto';

@Injectable()
export class QuestionBanksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(instructorId: string, dto: CreateQuestionBankDto) {
    return this.prisma.questionBank.create({
      data: { ...dto, instructorId },
    });
  }

  async findAll(instructorId: string, query: { page?: number; limit?: number; search?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = {
      instructorId,
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' as const } }),
    };

    const [banks, total] = await Promise.all([
      this.prisma.questionBank.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.questionBank.count({ where }),
    ]);

    return createPaginatedResult(banks, total, page, limit);
  }

  async findById(bankId: string, instructorId: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id: bankId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
        tags: { orderBy: { name: 'asc' } },
      },
    });

    if (!bank) throw new NotFoundException({ code: 'QUESTION_BANK_NOT_FOUND' });
    if (bank.instructorId !== instructorId) {
      throw new ForbiddenException({ code: 'NOT_BANK_OWNER' });
    }

    return bank;
  }

  async update(bankId: string, instructorId: string, dto: UpdateQuestionBankDto) {
    await this.verifyOwnership(bankId, instructorId);
    return this.prisma.questionBank.update({
      where: { id: bankId },
      data: dto,
    });
  }

  async delete(bankId: string, instructorId: string) {
    await this.verifyOwnership(bankId, instructorId);
    await this.prisma.questionBank.delete({ where: { id: bankId } });
  }

  async addQuestion(bankId: string, instructorId: string, dto: CreateBankQuestionDto) {
    await this.verifyOwnership(bankId, instructorId);
    this.validateOneCorrectOption(dto);

    const lastQuestion = await this.prisma.questionBankItem.findFirst({
      where: { bankId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.questionBankItem.create({
        data: {
          bankId,
          question: dto.question,
          explanation: dto.explanation,
          difficulty: dto.difficulty ?? null,
          tagIds: dto.tagIds ?? [],
          order: (lastQuestion?.order ?? -1) + 1,
          options: {
            create: dto.options.map((opt, i) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: i,
            })),
          },
        },
        include: { options: true },
      });

      await tx.questionBank.update({
        where: { id: bankId },
        data: { questionCount: { increment: 1 } },
      });

      return question;
    });
  }

  async addQuestionsBatch(
    bankId: string,
    instructorId: string,
    questions: CreateBankQuestionDto[],
  ) {
    await this.verifyOwnership(bankId, instructorId);
    questions.forEach((q) => this.validateOneCorrectOption(q));

    const lastQuestion = await this.prisma.questionBankItem.findFirst({
      where: { bankId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    let nextOrder = (lastQuestion?.order ?? -1) + 1;

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const dto of questions) {
        const question = await tx.questionBankItem.create({
          data: {
            bankId,
            question: dto.question,
            explanation: dto.explanation,
            difficulty: dto.difficulty ?? null,
            tagIds: dto.tagIds ?? [],
            order: nextOrder++,
            options: {
              create: dto.options.map((opt, i) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                order: i,
              })),
            },
          },
          include: { options: true },
        });
        created.push(question);
      }

      await tx.questionBank.update({
        where: { id: bankId },
        data: { questionCount: { increment: questions.length } },
      });

      return created;
    });
  }

  async updateQuestion(
    bankId: string,
    questionId: string,
    instructorId: string,
    dto: CreateBankQuestionDto,
  ) {
    await this.verifyOwnership(bankId, instructorId);
    this.validateOneCorrectOption(dto);

    const existing = await this.prisma.questionBankItem.findFirst({
      where: { id: questionId, bankId },
    });
    if (!existing) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

    // Delete old options and create new ones
    await this.prisma.questionBankOption.deleteMany({ where: { questionId } });

    return this.prisma.questionBankItem.update({
      where: { id: questionId },
      data: {
        question: dto.question,
        explanation: dto.explanation,
        difficulty: dto.difficulty ?? null,
        tagIds: dto.tagIds ?? [],
        options: {
          create: dto.options.map((opt, i) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: i,
          })),
        },
      },
      include: { options: true },
    });
  }

  async deleteQuestion(bankId: string, questionId: string, instructorId: string) {
    await this.verifyOwnership(bankId, instructorId);

    const existing = await this.prisma.questionBankItem.findFirst({
      where: { id: questionId, bankId },
    });
    if (!existing) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });

    await this.prisma.$transaction([
      this.prisma.questionBankItem.delete({ where: { id: questionId } }),
      this.prisma.questionBank.update({
        where: { id: bankId },
        data: { questionCount: { decrement: 1 } },
      }),
    ]);
  }

  // ── Bank Tag CRUD ──

  async getTags(bankId: string, instructorId: string) {
    await this.verifyOwnership(bankId, instructorId);
    return this.prisma.questionBankTag.findMany({
      where: { bankId },
      orderBy: { name: 'asc' },
    });
  }

  async createTag(bankId: string, instructorId: string, dto: CreateBankTagDto) {
    await this.verifyOwnership(bankId, instructorId);
    return this.prisma.questionBankTag.create({
      data: { bankId, name: dto.name.trim() },
    });
  }

  async updateTag(bankId: string, tagId: string, instructorId: string, dto: UpdateBankTagDto) {
    await this.verifyOwnership(bankId, instructorId);
    const tag = await this.prisma.questionBankTag.findFirst({
      where: { id: tagId, bankId },
    });
    if (!tag) throw new NotFoundException({ code: 'BANK_TAG_NOT_FOUND' });
    return this.prisma.questionBankTag.update({
      where: { id: tagId },
      data: { name: dto.name.trim() },
    });
  }

  async deleteTag(bankId: string, tagId: string, instructorId: string) {
    await this.verifyOwnership(bankId, instructorId);
    const tag = await this.prisma.questionBankTag.findFirst({
      where: { id: tagId, bankId },
    });
    if (!tag) throw new NotFoundException({ code: 'BANK_TAG_NOT_FOUND' });

    await this.prisma.$transaction([
      this.prisma.questionBankTag.delete({ where: { id: tagId } }),
      this.prisma.$executeRaw`
        UPDATE question_bank_items
        SET tag_ids = array_remove(tag_ids, ${tagId})
        WHERE bank_id = ${bankId} AND ${tagId} = ANY(tag_ids)
      `,
    ]);
  }

  private async verifyOwnership(bankId: string, instructorId: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id: bankId },
      select: { instructorId: true },
    });
    if (!bank) throw new NotFoundException({ code: 'QUESTION_BANK_NOT_FOUND' });
    if (bank.instructorId !== instructorId) {
      throw new ForbiddenException({ code: 'NOT_BANK_OWNER' });
    }
  }

  private validateOneCorrectOption(dto: CreateBankQuestionDto) {
    const correctCount = dto.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException({ code: 'EXACTLY_ONE_CORRECT_OPTION' });
    }
  }
}
