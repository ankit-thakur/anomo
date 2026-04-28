import Constants from 'expo-constants';
import * as Application from 'expo-application';

export type Environment = 'development' | 'staging' | 'production';

export const getEnvironment = (): Environment => {
  if (__DEV__) {
    // Development mode with Expo Go or local dev build
    return 'development';
  }
  
  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    return 'staging';
  }
  
  // Production standalone app
  return 'production';
};

export const getRedirectUri = (redirectUris: string | string[], type: 'signIn' | 'signOut'): string => {
  
  
  if (!Array.isArray(redirectUris)) {
    return redirectUris;
  }

  const environment = getEnvironment();
  const platform = Constants.platform?.web ? 'web' : 'mobile';
  
  // For development, choose based on platform
  if (environment === 'development') {
    if (platform === 'web') {
      // In web browser, use localhost
      return redirectUris.find(uri => uri.startsWith('http://localhost')) || redirectUris[0];
    } else {
      // In Expo Go mobile, use the exp:// URI with IP
      return redirectUris.find(uri => uri.startsWith('exp://') && uri.includes('192.168')) || redirectUris[0];
    }
  }
  
  // For staging/production
  switch (environment) {
    case 'staging':
      return redirectUris.find(uri => uri.includes('exp.host')) || redirectUris[0];
    case 'production':
      return redirectUris.find(uri => uri.startsWith('anomo://')) || redirectUris[0];
    default:
      return redirectUris[0];
  }
};
