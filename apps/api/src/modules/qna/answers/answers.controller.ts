import { Body, Controller, Delete, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnswersService } from './answers.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VoteDto } from '../dto/vote.dto';

@Controller('answers')
@ApiTags('Q&A')
@ApiBearerAuth()
export class AnswersController {
  constructor(
    @Inject(AnswersService)
    private readonly answersService: AnswersService,
  ) {}

  @Delete(':id')
  @ApiOperation({ summary: 'Delete answer (owner only)' })
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.answersService.delete(id, user.sub);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote on an answer' })
  async vote(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: VoteDto,
  ) {
    return this.answersService.vote(user.sub, id, dto.value);
  }
}
