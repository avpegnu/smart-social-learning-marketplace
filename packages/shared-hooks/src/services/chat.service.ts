import { apiClient } from '@shared/api-client';

function toQuery(params?: Record<string, unknown>): Record<string, string> | undefined {
  if (!params) return undefined;
  const q: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') q[key] = String(value);
  }
  return Object.keys(q).length > 0 ? q : undefined;
}

export interface CreateConversationData {
  participantId: string;
  participantIds?: string[];
  isGroup?: boolean;
  name?: string;
}

export interface SendMessageData {
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'CODE' | 'FILE';
  fileUrl?: string;
  fileName?: string;
}

export const chatService = {
  getConversations: () => apiClient.get('/conversations'),

  getOrCreateConversation: (data: CreateConversationData) => apiClient.post('/conversations', data),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/conversations/${conversationId}/messages`, toQuery(params)),

  sendMessage: (conversationId: string, data: SendMessageData) =>
    apiClient.post(`/conversations/${conversationId}/messages`, data),
};
