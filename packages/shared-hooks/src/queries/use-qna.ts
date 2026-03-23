'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import {
  qnaService,
  type QueryQuestionsParams,
  type CreateQuestionData,
  type UpdateQuestionData,
} from '../services/qna.service';

// ── Queries ──

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

export function useSimilarQuestions(title: string) {
  return useQuery({
    queryKey: ['questions', 'similar', title],
    queryFn: () => qnaService.findSimilar(title),
    enabled: title.length >= 10,
    staleTime: 5000,
  });
}

// ── Mutations ──

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreateQuestionData) => qnaService.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuestionData }) =>
      qnaService.updateQuestion(id, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['questions', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => qnaService.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCreateAnswer() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      questionId,
      content,
      codeSnippet,
    }: {
      questionId: string;
      content: string;
      codeSnippet?: { language: string; code: string };
    }) => qnaService.createAnswer(questionId, { content, codeSnippet }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['questions', vars.questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteAnswer() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ answerId }: { answerId: string; questionId: string }) =>
      qnaService.deleteAnswer(answerId),
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

export function useVoteAnswer() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ answerId, value }: { answerId: string; value: number; questionId: string }) =>
      qnaService.voteAnswer(answerId, value),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['questions', vars.questionId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
