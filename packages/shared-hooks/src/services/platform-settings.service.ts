import { apiClient } from '@shared/api-client';

export interface PublicPlatformSettings {
  minimumWithdrawal: number;
  defaultCommissionRate: number;
  allowFreeCourses: boolean;
  autoApproveCourses: boolean;
}

export const platformSettingsService = {
  getPublic: () => apiClient.get<PublicPlatformSettings>('/platform-settings'),
};
