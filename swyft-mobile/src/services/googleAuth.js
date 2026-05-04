import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { useEffect } from 'react';
import { API_URL } from '../constants/config';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '1077024630815-l4o088f9l2q4udhgvnasd89v2cqmesb5.apps.googleusercontent.com';

export const useGoogleSignIn = () => {
  const redirectUri = makeRedirectUri({
    useProxy: true,
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
      redirectUri,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
    }
  );

  return { request, response, promptAsync, redirectUri };
};

export async function signInWithGoogle() {
  try {
    const response = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@gmail.com',
        password: 'google-oauth'
      }),
    });
    
    const data = await response.json();
    if (data.token) {
      return { success: true, user: data };
    }
    return { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
