import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// EXPO_PUBLIC_API_URL already includes /api (e.g. https://host/api)
// Do NOT append /api again in any fetch call below
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface AuthState {
  user: Record<string, unknown> | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  initAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('vtl_token');
      const userJson = await AsyncStorage.getItem('vtl_user');
      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Read as text first — avoids JSON parse crash when server returns HTML/plain-text
      const rawText = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned ${response.status} — not JSON: ${rawText.substring(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error((data.message as string) ?? 'Invalid email or password');
      }

      const { token, refreshToken, user } = data;

      await SecureStore.setItemAsync('vtl_token', token);
      await SecureStore.setItemAsync('vtl_refresh', refreshToken);
      await AsyncStorage.setItem('vtl_user', JSON.stringify(user));

      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('vtl_token');
    await SecureStore.deleteItemAsync('vtl_refresh');
    await AsyncStorage.removeItem('vtl_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
