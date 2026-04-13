import { useQuery } from '@tanstack/react-query';
import { platformSettingsService } from '../services/platform-settings.service';

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => platformSettingsService.getPublic(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
