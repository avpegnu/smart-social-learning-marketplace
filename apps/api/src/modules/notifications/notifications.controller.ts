import { Controller, Get, Inject, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly service: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  async getNotifications(@CurrentUser() user: JwtPayload, @Query() query: QueryNotificationsDto) {
    return this.service.getNotifications(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.service.getUnreadCount(user.sub);
    return { count };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllAsRead(user.sub);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markAsRead(user.sub, id);
  }
}
