import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.smtpHost'),
      port: this.configService.get<number>('mail.smtpPort'),
      secure: false,
      auth: {
        user: this.configService.get<string>('mail.smtpUser'),
        pass: this.configService.get<string>('mail.smtpPass'),
      },
    });
    this.fromEmail = this.configService.get<string>('mail.fromEmail') || '';
  }

  async sendEmail({ to, subject, html }: SendEmailOptions) {
    try {
      const result = await this.transporter.sendMail({
        from: `SSLM <${this.fromEmail}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${result.messageId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, (error as Error).message);
      throw error;
    }
  }

  async sendVerificationEmail(to: string, token: string) {
    const verifyUrl = `${this.configService.get('app.studentPortalUrl')}/auth/verify-email?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Verify your email — SSLM',
      html: `
        <h2>Welcome to Smart Social Learning Marketplace!</h2>
        <p>Click the link below to verify your email:</p>
        <a href="${verifyUrl}">${verifyUrl}</a>
        <p>This link expires in 24 hours.</p>
      `,
    });
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const resetUrl = `${this.configService.get('app.studentPortalUrl')}/auth/reset-password?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Reset your password — SSLM',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 1 hour.</p>
      `,
    });
  }

  async sendOrderReceiptEmail(to: string, orderId: string, totalAmount: number) {
    return this.sendEmail({
      to,
      subject: `Order Confirmation #${orderId} — SSLM`,
      html: `
        <h2>Order Confirmed!</h2>
        <p>Order ID: ${orderId}</p>
        <p>Total: ${totalAmount.toLocaleString('vi-VN')}đ</p>
      `,
    });
  }
}
