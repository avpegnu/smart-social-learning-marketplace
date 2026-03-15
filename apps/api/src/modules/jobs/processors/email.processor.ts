import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MailService } from '@/mail/mail.service';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(@Inject(MailService) private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing email job: ${job.name}`);

    switch (job.name) {
      case 'verification':
        await this.mailService.sendVerificationEmail(job.data.to, job.data.token);
        break;
      case 'reset-password':
        await this.mailService.sendResetPasswordEmail(job.data.to, job.data.token);
        break;
      case 'order-receipt':
        await this.mailService.sendOrderReceiptEmail(
          job.data.to,
          job.data.orderId,
          job.data.amount,
        );
        break;
      default:
        this.logger.warn(`Unknown email job type: ${job.name}`);
    }
  }
}
