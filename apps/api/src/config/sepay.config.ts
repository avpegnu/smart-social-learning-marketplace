import { registerAs } from '@nestjs/config';

export const sepayConfig = registerAs('sepay', () => ({
  webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
  bankAccountName: process.env.BANK_ACCOUNT_NAME,
}));
