import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateLessonDto, UpdateLessonDto } from '../dto/create-lesson.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReorderDto } from '../dto/reorder.dto';

@Controller('instructor/courses/:courseId/chapters/:chapterId/lessons')
@ApiTags('Instructor — Lessons')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
@SkipThrottle()
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessonsService: LessonsService) {}

  @Post()
  @ApiOperation({ summary: 'Create lesson' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(courseId, chapterId, user.sub, dto);
  }

  @Patch(':lessonId')
  @ApiOperation({ summary: 'Update lesson' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(courseId, lessonId, user.sub, dto);
  }

  @Delete(':lessonId')
  @ApiOperation({ summary: 'Delete lesson' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.lessonsService.delete(courseId, lessonId, user.sub);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder lessons in chapter' })
  async reorder(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.lessonsService.reorder(courseId, chapterId, user.sub, dto.orderedIds);
  }
}
