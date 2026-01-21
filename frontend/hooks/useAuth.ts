// hooks/useAuth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password,
          });

          const { user, accessToken, refreshToken } = response.data;

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Login failed');
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        
        try {
          if (refreshToken) {
            await axios.post(`${API_URL}/auth/logout`, { refreshToken });
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          
          delete axios.defaults.headers.common['Authorization'];
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, user } = response.data;

          set({
            accessToken,
            user,
            isAuthenticated: true,
          });

          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        } catch (error) {
          get().logout();
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await useAuth.getState().refreshAccessToken();
        
        const { accessToken } = useAuth.getState();
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
