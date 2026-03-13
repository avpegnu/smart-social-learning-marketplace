import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private resend: Resend;
  private fromEmail: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('resend.apiKey'));
    this.fromEmail = this.configService.get<string>('resend.fromEmail') || 'noreply@sslm.com';
  }

  async sendEmail({ to, subject, html }: SendEmailOptions) {
    return this.resend.emails.send({
      from: `SSLM <${this.fromEmail}>`,
      to,
      subject,
      html,
    });
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
