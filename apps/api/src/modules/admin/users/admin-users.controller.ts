import { Controller, Get, Patch, Param, Query, Body, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { AdminUsersService } from './admin-users.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryAdminUsersDto } from '../dto/query-admin-users.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';

@Controller('admin/users')
@ApiTags('Admin — Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(
    @Inject(AdminUsersService)
    private readonly service: AdminUsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users with filters' })
  async getUsers(@Query() query: QueryAdminUsersDto) {
    return this.service.getUsers(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user status (suspend/activate)' })
  async updateStatus(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateUserStatusDto) {
    return this.service.updateUserStatus(id, dto);
  }
}
