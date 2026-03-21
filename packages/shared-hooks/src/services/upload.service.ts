import { apiClient } from '@shared/api-client';

export interface SignUploadResponse {
  mediaId: string;
  [key: string]: unknown;
}

export interface CompleteUploadPayload {
  publicId: string;
  secureUrl: string;
  duration?: number;
  format: string;
  bytes: number;
  originalFilename?: string;
}

export const uploadService = {
  sign: (data: { type: 'VIDEO' | 'IMAGE' | 'ATTACHMENT'; lessonId?: string; folder?: string }) =>
    apiClient.post<SignUploadResponse>('/uploads/sign', data),

  complete: (mediaId: string, cloudinaryResult: CompleteUploadPayload) =>
    apiClient.post(`/uploads/${mediaId}/complete`, { cloudinaryResult }),

  delete: (mediaId: string) => apiClient.del(`/uploads/${mediaId}`),
};
