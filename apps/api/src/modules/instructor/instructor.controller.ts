import { Body, Controller, Get, Inject, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstructorService } from './instructor.service';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// Value imports — ValidationPipe needs runtime class reference (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateApplicationDto } from './dto/create-application.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';

@Controller('instructor')
@ApiTags('Instructor')
@ApiBearerAuth()
@UseGuards(RolesGuard)
export class InstructorController {
  constructor(@Inject(InstructorService) private readonly instructorService: InstructorService) {}

  // ==================== APPLICATION (Student only) ====================

  @Post('applications')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit instructor application' })
  async submitApplication(@CurrentUser() user: JwtPayload, @Body() dto: CreateApplicationDto) {
    return this.instructorService.submitApplication(user.sub, dto);
  }

  @Get('applications/me')
  @ApiOperation({ summary: 'Check application status' })
  async getApplicationStatus(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getApplicationStatus(user.sub);
  }

  // ==================== PROFILE (Instructor only) ====================

  @Get('profile')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get instructor profile' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getProfile(user.sub);
  }

  @Patch('profile')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Update instructor profile' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateInstructorProfileDto) {
    return this.instructorService.updateProfile(user.sub, dto);
  }

  // ==================== DASHBOARD (Instructor only) ====================

  @Get('dashboard')
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get instructor dashboard stats' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.instructorService.getDashboard(user.sub);
  }
}
