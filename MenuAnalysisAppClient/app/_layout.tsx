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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_VERSION, ONBOARDING_VERSION_KEY } from '../components/OnboardingScreen';

const { useContext, useEffect } = React;

const AUTH_ROUTES = ['/signin', '/signup'];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const current = '/' + (segments[0] || '');

    if (!user) {
      if (!AUTH_ROUTES.includes(current)) {
        router.replace('/signin');
      }
      return;
    }

    // Authenticated — check whether onboarding has been completed
    const checkOnboarding = async () => {
      const stored = await AsyncStorage.getItem(ONBOARDING_VERSION_KEY);
      const storedVersion = stored ? parseInt(stored, 10) : 0;
      const needsOnboarding = storedVersion < ONBOARDING_VERSION;

      if (needsOnboarding && current !== '/onboarding') {
        router.replace('/onboarding');
      } else if (!needsOnboarding && (current === '/onboarding' || AUTH_ROUTES.includes(current))) {
        router.replace('/home');
      }
    };

    checkOnboarding();
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
