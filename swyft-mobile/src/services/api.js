import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS } from '../constants/config';

console.log('API initialized with baseURL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60 seconds - Render free tier has slow cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear storage
      AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.USER_ROLE,
      ]);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/api/users/login', { email, password }),
  register: (userData) => api.post('/api/users', userData),
  getProfile: () => api.get('/api/user/profile'),
};

export const ridesAPI = {
  createRide: (rideData) => api.post('/api/rides', rideData),
  getRides: (params) => api.get('/api/rides', { params }),
  getRideById: (rideId) => api.get(`/api/rides/${rideId}`),
  updateRideStatus: (rideId, status) => api.post(`/api/rides/${rideId}/${status === 'active' ? 'start' : status}`),
  cancelRide: (rideId) => api.post(`/api/rides/${rideId}/cancel`),
  rateRide: (rideId, ratingData) => api.post(`/api/rides/${rideId}/rate`, ratingData),
  acceptRide: (rideId, driverData) => api.post(`/api/rides/${rideId}/accept`, driverData),
  startRide: (rideId) => api.post(`/api/rides/${rideId}/start`),
  arriveRide: (rideId) => api.post(`/api/rides/${rideId}/arrive`),
  completeRide: (rideId, finalPrice) => api.post(`/api/rides/${rideId}/complete`, { final_price: finalPrice }),
  confirmRide: (rideId) => api.post(`/api/rides/${rideId}/confirm`),
  updateDriverLocation: (rideId, location) => api.post(`/api/rides/${rideId}/driver-location`, location),
};

export const driverAPI = {
  getPendingRides: () => api.get('/api/rides'),
  acceptRide: (rideId, driverData) => api.post(`/api/rides/${rideId}/accept`, driverData),
  completeRide: (rideId, finalPrice) => api.post(`/api/rides/${rideId}/complete`, { final_price: finalPrice }),
  getNearbyDrivers: (lat, lng, radius) => api.get('/api/drivers/nearby', { params: { lat, lng, radius } }),
  getDriverInfo: (email) => api.get(`/api/drivers/${email}`),
  
  setOnlineStatus: (email, isOnline, location) => 
    api.post('/api/drivers/status', { email, is_online: isOnline, ...location }),
  
  // Driver earnings
  getEarnings: (email) => api.get('/api/drivers/earnings', { params: { email } }),
  
  // Get driver's today stats
  getTodayStats: (email) => api.get('/api/drivers/stats', { params: { email } }),
};

export const fareAPI = {
  calculate: (distanceKm, rideType = 'standard', vehicleType = 'sedan') => 
    api.post('/api/fare/calculate', { distance_km: distanceKm, ride_type: rideType, vehicle_type: vehicleType }),
  getPricing: () => api.get('/api/pricing'),
};

export const driversAPI = {
  getNearby: (lat, lng, radius = 5) => 
    api.get('/api/drivers/nearby', { params: { lat, lng, radius } }),
  getDriver: (email) => api.get(`/api/drivers/${email}`),
};

export const favoritesAPI = {
  getFavorites: (params) => api.get('/api/favorites', { params }),
  addFavorite: (data) => api.post('/api/favorites', data),
  deleteFavorite: (id) => api.delete(`/api/favorites/${id}`),
};

export const paymentAPI = {
  getPaymentMethods: (params) => api.get('/api/payment-methods', { params }),
  addPaymentMethod: (data) => api.post('/api/payment-methods', data),
  deletePaymentMethod: (id) => api.delete(`/api/payment-methods/${id}`),
};

export default api;
