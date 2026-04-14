import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';

const GOOGLE_CLIENT_ID = '1077024630815-slblerpat1q0ckbv688anvvirhr04r5q.apps.googleusercontent.com';
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'swyftmobile' });

export const googleAuthConfig = {
  clientId: GOOGLE_CLIENT_ID,
  redirectUri: REDIRECT_URI,
  scopes: ['profile', 'email'],
  extraParams: {
    access_type: 'offline',
    prompt: 'consent',
  },
};

export async function generateCodeChallenge() {
  const random = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Math.random().toString(36)
  );
  return random.replace(/[^a-zA-Z0-9]/g, '');
}

export async function signInWithGoogle() {
  const codeVerifier = await generateCodeChallenge();
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent('email profile')}&access_type=offline&prompt=consent&code_challenge=${codeVerifier}&code_challenge_method=plain`;

  const result = await AuthSession.startAsync({
    authUrl,
    returnURL: REDIRECT_URI,
    scheme: 'swyftmobile',
  });

  if (result.type === 'success') {
    const params = new URLSearchParams(result.params);
    const code = params.get('code');
    
    if (code) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${GOOGLE_CLIENT_ID}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_verifier=${codeVerifier}`,
      });
      
      const tokens = await response.json();
      
      if (tokens.access_token) {
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        
        const user = await userResponse.json();
        return { success: true, user };
      }
    }
  }
  
  return { success: false, error: result.type === 'cancel' ? 'cancelled' : 'failed' };
}

export async function signOutGoogle() {
  return { success: true };
}
