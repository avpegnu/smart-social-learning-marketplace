import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CourseManagementService } from './course-management.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryCoursesDto } from '../dto/query-courses.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCourseDto } from '../dto/create-course.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateCourseDto } from '../dto/update-course.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateTagsDto } from '../dto/update-tags.dto';

@Controller('instructor/courses')
@ApiTags('Instructor — Courses')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class CourseManagementController {
  constructor(
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List instructor courses' })
  async getInstructorCourses(@CurrentUser() user: JwtPayload, @Query() query: QueryCoursesDto) {
    return this.courseManagement.getInstructorCourses(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail for editing (any status)' })
  async findById(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.courseManagement.findById(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new course' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCourseDto) {
    return this.courseManagement.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update course info' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courseManagement.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete course' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.courseManagement.softDelete(id, user.sub);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit course for admin review' })
  async submitForReview(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.courseManagement.submitForReview(id, user.sub);
  }

  @Put(':id/tags')
  @ApiOperation({ summary: 'Update course tags' })
  async updateTags(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateTagsDto,
  ) {
    return this.courseManagement.updateTags(id, user.sub, dto.tagIds);
  }
}
