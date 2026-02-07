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
        // ✅ FIX 1: Check both storage formats (Zustand + direct)
        const storedAuth = localStorage.getItem('auth-storage');
        const directToken = localStorage.getItem('token');
        const directUser = localStorage.getItem('user');

        // Try Zustand storage first
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

        // ✅ FIX 2: Fallback to direct storage (if login page used this)
        if (directToken) {
          const user = directUser ? JSON.parse(directUser) : null;
          set({
            user,
            token: directToken,
            refreshToken: localStorage.getItem('refreshToken') || null,
            isAuthenticated: true,
            isLoading: false,
          });
          axios.defaults.headers.common['Authorization'] = `Bearer ${directToken}`;
          
          // Migrate to Zustand storage format
          localStorage.setItem('auth-storage', JSON.stringify({
            user,
            token: directToken,
            refreshToken: localStorage.getItem('refreshToken') || null,
          }));
          
          return;
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

      // ✅ FIX 3: Match backend API response format
      // Backend returns: { user, token, refreshToken }
      // NOT: { user, accessToken, refreshToken }
      const { user, token, refreshToken } = response.data;

      set({
        user,
        token: token,  // Use "token" not "accessToken"
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // ✅ FIX 4: Save to BOTH storage formats for compatibility
      if (typeof window !== 'undefined') {
        // Zustand storage
        localStorage.setItem('auth-storage', JSON.stringify({
          user,
          token,
          refreshToken,
        }));
        
        // Direct storage (for backward compatibility)
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
      }

      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.message || error.response?.data?.error || 'Login failed');
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

    // ✅ FIX 5: Clear BOTH storage formats
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
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

        // ✅ FIX 6: Match refresh response format
        const { token, user } = response.data;

        useAuth.setState({
          token: token,
          user,
          isAuthenticated: true,
        });

        // ✅ FIX 7: Update BOTH storage formats
        if (typeof window !== 'undefined') {
          const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}');
          localStorage.setItem('auth-storage', JSON.stringify({
            ...stored,
            token: token,
            user,
          }));
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        originalRequest.headers['Authorization'] = `Bearer ${token}`;

        return axios(originalRequest);
      } catch (refreshError) {
        useAuth.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
