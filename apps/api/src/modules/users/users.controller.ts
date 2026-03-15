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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// Value imports — ValidationPipe needs runtime class reference (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProfileDto } from './dto/update-profile.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiBearerAuth()
  @Put('me/notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.sub, dto.preferences);
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get public user profile' })
  async getPublicProfile(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return this.usersService.getPublicProfile(id, user?.sub);
  }

  // ==================== FOLLOW SYSTEM (Authenticated) ====================

  @ApiBearerAuth()
  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a user' })
  async follow(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.usersService.follow(user.sub, id);
  }

  @ApiBearerAuth()
  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  async unfollow(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.usersService.unfollow(user.sub, id);
  }

  // ==================== PUBLIC LISTS ====================

  @Public()
  @Get(':id/followers')
  @ApiOperation({ summary: 'Get followers list' })
  async getFollowers(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: PaginationDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usersService.getFollowers(id, query, user?.sub);
  }

  @Public()
  @Get(':id/following')
  @ApiOperation({ summary: 'Get following list' })
  async getFollowing(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: PaginationDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usersService.getFollowing(id, query, user?.sub);
  }
}
