'use client';

import { useQuery } from '@tanstack/react-query';
import { certificateService } from '../services/certificate.service';
import { useAuthStore } from '../stores/auth-store';

// ── My Certificates ──

export function useMyCertificates() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['certificates', 'my'],
    queryFn: () => certificateService.getMy(),
    enabled: isAuthenticated,
  });
}
