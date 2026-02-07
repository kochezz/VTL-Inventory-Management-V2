'use client';

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { create } from 'zustand';

export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

type AuthStorageShape = {
  user?: User | null;
  token?: string | null;
  accessToken?: string | null;
  access_token?: string | null;
  refreshToken?: string | null;
  refresh_token?: string | null;
};

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'auth-storage';
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3001/api';

// Shared API client (recommended to import instead of raw axios)
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
});

function readStoredAuth(): {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
} {
  if (typeof window === 'undefined') {
    return { user: null, token: null, refreshToken: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null, refreshToken: null };

    const parsed = JSON.parse(raw) as AuthStorageShape;

    const token =
      parsed.token ?? parsed.accessToken ?? parsed.access_token ?? null;

    const refreshToken =
      parsed.refreshToken ?? parsed.refresh_token ?? null;

    return {
      user: (parsed.user as User) ?? null,
      token: token ?? null,
      refreshToken: refreshToken ?? null,
    };
  } catch {
    return { user: null, token: null, refreshToken: null };
  }
}

function writeStoredAuth(next: {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: next.user,
      token: next.token,
      refreshToken: next.refreshToken,
    })
  );
}

function applyAuthHeader(token: string | null) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
    delete api.defaults.headers.common.Authorization;
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: () => {
    const { user, token, refreshToken } = readStoredAuth();
    set({
      user,
      token,
      refreshToken,
      isAuthenticated: Boolean(token),
      isLoading: false,
    });
    applyAuthHeader(token);
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });

    try {
      const res = await api.post('/auth/login', { email, password });

      const user = res.data?.user as User;
      const accessToken = (res.data?.accessToken ?? res.data?.token) as string;
      const refreshToken = (res.data?.refreshToken ?? null) as string | null;

      if (!accessToken) {
        throw new Error('Login did not return an access token');
      }

      set({
        user,
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      writeStoredAuth({ user, token: accessToken, refreshToken });
      applyAuthHeader(accessToken);
    } catch (err: any) {
      set({ isLoading: false });
      const message =
        err?.response?.data?.message || err?.message || 'Login failed';
      throw new Error(message);
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

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }

    applyAuthHeader(null);
  },
}));

/**
 * Failsafe helper used by AuthProvider.
 * - If token exists: sets Authorization header
 * - If token missing: removes Authorization header
 */
export function ensureAuthHeader() {
  const token = useAuth.getState().token;
  applyAuthHeader(token ?? null);
}

// ======================================================
// Token refresh interceptor (installed once)
// ======================================================

let interceptorInstalled = false;

async function refreshAccessToken() {
  const { refreshToken } = useAuth.getState();
  if (!refreshToken) throw new Error('No refresh token available');

  // IMPORTANT: call refresh using plain axios (not api) to avoid recursion
  const res = await axios.post(
    `${API_BASE}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const accessToken = (res.data?.accessToken ?? res.data?.token) as string;
  const user = (res.data?.user ?? null) as User | null;

  if (!accessToken) {
    throw new Error('Refresh did not return an access token');
  }

  // Update store + storage + headers
  useAuth.setState((prev) => ({
    ...prev,
    token: accessToken,
    user: user ?? prev.user,
    isAuthenticated: true,
  }));

  const current = readStoredAuth();
  writeStoredAuth({
    user: user ?? current.user,
    token: accessToken,
    refreshToken: current.refreshToken,
  });

  applyAuthHeader(accessToken);
  return accessToken;
}

function shouldSkipRefresh(config?: any) {
  const url = (config?.url || '') as string;
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

export function installAuthInterceptors() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  api.interceptors.request.use((config) => {
    const token = useAuth.getState().token;
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;

      if (!original || shouldSkipRefresh(original)) {
        return Promise.reject(error);
      }

      const status = error.response?.status;
      if (status !== 401 || original._retry) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        const newToken = await refreshAccessToken();
        original.headers = original.headers || {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        useAuth.getState().logout();
        return Promise.reject(refreshErr);
      }
    }
  );
}

// Auto-install interceptors and initialize once on the client
if (typeof window !== 'undefined') {
  installAuthInterceptors();
  if (useAuth.getState().isLoading) {
    useAuth.getState().initialize();
  }
}
