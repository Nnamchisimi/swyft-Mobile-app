import { Linking } from 'react-native';

const GOOGLE_CLIENT_ID = '1077024630815-slblerpat1q0ckbv688anvvirhr04r5q.apps.googleusercontent.com';
const REDIRECT_URI = 'swyftmobile:/oauth';

export const googleAuthConfig = {
  clientId: GOOGLE_CLIENT_ID,
  redirectUri: REDIRECT_URI,
  scopes: ['profile', 'email'],
  extraParams: {
    access_type: 'offline',
    prompt: 'consent',
  },
};

function generateRandomString(length = 43) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function signInWithGoogle() {
  try {
    const codeVerifier = generateRandomString();

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent('email profile')}&access_type=offline&prompt=consent&code_challenge=${codeVerifier}&code_challenge_method=plain`;

    const supported = await Linking.canOpenURL(authUrl);
    if (!supported) {
      return { success: false, error: 'Cannot open browser' };
    }

    await Linking.openURL(authUrl);

    return { success: false, error: 'Google Sign-In requires native setup for TestFlight builds' };
  } catch (error) {
    console.log('Google Sign-In error:', error);
    return { success: false, error: error.message || 'Google Sign-In failed' };
  }
}

export async function signOutGoogle() {
  return { success: true };
}
