import { Controller, Get, Patch, Param, Query, Body, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { AdminCoursesService } from './admin-courses.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewCourseDto } from '../dto/review-course.dto';

@Controller('admin/courses')
@ApiTags('Admin — Courses')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminCoursesController {
  constructor(
    @Inject(AdminCoursesService)
    private readonly service: AdminCoursesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all courses (admin)' })
  async getAll(@Query() query: PaginationDto) {
    return this.service.getAllCourses(query);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List courses pending review' })
  async getPending(@Query() query: PaginationDto) {
    return this.service.getPendingCourses(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail (admin — no ownership check)' })
  async getDetail(@Param('id', ParseCuidPipe) id: string) {
    return this.service.getCourseDetail(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Approve or reject course' })
  async review(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewCourseDto,
  ) {
    return this.service.reviewCourse(id, user.sub, dto);
  }
}
