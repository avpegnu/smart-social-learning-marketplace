import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  studentPortalUrl: process.env.STUDENT_PORTAL_URL || 'http://localhost:3001',
  managementPortalUrl: process.env.MANAGEMENT_PORTAL_URL || 'http://localhost:3002',
  isProduction: process.env.NODE_ENV === 'production',
}));
