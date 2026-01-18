import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          const user = useAuthStore.getState().user;

          if (user) {
            useAuthStore.getState().setAuth(user, accessToken, newRefreshToken);
          }

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Members API
export const membersApi = {
  getAll: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/members', { params }),

  getById: (id: string) => api.get(`/members/${id}`),

  update: (id: string, data: Record<string, unknown>) => api.put(`/members/${id}`, data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/members/${id}/status`, { status }),

  getBikes: (memberId: string) => api.get(`/members/${memberId}/bikes`),

  addBike: (memberId: string, data: Record<string, unknown>) =>
    api.post(`/members/${memberId}/bikes`, data),

  updateBike: (memberId: string, bikeId: string, data: Record<string, unknown>) =>
    api.put(`/members/${memberId}/bikes/${bikeId}`, data),

  deleteBike: (memberId: string, bikeId: string) =>
    api.delete(`/members/${memberId}/bikes/${bikeId}`),

  getStats: () => api.get('/members/stats/overview'),

  logMileage: (memberId: string, data: { date: string; miles: number; description?: string; rideId?: string }) =>
    api.post(`/members/${memberId}/mileage`, data),
};

// Rides API
export const ridesApi = {
  getAll: (params?: { startDate?: string; endDate?: string; status?: string; rideType?: string; page?: number; limit?: number }) =>
    api.get('/rides', { params }),

  getUpcoming: (limit?: number) => api.get('/rides/upcoming', { params: { limit } }),

  getById: (id: string) => api.get(`/rides/${id}`),

  create: (data: Record<string, unknown>) => api.post('/rides', data),

  update: (id: string, data: Record<string, unknown>) => api.put(`/rides/${id}`, data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/rides/${id}/status`, { status }),

  rsvp: (id: string, status: string, guests?: number) =>
    api.post(`/rides/${id}/rsvp`, { status, guests }),

  recordAttendance: (id: string, memberIds: string[], mileage?: number) =>
    api.post(`/rides/${id}/attendance`, { memberIds, mileage }),

  addReport: (id: string, data: { rideReport: string; actualDistance?: number; actualDuration?: number; weatherConditions?: string }) =>
    api.post(`/rides/${id}/report`, data),

  getWeather: (id: string) => api.get(`/rides/${id}/weather`),

  saveWaypoints: (id: string, waypoints: Array<{ name: string; address?: string; lat?: number; lng?: number; stopType?: string; notes?: string }>) =>
    api.post(`/rides/${id}/waypoints`, { waypoints }),
};

// Meetings API
export const meetingsApi = {
  getAll: (params?: { startDate?: string; endDate?: string; meetingType?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/meetings', { params }),

  getUpcoming: (limit?: number) => api.get('/meetings/upcoming', { params: { limit } }),

  getById: (id: string) => api.get(`/meetings/${id}`),

  create: (data: Record<string, unknown>) => api.post('/meetings', data),

  update: (id: string, data: Record<string, unknown>) => api.put(`/meetings/${id}`, data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/meetings/${id}/status`, { status }),

  recordAttendance: (id: string, memberIds: string[]) =>
    api.post(`/meetings/${id}/attendance`, { memberIds }),

  addMotion: (id: string, data: { motionText: string; proposedBy?: string; secondedBy?: string; votesFor?: number; votesAgainst?: number; votesAbstain?: number }) =>
    api.post(`/meetings/${id}/motions`, data),

  addActionItem: (id: string, data: { title: string; description?: string; assignedTo?: string; dueDate?: string; priority?: number }) =>
    api.post(`/meetings/${id}/action-items`, data),

  updateActionItem: (meetingId: string, actionItemId: string, data: { status?: string; notes?: string }) =>
    api.patch(`/meetings/${meetingId}/action-items/${actionItemId}`, data),

  // Minutes
  getMinutes: (meetingId: string) => api.get(`/meetings/${meetingId}/minutes`),

  getAllMinutes: (params?: { page?: number; limit?: number }) =>
    api.get('/meetings/all/minutes', { params }),

  saveMinutes: (meetingId: string, data: { content: string; summary?: string }) =>
    api.post(`/meetings/${meetingId}/minutes`, data),

  summarizeMinutes: (meetingId: string) =>
    api.post(`/meetings/${meetingId}/minutes/summarize`),

  approveMinutes: (meetingId: string) =>
    api.post(`/meetings/${meetingId}/minutes/approve`),

  getMinutesHistory: (meetingId: string) =>
    api.get(`/meetings/${meetingId}/minutes/history`),
};

// AI API
export const aiApi = {
  summarize: (content: string, type: 'minutes' | 'ride_report' | 'document') =>
    api.post('/ai/summarize', { content, type }),

  getRideSuggestions: (data: { startLocation: string; preferredDistance?: number; difficulty?: number; date?: string; groupSize?: number }) =>
    api.post('/ai/ride-suggestions', data),

  generateSafetyBriefing: (data: { rideTitle: string; rideDate: string; meetupLocation: string; destination: string; estimatedDistance: number; weatherForecast?: string; specialInstructions?: string }) =>
    api.post('/ai/safety-briefing', data),

  getEngagementAnalysis: () => api.get('/ai/engagement-analysis'),

  chat: (message: string, conversationId?: string) =>
    api.post('/ai/chat', { message, conversationId }),

  search: (query: string) => api.post('/ai/search', null, { params: { query } }),
};
