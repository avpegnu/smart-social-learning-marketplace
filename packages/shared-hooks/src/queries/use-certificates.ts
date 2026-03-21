'use client';

import { useQuery } from '@tanstack/react-query';
import { certificateService } from '../services/certificate.service';

// ── My Certificates ──

export function useMyCertificates() {
  return useQuery({
    queryKey: ['certificates', 'my'],
    queryFn: () => certificateService.getMy(),
  });
}
