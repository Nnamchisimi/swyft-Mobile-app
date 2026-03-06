import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { STORAGE_KEYS } from '../constants/config';
import { authAPI } from './api';

class AuthService {
  // Login user
  async login(email, password) {
    try {
      const response = await authAPI.login(email, password);
      const user = response.data;

      // Save user data without token
      await this.saveAuthData(user);
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Login failed',
      };
    }
  }

  // Register user
  async register(userData) {
    try {
      const response = await authAPI.register(userData);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Registration failed',
      };
    }
  }

  // Save auth data to storage (without token)
  async saveAuthData(user) {
    // Normalize role to lowercase
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

  // Get stored auth token
  async getToken() {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  // Get stored user email
  async getUserEmail() {
    return AsyncStorage.getItem(STORAGE_KEYS.USER_EMAIL);
  }

  // Get stored user role
  async getUserRole() {
    return AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
  }

  // Get stored driver info
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

  // Logout user
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
