'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { placementService } from '../services/placement.service';
import type { PlacementAnswer } from '../services/placement.service';

export function useStartPlacement() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (categoryId?: string) => placementService.startTest(categoryId),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useSubmitPlacement() {
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (answers: PlacementAnswer[]) => placementService.submitTest(answers),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
