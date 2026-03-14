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
import { SectionsService } from './sections.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateSectionDto, UpdateSectionDto } from '../dto/create-section.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReorderDto } from '../dto/reorder.dto';

@Controller('instructor/courses/:courseId/sections')
@ApiTags('Instructor — Sections')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class SectionsController {
  constructor(@Inject(SectionsService) private readonly sectionsService: SectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create section' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(courseId, user.sub, dto);
  }

  @Patch(':sectionId')
  @ApiOperation({ summary: 'Update section' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(courseId, sectionId, user.sub, dto);
  }

  @Delete(':sectionId')
  @ApiOperation({ summary: 'Delete section' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
  ) {
    return this.sectionsService.delete(courseId, sectionId, user.sub);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder sections' })
  async reorder(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.sectionsService.reorder(courseId, user.sub, dto.orderedIds);
  }
}
