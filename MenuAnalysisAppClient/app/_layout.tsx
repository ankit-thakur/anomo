// app/_layout.tsx
import '../polyfills';  // Must be first import
import 'react-native-url-polyfill/auto';

import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useSegments, useRouter } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Fraunces_400Regular, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, AuthContext } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const { useContext, useEffect } = React;

function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();

  const userId = user?.idToken ? decodeJwtSub(user.idToken) : null;
  useNotifications(userId);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const placeId = response.notification.request.content.data?.placeId as string | undefined;
      if (placeId) router.push(`/home?placeId=${placeId}`);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (isLoading) return;
    const current = '/' + (segments[0] || '');
    if (!user && !['/signin', '/signup'].includes(current)) {
      router.replace('/signin');
    }
  }, [user, isLoading, router, segments]);

  return <>{children}</>;
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_700Bold
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          <Slot />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );

  // return (
  //     <Slot />
  // );
}
