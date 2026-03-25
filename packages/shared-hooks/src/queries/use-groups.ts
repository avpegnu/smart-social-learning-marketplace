'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupService } from '../services/group.service';
import type { CreateGroupData, UpdateGroupData } from '../services/group.service';
import { useApiError } from '../use-api-error';

// ── Queries ──

export function useGroups(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['groups', params],
    queryFn: () => groupService.getGroups(params),
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => groupService.getGroup(id),
    enabled: !!id,
  });
}

export function useGroupMembers(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['groups', id, 'members', params],
    queryFn: () => groupService.getMembers(id, params),
    enabled: !!id,
  });
}

export function useGroupPosts(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['groups', id, 'posts', params],
    queryFn: () => groupService.getGroupPosts(id, params),
    enabled: !!id,
  });
}

export function useJoinRequests(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['groups', id, 'requests', params],
    queryFn: () => groupService.getJoinRequests(id, params),
    enabled: !!id,
  });
}

// ── Mutations ──

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (data: CreateGroupData) => groupService.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: getErrorMessage,
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupData }) =>
      groupService.updateGroup(id, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: getErrorMessage,
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => groupService.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: getErrorMessage,
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => groupService.joinGroup(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['groups', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: getErrorMessage,
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (id: string) => groupService.leaveGroup(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['groups', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: getErrorMessage,
  });
}

export function useCreateGroupPost() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: {
        content: string;
        type?: string;
        codeSnippet?: { language: string; code: string };
        imageUrls?: string[];
      };
    }) => groupService.createGroupPost(groupId, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId, 'posts'] });
    },
    onError: getErrorMessage,
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ groupId, userId, role }: { groupId: string; userId: string; role: string }) =>
      groupService.updateMemberRole(groupId, userId, role),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId, 'members'] });
    },
    onError: getErrorMessage,
  });
}

export function useKickMember() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupService.kickMember(groupId, userId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId] });
    },
    onError: getErrorMessage,
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: string; requestId: string }) =>
      groupService.approveRequest(groupId, requestId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId, 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId] });
    },
    onError: getErrorMessage,
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: string; requestId: string }) =>
      groupService.rejectRequest(groupId, requestId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['groups', vars.groupId, 'requests'] });
    },
    onError: getErrorMessage,
  });
}
