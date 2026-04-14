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
      console.log('Request config:', JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        timeout: error.config?.timeout,
      }, null, 2));
      
      // Check if email verification is required
      if (error.response?.data?.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          email: error.response.data.email,
          error: 'Please verify your email first'
        };
      }
      
      let errorMessage = 'Login failed';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout - server took too long to respond';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error - check your internet connection';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async register(userData) {
    try {
      const response = await authAPI.register(userData);
      console.log('Registration response:', response.data);
      
      // Since we're auto-verifying, login the user after registration
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

  async saveAuthData(user) {
    const normalizedRole = (user.role || 'passenger').toLowerCase();
    
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AUTH_TOKEN, user.token || ''],
      [STORAGE_KEYS.USER_EMAIL, user.email || ''],
      [STORAGE_KEYS.USER_ROLE, normalizedRole],
      [STORAGE_KEYS.DRIVER_INFO, JSON.stringify({
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        vehicle: user.vehicle || '',
        vehicleMake: user.vehicle_make || '',
        vehicleModel: user.vehicle_model || '',
        vehicleYear: user.vehicle_year || '',
        vehicleColor: user.vehicle_color || '',
        vehiclePlate: user.vehicle_plate || '',
      })],
    ]);
  }

  async getToken() {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
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
