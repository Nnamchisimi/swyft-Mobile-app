import { Alert, Linking } from 'react-native';
import { ridesAPI } from '../../../src/services/api';

export async function handleBookRide(state) {
  const {
    interCityMode, interCityRoute, selectedRideType, selectedVehicleType,
    pickupAddress, dropoffLocation: dropoffLocationValue, receiverName, receiverEmail,
    receiverPhone, userName, userEmail, userPhone, estimatedPrice,
    packageType, packageSize, packageDetails, specialInstructions,
    pickupLocation, currentLocation, setCurrentRide, setRideBooked,
    setPickupLockedForRide, setLoading
  } = state;

  if (interCityMode) {
    if (!interCityRoute || !selectedVehicleType) { Alert.alert('Error', 'Please select a route and vehicle type'); return; }
  } else {
    if (!selectedRideType || !selectedVehicleType) { Alert.alert('Error', 'Please select a city hub area and vehicle type'); return; }
  }
  if (!pickupAddress || !dropoffLocationValue) { Alert.alert('Error', 'Please enter both pickup and dropoff locations'); return; }
  if (!receiverName?.trim()) { Alert.alert('Error', 'Please enter receiver name'); return; }
  if (!receiverEmail?.trim()) { Alert.alert('Error', 'Please enter receiver email'); return; }
  if (!receiverPhone?.trim()) { Alert.alert('Error', 'Please enter receiver phone number'); return; }
  if (!userName?.trim()) { Alert.alert('Error', 'User data not loaded yet.'); return; }

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
            vehicle_type: selectedVehicleType,
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
          console.error('Booking error:', error);
          Alert.alert('Error', 'Failed to book dispatch. Please try again.');
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
          await ridesAPI.cancelRide(currentRide.id || currentRide.rideId);
          resetForm();
          Alert.alert('Cancelled', 'Your ride has been cancelled.');
        } catch (error) {
          Alert.alert('Error', 'Failed to cancel ride');
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
    setCurrentRide({ ...currentRide, status: 'in_progress' });
    Alert.alert('Pickup Confirmed', 'Your ride has started!');
  } catch (error) {
    Alert.alert('Error', 'Failed to confirm pickup');
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
          Alert.alert('Error', 'Failed to confirm delivery');
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