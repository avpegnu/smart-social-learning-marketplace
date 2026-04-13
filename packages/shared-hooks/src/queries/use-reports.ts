'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reportService } from '../services/report.service';
import type { CreateReportData } from '../services/report.service';
import { useApiError } from '../use-api-error';

export function useCreateReport() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreateReportData) => reportService.create(data),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
