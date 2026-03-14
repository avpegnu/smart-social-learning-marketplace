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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChaptersService } from './chapters.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateChapterDto, UpdateChapterDto } from '../dto/create-chapter.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReorderDto } from '../dto/reorder.dto';

@Controller('instructor/courses/:courseId/sections/:sectionId/chapters')
@ApiTags('Instructor — Chapters')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class ChaptersController {
  constructor(@Inject(ChaptersService) private readonly chaptersService: ChaptersService) {}

  @Post()
  @ApiOperation({ summary: 'Create chapter' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chaptersService.create(courseId, sectionId, user.sub, dto);
  }

  @Patch(':chapterId')
  @ApiOperation({ summary: 'Update chapter' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chaptersService.update(courseId, chapterId, user.sub, dto);
  }

  @Delete(':chapterId')
  @ApiOperation({ summary: 'Delete chapter' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
  ) {
    return this.chaptersService.delete(courseId, chapterId, user.sub);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder chapters in section' })
  async reorder(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.chaptersService.reorder(courseId, sectionId, user.sub, dto.orderedIds);
  }
}
