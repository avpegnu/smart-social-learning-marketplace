'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { qnaService, type QueryQuestionsParams } from '../services/qna.service';

export function useQuestions(params?: QueryQuestionsParams) {
  return useQuery({
    queryKey: ['questions', params],
    queryFn: () => qnaService.getQuestions(params),
  });
}

export function useQuestionDetail(id: string) {
  return useQuery({
    queryKey: ['questions', id],
    queryFn: () => qnaService.getQuestionDetail(id),
    enabled: !!id,
  });
}

export function useCreateAnswer() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ questionId, content }: { questionId: string; content: string }) =>
      qnaService.createAnswer(questionId, { content }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['questions', vars.questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useMarkBestAnswer() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ questionId, answerId }: { questionId: string; answerId: string }) =>
      qnaService.markBestAnswer(questionId, answerId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['questions', vars.questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
