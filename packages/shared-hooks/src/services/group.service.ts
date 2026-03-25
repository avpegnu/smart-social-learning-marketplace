import { apiClient } from '@shared/api-client';

function toQuery(params?: Record<string, unknown>): Record<string, string> | undefined {
  if (!params) return undefined;
  const q: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') q[key] = String(value);
  }
  return Object.keys(q).length > 0 ? q : undefined;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  privacy?: 'PUBLIC' | 'PRIVATE';
  courseId?: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  avatarUrl?: string;
}

export const groupService = {
  // CRUD
  getGroups: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/groups', toQuery(params)),

  createGroup: (data: CreateGroupData) => apiClient.post('/groups', data),

  getGroup: (id: string) => apiClient.get(`/groups/${id}`),

  updateGroup: (id: string, data: UpdateGroupData) => apiClient.put(`/groups/${id}`, data),

  deleteGroup: (id: string) => apiClient.del(`/groups/${id}`),

  // Membership
  joinGroup: (id: string) => apiClient.post(`/groups/${id}/join`),

  leaveGroup: (id: string) => apiClient.post(`/groups/${id}/leave`),

  // Members
  getMembers: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/groups/${id}/members`, toQuery(params)),

  updateMemberRole: (groupId: string, userId: string, role: string) =>
    apiClient.put(`/groups/${groupId}/members/${userId}`, { role }),

  kickMember: (groupId: string, userId: string) =>
    apiClient.del(`/groups/${groupId}/members/${userId}`),

  // Posts
  getGroupPosts: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/groups/${id}/posts`, toQuery(params)),

  createGroupPost: (
    id: string,
    data: {
      content: string;
      type?: string;
      codeSnippet?: { language: string; code: string };
      imageUrls?: string[];
    },
  ) => apiClient.post(`/groups/${id}/posts`, data),

  // Join requests
  getJoinRequests: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/groups/${id}/requests`, toQuery(params)),

  approveRequest: (groupId: string, requestId: string) =>
    apiClient.put(`/groups/${groupId}/requests/${requestId}/approve`),

  rejectRequest: (groupId: string, requestId: string) =>
    apiClient.put(`/groups/${groupId}/requests/${requestId}/reject`),
};
