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
import { ONBOARDING_VERSION } from '../components/OnboardingScreen';
import { getUserPreferences } from '../components/UserPreferences';
import { useNotifications } from '../hooks/useNotifications';
import { markQueueItemComplete } from '../hooks/useAnalysisQueue';

const { useContext, useEffect, useRef, useState } = React;

const AUTH_ROUTES = ['/signin', '/signup'];

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
  const hasCheckedOnboarding = useRef(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);

  const userId = user?.idToken ? decodeJwtSub(user.idToken) : null;
  useNotifications(userId);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const placeId = response.notification.request.content.data?.placeId as string | undefined;
      if (placeId) {
        markQueueItemComplete(placeId);
        router.push(`/home?placeId=${placeId}`);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (isLoading) return;
    const current = '/' + (segments[0] || '');

    if (!user) {
      hasCheckedOnboarding.current = false;
      if (!AUTH_ROUTES.includes(current)) {
        router.replace('/signin');
      }
      return;
    }

    // Navigation from a previous check just settled — clear the spinner and stop.
    if (hasCheckedOnboarding.current) {
      setIsCheckingOnboarding(false);
      return;
    }

    hasCheckedOnboarding.current = true;
    setIsCheckingOnboarding(true);

    const checkOnboarding = async () => {
      let needsOnboarding = true; // fail-safe default
      try {
        const prefs = await getUserPreferences();
        needsOnboarding = (prefs.onboardingVersion ?? 0) < ONBOARDING_VERSION;
      } catch (e) {
        console.warn('[AuthGate] Preferences fetch failed, defaulting to onboarding', e);
      }

      if (needsOnboarding && current !== '/onboarding') {
        router.replace('/onboarding');
        // Spinner clears when segments update to '/onboarding' and effect re-runs above.
      } else if (!needsOnboarding && (current === '/onboarding' || AUTH_ROUTES.includes(current))) {
        router.replace('/home');
        // Spinner clears when segments update to '/home' and effect re-runs above.
      } else {
        // Already on the correct route — no navigation needed.
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [user, isLoading, router, segments]);

  if (isCheckingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
