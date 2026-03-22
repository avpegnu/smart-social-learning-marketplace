import { apiClient } from '@shared/api-client';

export interface UpdateProfilePayload {
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface NotificationPreferences {
  [key: string]: { inApp: boolean; email: boolean };
}

export interface ApplyInstructorPayload {
  expertise: string[];
  experience?: string;
  motivation?: string;
  cvUrl?: string;
  certificateUrls?: string[];
}

function toQuery(params?: Record<string, unknown>): Record<string, string> {
  const q: Record<string, string> = {};
  if (!params) return q;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q[k] = String(v);
  }
  return q;
}

export const userService = {
  // Profile
  getMe: () => apiClient.get('/users/me'),

  getById: (userId: string) => apiClient.get(`/users/${userId}`),

  updateProfile: (data: UpdateProfilePayload) => apiClient.patch('/users/me', data),

  changePassword: (data: ChangePasswordPayload) => apiClient.patch('/users/me/password', data),

  // Notification preferences
  updateNotificationPreferences: (preferences: NotificationPreferences) =>
    apiClient.put('/users/me/notification-preferences', { preferences }),

  // Follow
  follow: (userId: string) => apiClient.post(`/users/${userId}/follow`),

  unfollow: (userId: string) => apiClient.del(`/users/${userId}/follow`),

  getFollowers: (userId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/users/${userId}/followers`, toQuery(params)),

  getFollowing: (userId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/users/${userId}/following`, toQuery(params)),

  // Instructor applications
  applyInstructor: (data: ApplyInstructorPayload) =>
    apiClient.post('/instructor/applications', data),

  getMyApplications: () => apiClient.get('/instructor/applications/me'),
};
