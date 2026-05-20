// app/_layout.tsx
import '../polyfills';  // Must be first import
import 'react-native-url-polyfill/auto';

import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useSegments, useRouter } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Fraunces_400Regular, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, AuthContext } from '../context/AuthContext';
import { ONBOARDING_VERSION } from '../components/OnboardingScreen';
import { getUserPreferences } from '../components/UserPreferences';

const { useContext, useEffect, useRef, useState } = React;

const AUTH_ROUTES = ['/signin', '/signup'];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();
  const hasCheckedOnboarding = useRef(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);

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

    if (hasCheckedOnboarding.current) return;
    hasCheckedOnboarding.current = true;

    const checkOnboarding = async () => {
      setIsCheckingOnboarding(true);
      let needsOnboarding = true; // fail-safe default
      try {
        const prefs = await getUserPreferences();
        needsOnboarding = (prefs.onboardingVersion ?? 0) < ONBOARDING_VERSION;
      } catch (e) {
        console.warn('[AuthGate] Preferences fetch failed, defaulting to onboarding', e);
      } finally {
        setIsCheckingOnboarding(false);
      }

      if (needsOnboarding && current !== '/onboarding') {
        router.replace('/onboarding');
      } else if (!needsOnboarding && (current === '/onboarding' || AUTH_ROUTES.includes(current))) {
        router.replace('/home');
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
