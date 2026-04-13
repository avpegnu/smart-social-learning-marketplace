import { apiClient } from '@shared/api-client';

export type ReportTargetType = 'POST' | 'COMMENT' | 'USER' | 'COURSE' | 'QUESTION' | 'ANSWER';

export interface CreateReportData {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string;
}

export const reportService = {
  create: (data: CreateReportData) => apiClient.post('/reports', data),
};
