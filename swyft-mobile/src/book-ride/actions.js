import { Alert, Linking } from 'react-native';
import { ridesAPI } from '../services/api';

export async function handleBookRide(state) {
  const {
    interCityMode, interCityRoute, selectedRideType, selectedVehicleType,
    pickupAddress, dropoffLocation: dropoffLocationValue, receiverName, receiverEmail,
    receiverPhone, userName, userEmail, userPhone, estimatedPrice,
    packageType, packageSize, packageDetails, specialInstructions,
    pickupLocation, currentLocation, setCurrentRide, setRideBooked,
    setPickupLockedForRide, setLoading
  } = state;

  const vehicleType = selectedVehicleType || (packageSize === 'Small' ? 'motorcycle' : packageSize === 'Medium' ? 'sedan' : packageSize === 'Large' ? 'truck' : null);

  const missing = [];
  if (!pickupAddress?.trim()) missing.push('pickup location');
  if (!dropoffLocationValue) missing.push('dropoff location');
  if (!receiverName?.trim()) missing.push('receiver name');
  if (!receiverEmail?.trim()) missing.push('receiver email');
  if (!receiverPhone?.trim()) missing.push('receiver phone');
  if (!userName?.trim()) missing.push('user data');
  if (interCityMode) {
    if (!interCityRoute) missing.push('inter-city route');
  } else {
    if (!selectedRideType) missing.push('city hub area');
  }
  if (!vehicleType) missing.push('vehicle type (select package size)');

  if (missing.length > 0) {
    Alert.alert('Missing Information', 'Please select: ' + missing.join(', '));
    return;
  }

  Alert.alert('Confirm Receiver Details', `Please verify the receiver details are correct before booking:\n\nName: ${receiverName}\nEmail: ${receiverEmail}\nPhone: ${receiverPhone}`, [
    { text: 'Edit', style: 'cancel' },
    {
      text: 'Confirm & Book',
      onPress: async () => {
        setLoading(true);
        try {
          const rideData = {
            passenger_email: userEmail,
            passenger_name: userName,
            passenger_phone: userPhone,
            pickup: pickupAddress,
            dropoff: dropoffLocationValue,
            pickup_lat: pickupLocation?.latitude || currentLocation?.latitude,
            pickup_lng: pickupLocation?.longitude || currentLocation?.longitude,
            dropoff_lat: dropoffLocationValue?.latitude,
            dropoff_lng: dropoffLocationValue?.longitude,
            ride_type: interCityMode ? interCityRoute : selectedRideType,
            vehicle_type: vehicleType,
            package_type: packageType,
            package_size: packageSize,
            package_details: packageDetails,
            special_instructions: specialInstructions,
            price: estimatedPrice,
            status: 'pending',
            inter_city: interCityMode,
            receiver_name: receiverName || null,
            receiver_email: receiverEmail || null,
            receiver_phone: receiverPhone || null,
          };

          const response = await ridesAPI.createRide(rideData);
          const ride = response.data;

          setCurrentRide({ id: ride.rideId, ...rideData, status: 'pending' });
          setRideBooked(true);
          setPickupLockedForRide(true);

          Alert.alert('Courier Requested!', 'Looking for nearby couriers...\n\nYou will be notified when a courier accepts your ride.');
        } catch (error) {
          const message = error?.response?.data?.message || error?.message || 'Failed to book dispatch. Please try again.';
          console.error('[BOOK_RIDE_ERROR]', JSON.stringify({ message, data: error?.response?.data, stack: error?.stack }));
          Alert.alert('Booking Error', message);
        } finally {
          setLoading(false);
        }
      },
    },
  ]);
}

export async function handleCancelRide(state) {
  const { currentRide, setRideBooked, setCurrentRide, setPickupManuallySelected, setPickupLockedForRide, resetForm } = state;
  if (!currentRide) return;

  Alert.alert('Cancel Dispatch', 'Are you sure you want to cancel this dispatch?', [
    { text: 'No', style: 'cancel' },
    {
      text: 'Yes, Cancel',
      style: 'destructive',
      onPress: async () => {
        try {
          const email = await authService.getUserEmail();
          await ridesAPI.cancelRide(currentRide.id || currentRide.rideId, email);
          resetForm();
        } catch (error) {
          const message = error?.response?.data?.message || error?.message || 'Failed to cancel ride';
          console.error('[CANCEL_RIDE_ERROR]', JSON.stringify({ message, data: error?.response?.data }));
          Alert.alert('Error', message);
        }
      },
    },
  ]);
}

export async function handleConfirmPickup(state) {
  const { currentRide, setCurrentRide } = state;
  if (!currentRide) return;
  try {
    await ridesAPI.confirmPickup(currentRide.id);
    setCurrentRide({ ...currentRide, status: 'active' });
    Alert.alert('Pickup Confirmed', 'Your ride has started!');
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Failed to confirm pickup';
    console.error('[CONFIRM_PICKUP_ERROR]', JSON.stringify({ message, data: error?.response?.data }));
    Alert.alert('Error', message);
  }
}

export async function handleConfirmComplete(state) {
  const { currentRide, setCurrentRide, setRideBooked, resetForm } = state;
  if (!currentRide) return;
  Alert.alert('Confirm Delivery Complete', 'Has your delivery been completed successfully?', [
    { text: 'Not Yet', style: 'cancel' },
    {
      text: 'Yes, Complete',
      onPress: async () => {
        try {
          await ridesAPI.confirmComplete(currentRide.id);
          setCurrentRide({ ...currentRide, status: 'confirmed' });
          setRideBooked(false);
          Alert.alert('Delivery Confirmed', 'Payment has been released to the courier. Thank you!');
          } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to confirm delivery';
            console.error('[CONFIRM_COMPLETE_ERROR]', JSON.stringify({ message, data: error?.response?.data }));
            Alert.alert('Error', message);
        }
      },
    },
  ]);
}

export function handleCallDriver(driverPhone) {
  if (driverPhone) {
    Linking.openURL(`tel:${driverPhone}`);
  } else {
    Alert.alert('Error', 'Driver phone number not available');
  }
}