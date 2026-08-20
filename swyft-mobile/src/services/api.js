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
  verifyCode: (email, code) => api.post('/api/users/verify-code', { email, code }),
  resendCode: (email) => api.post('/api/users/resend-code', { email }),
  forgotPassword: (email) => api.post('/api/users/forgot-password', { email }),
  resetPassword: (email, code, password) => api.post('/api/users/reset-password', { email, code, password }),
  getProfile: () => api.get('/api/user/profile'),
};

export const ridesAPI = {
  createRide: (rideData) => api.post('/api/rides', rideData),
  getRides: (params) => api.get('/api/rides', { params }),
  getRideById: (rideId) => api.get(`/api/rides/${rideId}`),
  updateRideStatus: (rideId, status) => api.post(`/api/rides/${rideId}/${status === 'active' ? 'start' : status}`),
  cancelRide: (rideId, cancelledBy) => api.post(`/api/rides/${rideId}/cancel`, cancelledBy ? { cancelled_by: cancelledBy } : {}),
  rateRide: (rideId, ratingData) => api.post(`/api/rides/${rideId}/rate`, ratingData),
  acceptRide: (rideId, driverData) => api.post(`/api/rides/${rideId}/accept`, driverData),
  startRide: (rideId) => api.post(`/api/rides/${rideId}/start`),
  arriveRide: (rideId) => api.post(`/api/rides/${rideId}/arrive`),
  completeRide: (rideId, finalPrice) => api.post(`/api/rides/${rideId}/complete`, { final_price: finalPrice }),
  confirmPickup: (rideId) => api.post(`/api/rides/${rideId}/confirm-pickup`),
  confirmComplete: (rideId) => api.post(`/api/rides/${rideId}/confirm-complete`),
  updateDriverLocation: (rideId, location) => api.post(`/api/rides/${rideId}/driver-location`, location),
  verifyOtp: (rideId, otp) => api.post(`/api/rides/${rideId}/verify-otp`, { otp }),
  passengerConfirmRide: (rideId) => api.post(`/api/rides/${rideId}/passenger-confirm`),
  resendOtp: (rideId) => api.post(`/api/rides/${rideId}/resend-otp`),
};

export const driverAPI = {
  getPendingRides: () => api.get('/api/rides'),
  acceptRide: (rideId, driverData) => api.post(`/api/rides/${rideId}/accept`, driverData),
  completeRide: (rideId, finalPrice) => api.post(`/api/rides/${rideId}/complete`, { final_price: finalPrice }),
  getNearbyDrivers: (lat, lng, radius) => api.get('/api/drivers/nearby', { params: { lat, lng, radius } }),
  getDriverInfo: (email) => api.get(`/api/drivers/${encodeURIComponent(email)}`),
  
  setOnlineStatus: (email, isOnline, location) => 
    api.post('/api/drivers/status', { email, is_online: isOnline, ...location }),
  
  getEarnings: (email) => api.get('/api/drivers/earnings', { params: { email } }),
  getTodayStats: (email) => api.get('/api/drivers/stats', { params: { email } }),
  getWallet: (email) => api.get('/api/drivers/wallet', { params: { email } }),
  requestWithdrawal: (data) => api.post('/api/drivers/wallet/withdraw', data),
  getWithdrawals: (email) => api.get('/api/drivers/withdrawals', { params: { email } }),
  
  // Driver verification endpoints
  submitIdDocument: (email, document) => api.post(`/api/drivers/${encodeURIComponent(email)}/id-document`, document),
  submitSelfie: (email, selfieData) => api.post(`/api/drivers/${encodeURIComponent(email)}/selfie`, selfieData),
  requestPhoneVerification: (email, phoneData) => api.post(`/api/drivers/${encodeURIComponent(email)}/phone-request-code`, phoneData),
  verifyPhoneNumber: (email, verifyData) => api.post(`/api/drivers/${encodeURIComponent(email)}/phone-verify`, verifyData),
  submitBankAccount: (email, bankData) => api.post(`/api/drivers/${encodeURIComponent(email)}/bank-account`, bankData),
  getVerificationStatus: (email) => api.get(`/api/drivers/${encodeURIComponent(email)}/verification-status`),
  submitForReview: (email) => api.post(`/api/drivers/${encodeURIComponent(email)}/submit-for-review`),
  approveDriver: (email, approvalData) => api.patch(`/api/drivers/${encodeURIComponent(email)}/approve`, approvalData),
  updateProfilePicture: (email, data) => api.patch(`/api/drivers/${encodeURIComponent(email)}/profile-picture`, data),
};

export const adminAPI = {
  getPendingDrivers: () => api.get('/api/admin/drivers/pending'),
  getDriverVerification: (email) => api.get(`/api/admin/drivers/${encodeURIComponent(email)}/verification`),
  reviewIdDocument: (email, decision, rejection_reason) =>
    api.post(`/api/admin/drivers/${encodeURIComponent(email)}/id-document/review`, { decision, rejection_reason }),
  reviewSelfie: (email, decision, rejection_reason) =>
    api.post(`/api/admin/drivers/${encodeURIComponent(email)}/selfie/review`, { decision, rejection_reason }),
  reviewPhone: (email, decision) =>
    api.post(`/api/admin/drivers/${encodeURIComponent(email)}/phone/review`, { decision }),
  reviewBank: (email, decision, rejection_reason) =>
    api.post(`/api/admin/drivers/${encodeURIComponent(email)}/bank/review`, { decision, rejection_reason }),
  archiveDriver: (email, decision, notes) =>
    api.post(`/api/admin/drivers/${encodeURIComponent(email)}/archive`, { decision, notes }),
  getArchivedDrivers: () => api.get('/api/admin/drivers/archived'),
  getWithdrawals: (params = {}) => api.get('/api/admin/withdrawals', { params }),
  processWithdrawal: (id, data) => api.post(`/api/admin/withdrawals/${id}/process`, data),
  rejectWithdrawal: (id, data) => api.post(`/api/admin/withdrawals/${id}/reject`, data),
  markWithdrawalPaid: (id, data) => api.post(`/api/admin/withdrawals/${id}/mark-paid`, data),
};

export const fareAPI = {
  calculate: (distanceKm, rideType = 'standard', vehicleType = 'sedan') => 
    api.post('/api/fare/calculate', { distance_km: distanceKm, ride_type: rideType, vehicle_type: vehicleType }),
  getPricing: () => api.get('/api/pricing'),
};

export const driversAPI = {
  getNearby: (lat, lng, radius = 5) => 
    api.get('/api/drivers/nearby', { params: { lat, lng, radius } }),
  getDriver: (email) => api.get(`/api/drivers/${encodeURIComponent(email)}`),
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
  createPayment: (data) => api.post('/api/payments/create', data),
  verifyPayment: (data) => api.post('/api/payments/verify', data),
  getPaymentStatus: (paymentId, config) => api.get(`/api/payments/status/${paymentId}`, config),
};

export default api;
