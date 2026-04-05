import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { questionBankService, type BankQuestionPayload } from '../services/question-bank.service';
import { useApiError } from '../use-api-error';

const keys = {
  all: ['question-banks'] as const,
  list: (params?: Record<string, unknown>) => [...keys.all, 'list', params] as const,
  detail: (id: string) => [...keys.all, id] as const,
};

export function useQuestionBanks(params?: { page?: number; search?: string }) {
  return useQuery({
    queryKey: keys.list(params as Record<string, unknown>),
    queryFn: () => questionBankService.getAll(params),
  });
}

export function useQuestionBankDetail(bankId: string) {
  return useQuery({
    queryKey: keys.detail(bankId),
    queryFn: () => questionBankService.getById(bankId),
    enabled: !!bankId,
  });
}

export function useCreateQuestionBank() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) => questionBankService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateQuestionBank() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      bankId,
      data,
    }: {
      bankId: string;
      data: { name?: string; description?: string };
    }) => questionBankService.update(bankId, data),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.all });
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteQuestionBank() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (bankId: string) => questionBankService.delete(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useAddBankQuestion() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, data }: { bankId: string; data: BankQuestionPayload }) =>
      questionBankService.addQuestion(bankId, data),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useAddBankQuestionsBatch() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, questions }: { bankId: string; questions: BankQuestionPayload[] }) =>
      questionBankService.addQuestionsBatch(bankId, questions),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateBankQuestion() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      bankId,
      questionId,
      data,
    }: {
      bankId: string;
      questionId: string;
      data: BankQuestionPayload;
    }) => questionBankService.updateQuestion(bankId, questionId, data),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteBankQuestion() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, questionId }: { bankId: string; questionId: string }) =>
      questionBankService.deleteQuestion(bankId, questionId),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// ── Bank Tag Hooks ──

export function useCreateBankTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, name }: { bankId: string; name: string }) =>
      questionBankService.createTag(bankId, { name }),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateBankTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, tagId, name }: { bankId: string; tagId: string; name: string }) =>
      questionBankService.updateTag(bankId, tagId, { name }),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteBankTag() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ bankId, tagId }: { bankId: string; tagId: string }) =>
      questionBankService.deleteTag(bankId, tagId),
    onSuccess: (_, { bankId }) => {
      queryClient.invalidateQueries({ queryKey: keys.detail(bankId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
