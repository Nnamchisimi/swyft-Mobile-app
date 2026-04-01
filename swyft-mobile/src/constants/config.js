import Constants from 'expo-constants';

export const COLORS = {
  primary: '#2196F3',
  secondary: '#FF9800',
  success: '#4CAF50',
  error: '#F44336',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9E9E9E',
};

// Auto-detect: use deployed URL if available, otherwise localhost
const getApiUrl = () => {
  // Check for environment variable (set during EAS build)
  const deployedUrl = Constants.expoConfig?.extra?.apiUrl;
  if (deployedUrl) return deployedUrl;
  
  // Default to localhost for local development
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getApiUrl(); // Socket runs on same server as API

// Log the URL being used (helpful for debugging)
console.log('API URL:', API_URL);

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_EMAIL: 'userEmail',
  USER_ROLE: 'userRole',
  DRIVER_INFO: 'driverInfo',
};
