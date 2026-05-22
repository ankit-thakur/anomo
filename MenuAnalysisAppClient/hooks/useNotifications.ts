import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API } from '../config/apiConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[useNotifications] Push permission denied.');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[useNotifications] No EAS projectId found in app config.');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e) {
    console.warn('[useNotifications] Failed to get push token:', e);
    return null;
  }
}

export function useNotifications(userId: string | null) {
  const tokenSaved = useRef(false);

  useEffect(() => {
    if (!userId || tokenSaved.current) return;

    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      try {
        const idToken = await AsyncStorage.getItem('idToken');
        const headers = idToken ? { Authorization: `Bearer ${idToken}` } : {};
        await axios.put(API.pushToken, { expoPushToken: token }, { headers });
        tokenSaved.current = true;
        console.log('[useNotifications] Push token saved.');
      } catch (e) {
        console.warn('[useNotifications] Failed to save push token:', e);
      }
    });
  }, [userId]);
}
