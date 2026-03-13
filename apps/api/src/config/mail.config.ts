import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
}));
