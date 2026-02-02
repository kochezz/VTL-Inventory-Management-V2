import { create } from 'zustand';
import axios from 'axios';

interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: () => {
    // Load auth state from localStorage
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem('auth-storage');
        if (storedAuth) {
          const { user, token, refreshToken } = JSON.parse(storedAuth);
          if (token) {
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return;
          }
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
      }
    }
    set({ isLoading: false });
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        { email, password }
      );

      const { user, accessToken, refreshToken } = response.data;

      set({
        user,
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth-storage', JSON.stringify({
          user,
          token: accessToken,
          refreshToken,
        }));
      }

      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  logout: () => {
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Remove from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
    }

    // Remove authorization header
    delete axios.defaults.headers.common['Authorization'];
  },
}));

// Initialize on mount (client-side only)
if (typeof window !== 'undefined') {
  useAuth.getState().initialize();
}

// Axios interceptor for token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken } = useAuth.getState();

        if (!refreshToken) {
          useAuth.getState().logout();
          return Promise.reject(error);
        }

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, user } = response.data;

        useAuth.setState({
          token: accessToken,
          user,
          isAuthenticated: true,
        });

        // Update localStorage
        if (typeof window !== 'undefined') {
          const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}');
          localStorage.setItem('auth-storage', JSON.stringify({
            ...stored,
            token: accessToken,
            user,
          }));
        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        return axios(originalRequest);
      } catch (refreshError) {
        useAuth.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
