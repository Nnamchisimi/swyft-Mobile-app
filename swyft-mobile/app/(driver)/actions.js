import { Alert } from 'react-native';
import { authService } from '../../src/services/auth';
import { ridesAPI, driverAPI } from '../../src/services/api';
import { socketService } from '../../src/services/socket';

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
}

export async function handleAcceptRide(ride, driverInfo, authService, ridesAPI, setCurrentRide, setPendingRides) {
  Alert.alert(
    'Accept Ride',
    `Accept ride from ${ride.passenger_name || ride.passenger_email}?\n\nPickup: ${ride.pickup_location || ride.pickup}\nFare: ₺${ride.price || '0.00'}`,
    [
      { text: 'Cancel', style: 'cancel', onPress: () => handleDeclineRide(ride, setPendingRides) },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            const driverData = {
              name: `${driverInfo?.firstName || ''} ${driverInfo?.lastName || ''}`.trim() || 'Driver',
              email: driverInfo?.email || await authService.getUserEmail(),
              phone: driverInfo?.phone || 'N/A',
              vehicle: driverInfo?.vehicle || `${driverInfo?.vehicleYear || ''} ${driverInfo?.vehicleMake || ''} ${driverInfo?.vehicleModel || ''}`.trim(),
            };

            await ridesAPI.acceptRide(ride.id, driverData);

            setCurrentRide({ ...ride, ...driverData, status: 'driver_accepted' });
            setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));

            Alert.alert('Success', 'Ride accepted! Waiting for passenger to confirm...');
          } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to accept ride');
          }
        },
      },
    ]
  );
}

export function handleDeclineRide(ride, setPendingRides) {
  setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
}

export async function handleArrivedAtPickup(currentRide, ridesAPI, setCurrentRide) {
  if (!currentRide) return;

  ridesAPI.startRide(currentRide.id)
    .then(() => {
      setCurrentRide({ ...currentRide, status: 'arrived_pickup' });
      Alert.alert('Arrived at Pickup', 'The sender has been notified that you have arrived. Waiting for package handoff...');
    })
    .catch(() => {
      Alert.alert('Error', 'Failed to update status');
    });
}

export async function handleStartRide(currentRide, ridesAPI, setCurrentRide, mapRef) {
  if (!currentRide) return;

  ridesAPI.confirmPickup(currentRide.id)
    .then(() => {
      setCurrentRide({ ...currentRide, status: 'active' });

      if (mapRef.current && currentRide.pickup_lat && currentRide.pickup_lng && currentRide.dropoff_lat && currentRide.dropoff_lng) {
        const pickupLat = parseFloat(currentRide.pickup_lat);
        const pickupLng = parseFloat(currentRide.pickup_lng);
        const dropoffLat = parseFloat(currentRide.dropoff_lat);
        const dropoffLng = parseFloat(currentRide.dropoff_lng);

        const centerLat = (pickupLat + dropoffLat) / 2;
        const centerLng = (pickupLng + dropoffLng) / 2;

        const latDelta = Math.abs(dropoffLat - pickupLat) * 1.5 + 0.01;
        const lngDelta = Math.abs(dropoffLng - pickupLng) * 1.5 + 0.01;

        mapRef.current.animateToRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: Math.max(latDelta, 0.02),
          longitudeDelta: Math.max(lngDelta, 0.02),
        }, 1000);
      }

      Alert.alert('Package Picked Up', 'Drive safely!');
    })
    .catch(() => {
      Alert.alert('Error', 'Failed to start delivery');
    });
}

export async function handleArriving(currentRide, ridesAPI, setCurrentRide) {
  if (!currentRide) return;

  ridesAPI.arriveRide(currentRide.id)
    .then(() => {
      setCurrentRide({ ...currentRide, status: 'arriving' });
      Alert.alert('Arriving', 'You have marked as arriving at destination.');
    })
    .catch(() => {
      Alert.alert('Error', 'Failed to update status');
    });
}

export async function handleCompleteRide(currentRide, ridesAPI, setCurrentRide, setLoading) {
  if (!currentRide) return;

  const price = currentRide.price || 0;

  const enterOtp = () => {
    let otpValue = '';
    Alert.alert(
      'Complete Delivery',
      'Enter the 6-digit OTP provided by the customer to confirm delivery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            if (!otpValue || otpValue.length !== 6) {
              Alert.alert('Error', 'Please enter a valid 6-digit OTP');
              return;
            }
            try {
              setLoading(true);
              const response = await ridesAPI.verifyOtp(currentRide.id, otpValue);
              if (response.success) {
                setCurrentRide({ ...currentRide, status: 'completed' });
                Alert.alert('Delivery Completed', 'Payment has been released to you. Thank you for your service!');
              } else {
                Alert.alert('Error', response.error || 'Invalid OTP. Please try again.');
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to verify OTP');
            } finally {
              setLoading(false);
            }
          }
        }
      ],
      {
        textInput: {
          placeholder: 'Enter 6-digit OTP',
          keyboardType: 'numeric',
          maxLength: 6,
          onChangeText: (text) => { otpValue = text; }
        }
      }
    );
  };

  enterOtp();
}

export async function handleCancelCurrentRide(currentRide, ridesAPI, setCurrentRide, fetchPendingRides) {
  if (!currentRide) return;

  Alert.alert(
    'Cancel Ride',
    'Are you sure you want to cancel this ride? This may affect your rating.',
    [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await ridesAPI.cancelRide(currentRide.id);
            setCurrentRide(null);
            fetchPendingRides();
          } catch (error) {
            Alert.alert('Error', 'Failed to cancel dispatch');
          }
        },
      },
    ]
  );
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
