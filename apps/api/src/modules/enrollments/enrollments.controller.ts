import { Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';

@Controller('enrollments')
@ApiTags('Enrollments')
@ApiBearerAuth()
export class EnrollmentsController {
  constructor(
    @Inject(EnrollmentsService) private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Get('check/:courseId')
  @ApiOperation({ summary: 'Check enrollment status for a course' })
  async checkEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.enrollmentsService.checkEnrollment(user.sub, courseId);
  }

  @Get('my-learning')
  @ApiOperation({ summary: 'Get my enrolled courses' })
  async getMyLearning(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.enrollmentsService.getMyLearning(user.sub, query);
  }

  @Post('free/:courseId')
  @ApiOperation({ summary: 'Enroll in a free course' })
  async enrollFree(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.enrollmentsService.enrollFree(user.sub, courseId);
  }
}
