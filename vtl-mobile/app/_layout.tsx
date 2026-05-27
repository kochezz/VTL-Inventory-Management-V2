import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hasMobileExecutiveAccess, useAuthStore } from '../stores/authStore';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

// TODO Phase 5: Re-enable push notifications in EAS build
// expo-notifications not supported in Expo Go SDK 53+
// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import { apiClient } from '../services/api';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isAuthenticated, isLoading, initAuth } = useAuthStore();

  // Activates background-timeout (15 min) and inactivity-timeout (30 min)
  useSessionTimeout();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAccessRestricted = segments[0] === 'access-restricted';
    const canAccessMobile = hasMobileExecutiveAccess(user?.role as string | undefined);

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !canAccessMobile && !inAccessRestricted) {
      router.replace('/access-restricted');
    } else if (isAuthenticated && canAccessMobile && (inAuthGroup || inAccessRestricted)) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, user, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}
