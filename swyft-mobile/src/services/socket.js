import { io } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    console.log('Connecting to socket server:', SOCKET_URL);
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(email) {
    this.socket?.emit('joinRoom', email);
  }

  leaveRoom(email) {
    this.socket?.emit('leaveRoom', email);
  }

  driverOnline(email, location) {
    this.socket?.emit('driverOnline', { email, location });
  }

  driverOffline(email) {
    this.socket?.emit('driverOffline', email);
  }

  updateDriverLocation(email, location, rideId = null) {
    this.socket?.emit('updateDriverLocation', { email, location, rideId });
  }

  driverHeartbeat(email) {
    this.socket?.emit('driverHeartbeat', { email });
  }

  emitNewRide(ride) {
    this.socket?.emit('newRide', ride);
  }

  emitRideUpdated(ride) {
    this.socket?.emit('rideUpdated', ride);
  }

  emitDriverLocationUpdated(data) {
    this.socket?.emit('driverLocationUpdated', data);
  }

  on(event, callback) {
    this.socket?.on(event, callback);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    this.socket?.off(event, callback);
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  removeAllListeners() {
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.off(event, callback);
      });
    });
    this.listeners.clear();
  }
}

export const socketService = new SocketService();
export default socketService;
