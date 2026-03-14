import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreaksService } from './streaks.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@Controller('learning')
@ApiTags('Learning — Dashboard')
@ApiBearerAuth()
export class StreaksController {
  constructor(@Inject(StreaksService) private readonly streaksService: StreaksService) {}

  @Get('streak')
  @ApiOperation({ summary: 'Get current streak info' })
  async getStreak(@CurrentUser() user: JwtPayload) {
    return this.streaksService.getStreak(user.sub);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get learning dashboard' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.streaksService.getDashboard(user.sub);
  }
}
