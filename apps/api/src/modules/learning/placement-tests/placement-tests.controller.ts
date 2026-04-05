import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlacementTestsService } from './placement-tests.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SubmitPlacementDto } from '../dto/submit-placement.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StartPlacementTestDto } from '../dto/start-placement-test.dto';

@Controller('placement-tests')
@ApiTags('Placement Tests')
export class PlacementTestsController {
  constructor(
    @Inject(PlacementTestsService) private readonly placementTestsService: PlacementTestsService,
  ) {}

  @Public()
  @Post('start')
  @ApiOperation({ summary: 'Start placement test by category' })
  async startTest(@Body() dto: StartPlacementTestDto) {
    return this.placementTestsService.startTest(dto.categoryId);
  }

  @ApiBearerAuth()
  @Post('submit')
  @ApiOperation({ summary: 'Submit placement test answers' })
  async submitTest(@CurrentUser() user: JwtPayload, @Body() dto: SubmitPlacementDto) {
    return this.placementTestsService.submitTest(user.sub, dto);
  }
}
