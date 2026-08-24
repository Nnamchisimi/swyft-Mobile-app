import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { STORAGE_KEYS } from '../constants/config';
import { authAPI } from './api';

class AuthService {
  async login(email, password) {
    console.log('=== AUTH SERVICE DEBUG ===');
    console.log('Making API call to login endpoint...');
    
    try {
      const response = await authAPI.login(email, password);
      console.log('API response received:', JSON.stringify(response.data, null, 2));
      const user = response.data;

      await this.saveAuthData(user);
      return { success: true, user };
    } catch (error) {
      console.log('API call failed!');
      console.log('Error type:', error.constructor.name);
      console.log('Error message:', error.message);
      console.log('Error code:', error.code);
      console.log('Response status:', error.response?.status);
      console.log('Response data:', JSON.stringify(error.response?.data, null, 2));
      
      const errorData = error.response?.data || {};
      const errorMessage = errorData.error || error.message || 'Login failed';

      if (errorData.requiresVerification || /verify your email/i.test(errorMessage)) {
        return {
          success: false,
          requiresVerification: true,
          email: errorData.email || email,
          error: errorMessage,
          role: errorData.role || null
        };
      }
      
      let displayMessage = errorMessage;
      if (error.code === 'ECONNABORTED') {
        displayMessage = 'Connection timeout - server took too long to respond';
      } else if (error.code === 'ERR_NETWORK') {
        displayMessage = 'Network error - check your internet connection';
      }
      
      return {
        success: false,
        error: displayMessage,
      };
    }
  }

  async register(userData) {
    try {
      const response = await authAPI.register(userData);
      console.log('Registration response:', response.data);
      
      // Check if email verification is required
      if (response.data.requiresVerification || response.data.email) {
        return {
          success: true,
          requiresVerification: true,
          email: response.data.email
        };
      }
      
      // Fallback - login the user (shouldn't happen with email verification enabled)
      const loginResult = await this.login(userData.email, userData.password);
      return loginResult;
    } catch (error) {
      console.log('Registration error:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.details || error.message || 'Registration failed',
      };
    }
  }

  async verifyCode(email, code) {
    try {
      const response = await authAPI.verifyCode(email, code);
      console.log('Verification response:', response.data);
      
      if (response.data.token && response.data.user) {
        await this.saveAuthData(response.data.user);
        return { success: true, user: response.data.user };
      }
      
      return { success: false, error: 'Verification failed' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Invalid or expired code',
      };
    }
  }

  async resendCode(email) {
    try {
      const response = await authAPI.resendCode(email);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to resend code',
      };
    }
  }

  async forgotPassword(email) {
    try {
      const response = await authAPI.forgotPassword(email);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send reset email',
      };
    }
  }

  async resetPassword(email, code, password) {
    try {
      const response = await authAPI.resetPassword(email, code, password);
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error('Reset password API error:', error.response?.status, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to reset password',
      };
    }
  }

  async saveAuthData(user, token = null) {
    const normalizedRole = (user.role || 'passenger').toLowerCase();
    const authToken = token || user.token || '';
    console.log('[AUTH] Saving auth token:', authToken ? 'present' : 'empty');
    console.log('[AUTH] User role:', normalizedRole);
    
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AUTH_TOKEN, authToken],
      [STORAGE_KEYS.USER_EMAIL, user.email || ''],
      [STORAGE_KEYS.USER_ROLE, normalizedRole],
      [STORAGE_KEYS.DRIVER_INFO, JSON.stringify({
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        profilePicture: user.profile_picture || user.profilePicture || '',
        vehicle: user.vehicle || '',
        vehicleMake: user.vehicle_make || '',
        vehicleModel: user.vehicle_model || '',
        vehicleYear: user.vehicle_year || '',
        vehicleColor: user.vehicle_color || '',
        vehiclePlate: user.vehicle_plate || '',
        vehicleMake: user.vehicle_make || '',
        vehicleModel: user.vehicle_model || '',
        vehicleYear: user.vehicle_year || '',
        vehicleColor: user.vehicle_color || '',
        vehiclePlate: user.vehicle_plate || '',
      })],
    ]);
    console.log('[AUTH] Auth data saved');
  }

  async getToken() {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    console.log('[AUTH] Retrieved token from storage:', token ? 'present' : 'empty');
    return token;
  }

  async saveVerificationEmail(email) {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
  }

  async getUserEmail() {
    return AsyncStorage.getItem(STORAGE_KEYS.USER_EMAIL);
  }

  async getUserRole() {
    return AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
  }

  async getDriverInfo() {
    const info = await AsyncStorage.getItem(STORAGE_KEYS.DRIVER_INFO);
    return info ? JSON.parse(info) : null;
  }

  async saveProfilePicture(url) {
    const info = await this.getDriverInfo();
    if (info) {
      info.profilePicture = url;
      await AsyncStorage.setItem(STORAGE_KEYS.DRIVER_INFO, JSON.stringify(info));
    }
  }

  async getProfilePicture() {
    const info = await this.getDriverInfo();
    return info?.profilePicture || null;
  }

  // Check if user is authenticated (without token)
  async isAuthenticated() {
    const token = await this.getToken();
    if (!token) return false;

    try {
      const decoded = jwtDecode(token);
      // Check if token is expired
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch {
      return false;
    }
  }

  async logout() {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_EMAIL,
      STORAGE_KEYS.USER_ROLE,
      STORAGE_KEYS.DRIVER_INFO,
    ]);
  }
}

export const authService = new AuthService();
export default authService;
