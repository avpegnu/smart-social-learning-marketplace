import { registerAs } from '@nestjs/config';

export const resendConfig = registerAs('resend', () => ({
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@sslm.com',
}));
