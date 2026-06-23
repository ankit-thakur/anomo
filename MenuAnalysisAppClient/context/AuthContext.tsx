import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Amplify } from 'aws-amplify';
import awsConfig from '../config/aws-exports';
import { getEnvironment } from '../utils/environment';

Amplify.configure(awsConfig);

type AuthContextType = {
  user: any | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// --- PKCE helpers ---

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  // digest is already base64; convert to base64url
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// --- Token exchange ---

async function exchangeCodeForTokens(code: string, redirectUri: string, verifier: string) {
  const tokenUrl = `https://${awsConfig.oauth.domain}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: awsConfig.aws_user_pools_web_client_id,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  return resp.json();
}

async function refreshAccessToken(refreshToken: string) {
  const tokenUrl = `https://${awsConfig.oauth.domain}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: awsConfig.aws_user_pools_web_client_id,
    refresh_token: refreshToken,
  });

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  return resp.json();
}

// --- Provider ---

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const redirectUri = awsConfig.oauth.redirectSignIn;

  if (__DEV__) {
    console.log('Current environment:', getEnvironment());
    console.log('Using Sign-in URI:', redirectUri);
    console.log('Using Sign-out URI:', awsConfig.oauth.redirectSignOut);
  }

  // Schedule a silent refresh ~1 minute before the access token expires.
  const scheduleRefresh = (expiresInSeconds: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max((expiresInSeconds - 60) * 1000, 0);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const storedRefresh = await AsyncStorage.getItem('refreshToken');
        if (!storedRefresh) return;
        const tokens = await refreshAccessToken(storedRefresh);
        await AsyncStorage.setItem('accessToken', tokens.access_token);
        if (tokens.id_token) await AsyncStorage.setItem('idToken', tokens.id_token);
        setUser((prev: any) => prev
          ? { ...prev, accessToken: tokens.access_token, idToken: tokens.id_token || prev.idToken }
          : null
        );
        scheduleRefresh(tokens.expires_in || 3600);
      } catch (e) {
        console.warn('Silent token refresh failed, user must re-authenticate', e);
        await AsyncStorage.multiRemove(['accessToken', 'idToken', 'refreshToken']);
        setUser(null);
      }
    }, delay);
  };

  const signIn = async () => {
    try {
      const verifier = await generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      await AsyncStorage.setItem('pkce_verifier', verifier);

      const authUrl =
        `https://${awsConfig.oauth.domain}/login?` +
        `client_id=${encodeURIComponent(awsConfig.aws_user_pools_web_client_id)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent((awsConfig.oauth.scope || []).join(' '))}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code_challenge_method=S256&` +
        `code_challenge=${encodeURIComponent(challenge)}`;

      if (__DEV__) console.log('Hosted UI URL:', authUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri) as any;

      if (result.type === 'success' && result.url) {
        const queryIdx = result.url.indexOf('?');
        const paramString = queryIdx >= 0 ? result.url.substring(queryIdx + 1) : '';
        const params: Record<string, string> = {};
        paramString.split('&').filter(Boolean).forEach((p: string) => {
          const [k, v] = p.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });

        if (params.code) {
          const tokens = await exchangeCodeForTokens(params.code, redirectUri, verifier);
          await AsyncStorage.setItem('accessToken', tokens.access_token);
          if (tokens.id_token) await AsyncStorage.setItem('idToken', tokens.id_token);
          if (tokens.refresh_token) await AsyncStorage.setItem('refreshToken', tokens.refresh_token);
          setUser({ accessToken: tokens.access_token, idToken: tokens.id_token || null });
          scheduleRefresh(tokens.expires_in || 3600);
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      await AsyncStorage.multiRemove(['accessToken', 'idToken', 'refreshToken']);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Restore session on mount
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        // On web, Cognito redirects the whole tab back with ?code=... — handle it here.
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (code) {
            const storedVerifier = await AsyncStorage.getItem('pkce_verifier');
            if (storedVerifier) {
              try {
                console.log('[Auth] Exchanging OAuth code for tokens...');
                const tokens = await exchangeCodeForTokens(code, redirectUri, storedVerifier);
                await AsyncStorage.setItem('accessToken', tokens.access_token);
                if (tokens.id_token) await AsyncStorage.setItem('idToken', tokens.id_token);
                if (tokens.refresh_token) await AsyncStorage.setItem('refreshToken', tokens.refresh_token);
                setUser({ accessToken: tokens.access_token, idToken: tokens.id_token || null });
                scheduleRefresh(tokens.expires_in || 3600);
                window.history.replaceState({}, '', window.location.pathname);
                console.log('[Auth] OAuth callback complete, user set');
              } catch (e) {
                console.error('[Auth] OAuth callback exchange failed:', e);
              } finally {
                await AsyncStorage.removeItem('pkce_verifier');
              }
              setIsLoading(false);
              return;
            }
          }
        }

        const accessToken = await AsyncStorage.getItem('accessToken');
        const idToken = await AsyncStorage.getItem('idToken');
        const refreshToken = await AsyncStorage.getItem('refreshToken');

        if (refreshToken) {
          // Silently refresh so we always start with a fresh access token,
          // regardless of whether the stored one has already expired.
          try {
            const tokens = await refreshAccessToken(refreshToken);
            await AsyncStorage.setItem('accessToken', tokens.access_token);
            if (tokens.id_token) await AsyncStorage.setItem('idToken', tokens.id_token);
            setUser({ accessToken: tokens.access_token, idToken: tokens.id_token || idToken });
            scheduleRefresh(tokens.expires_in || 3600);
          } catch (e) {
            // Refresh token itself expired (after 30 days) — user must sign in again.
            console.log('Refresh token expired, clearing session');
            await AsyncStorage.multiRemove(['accessToken', 'idToken', 'refreshToken']);
          }
        } else if (accessToken) {
          // Legacy: tokens from before refresh_token support — keep the user
          // signed in until the access token expires.
          setUser({ accessToken, idToken });
        }
      } catch (error) {
        console.log('No existing auth session');
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthState();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
