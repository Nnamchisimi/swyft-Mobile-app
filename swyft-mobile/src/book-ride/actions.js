import { Alert, Linking } from 'react-native';
import { ridesAPI, authService, paymentAPI } from '../services/api';

export async function handleBookRide(state) {
  const {
    interCityMode, interCityRoute, selectedRideType, selectedVehicleType,
    pickupAddress, dropoffLocation: dropoffLocationValue, receiverName, receiverEmail,
    receiverPhone, userName, userEmail, userPhone, estimatedPrice,
    packageType, packageSize, packageDetails, specialInstructions,
    pickupLocation, currentLocation, setCurrentRide, setRideBooked,
    setPickupLockedForRide, setLoading, paymentMethod, setPendingRideData, router
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

    if (paymentMethod === 'cash') {
      const response = await ridesAPI.createRide(rideData);
      const ride = response.data;
      setCurrentRide({ id: ride.rideId, ...rideData, status: 'pending' });
      setRideBooked(true);
      setPickupLockedForRide(true);
    } else {
      setPendingRideData({ ...rideData, paymentMethod });
      router.push('/(passenger)/payment-webview');
    }
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Failed to book dispatch. Please try again.';
    console.error('[BOOK_RIDE_ERROR]', JSON.stringify({ message, data: error?.response?.data, stack: error?.stack }));
    Alert.alert('Booking Error', message);
  } finally {
    setLoading(false);
  }
}

export async function handleCancelRide(state) {
  const { currentRide, setRideBooked, setCurrentRide, resetForm } = state;
  if (!currentRide) return;

  try {
    const email = await authService.getUserEmail();
    await ridesAPI.cancelRide(currentRide.id || currentRide.rideId, email);
    resetForm();
    Alert.alert('Cancelled', 'Your delivery has been cancelled.');
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Failed to cancel ride';
    Alert.alert('Error', message);
  }
}

export function handleCallDriver(driverPhone) {
  if (driverPhone) {
    Linking.openURL(`tel:${driverPhone}`);
  } else {
    Alert.alert('Error', 'Driver phone number not available');
  }
}