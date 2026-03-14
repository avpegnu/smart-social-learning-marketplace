import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { Public } from '@/common/decorators';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SepayWebhookDto } from './dto/sepay-webhook.dto';

@Controller('webhooks')
@ApiTags('Webhooks')
export class WebhooksController {
  constructor(@Inject(WebhooksService) private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post('sepay')
  @ApiOperation({ summary: 'SePay payment webhook' })
  async handleSepay(
    @Headers('authorization') authorization: string,
    @Body() payload: SepayWebhookDto,
  ) {
    return this.webhooksService.handleSepayWebhook(authorization, payload);
  }
}
