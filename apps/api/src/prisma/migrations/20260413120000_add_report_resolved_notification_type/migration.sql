-- Add REPORT_RESOLVED notification type for notifying reporters about report outcomes

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_RESOLVED';
