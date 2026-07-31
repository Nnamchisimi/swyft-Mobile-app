import { Alert } from 'react-native';
import { authService } from '../../src/services/auth';
import { ridesAPI, driverAPI } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { setLastKnownOnlineStatus } from './hooks';

export async function toggleOnline(isOnline, setIsOnline, isOnlineRef, driverInfo, socketService, fetchPendingRides, setPendingRides, location, locationRef, router) {
  if (!isOnline && !location && !locationRef.current) {
    Alert.alert('Error', 'Location not available. Please try again.');
    return;
  }

  const email = driverInfo?.email || authService.getUserEmail();
  const currentLocation = location || locationRef.current;
  const newStatus = !isOnline;

  if (newStatus) {
    try {
      const verificationResponse = await driverAPI.getVerificationStatus(email);
      const status = verificationResponse.data;
      const verified = status && status.is_approved;
      if (!verified) {
        Alert.alert(
          'Verification Required',
          'You must complete your identity, selfie, phone, and bank verification before you can go online. Complete all steps now.',
          [
            { text: 'Verify Now', onPress: () => router.push('/(driver)/verify-summary') },
            { text: 'Later', style: 'cancel' },
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Could not verify your account status. Please try again.');
        return;
      }
    }
  }

  if (newStatus) {
    socketService.driverOnline(email, {
      lat: currentLocation?.latitude,
      lng: currentLocation?.longitude,
    });

    fetchPendingRides();
  } else {
    socketService.driverOffline(email);
    setPendingRides([]);
  }

  setIsOnline(newStatus);
  isOnlineRef.current = newStatus;
  setLastKnownOnlineStatus(newStatus);
}

export async function handleAcceptRide(ride, driverInfo, authService, ridesAPI, setCurrentRide, setPendingRides) {
  try {
    const driverData = {
      name: `${driverInfo?.firstName || ''} ${driverInfo?.lastName || ''}`.trim() || 'Driver',
      email: driverInfo?.email || await authService.getUserEmail(),
      phone: driverInfo?.phone || 'N/A',
      vehicle: driverInfo?.vehicle || `${driverInfo?.vehicleYear || ''} ${driverInfo?.vehicleMake || ''} ${driverInfo?.vehicleModel || ''}`.trim(),
    };

    await ridesAPI.acceptRide(ride.id, driverData);

    setCurrentRide({ ...ride, ...driverData, status: 'accepted' });
    setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
  } catch (error) {
    Alert.alert('Error', error.response?.data?.error || 'Failed to accept ride');
  }
}

export function handleDeclineRide(ride, setPendingRides) {
  setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
}

export async function handleStartRide(currentRide, ridesAPI, setCurrentRide) {
  if (!currentRide) return;

  try {
    await ridesAPI.startRide(currentRide.id);
    setCurrentRide({ ...currentRide, status: 'picked_up' });
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || 'Failed to start delivery';
    Alert.alert('Error', message);
  }
}

export async function handleArrived(currentRide, ridesAPI, setCurrentRide) {
  if (!currentRide) return;

  try {
    await ridesAPI.arriveRide(currentRide.id);
    setCurrentRide({ ...currentRide, status: 'arrived_dropoff' });
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || 'Failed to mark as arrived';
    Alert.alert('Error', message);
  }
}

export async function handleCompleteRide(currentRide, ridesAPI, setCurrentRide, setLoading, router) {
  if (!currentRide) return;

  router.push({
    pathname: '/(driver)/driver-otp',
    params: { rideId: currentRide.id },
  });
}

export async function handleCancelCurrentRide(currentRide, ridesAPI, setCurrentRide, fetchPendingRides) {
  if (!currentRide) return;

  try {
    const email = await authService.getUserEmail();
    await ridesAPI.cancelRide(currentRide.id, email);
    setCurrentRide(null);
    fetchPendingRides();
  } catch (error) {
    Alert.alert('Error', 'Failed to cancel dispatch');
  }
}

export async function handleLogout(isOnline, authService, socketService, router) {
  Alert.alert('Logout', 'Are you sure you want to logout?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Logout',
      style: 'destructive',
      onPress: async () => {
        if (isOnline) {
          const email = await authService.getUserEmail();
          socketService.driverOffline(email);
        }
        await authService.logout();
        socketService.disconnect();
        router.replace('/(auth)/signin');
      },
    },
  ]);
}
