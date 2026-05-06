import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type Environment = 'development' | 'staging' | 'production';

export const getEnvironment = (): Environment => {
  // __DEV__ is true for both Expo Go and local dev builds
  if (__DEV__) return 'development';
  // Non-dev build running inside Expo Go (e.g. published channel)
  if (Constants.appOwnership === 'expo') return 'staging';
  // Standalone production build (TestFlight / App Store)
  return 'production';
};

export const getRedirectUri = (redirectUris: string | string[], type: 'signIn' | 'signOut'): string => {
  if (!Array.isArray(redirectUris)) return redirectUris;

  const env = getEnvironment();

  if (env === 'development') {
    if (Platform.OS === 'web') {
      // Web browser at localhost
      return redirectUris.find(uri => uri.startsWith('http://localhost')) ?? redirectUris[0];
    } else {
      // Expo Go on device/simulator — exp:// with local IP
      return redirectUris.find(uri => uri.startsWith('exp://') && !uri.includes('exp.host')) ?? redirectUris[0];
    }
  }

  if (env === 'staging') {
    return redirectUris.find(uri => uri.includes('exp.host')) ?? redirectUris[0];
  }

  // production
  return redirectUris.find(uri => uri.startsWith('anomo://')) ?? redirectUris[0];
};
