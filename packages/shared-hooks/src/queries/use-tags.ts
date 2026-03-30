'use client';

import { useQuery } from '@tanstack/react-query';
import { tagService } from '../services/tag.service';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => tagService.getAll(),
    staleTime: 10 * 60 * 1000, // 10 min — tags rarely change
  });
}
