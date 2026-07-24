import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { ridesAPI, fareAPI } from '../services/api';
import { authService } from '../services/auth';
import { socketService } from '../services/socket';
import geoService from '../services/geo';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { interCityRoutesData, defaultRideTypes, defaultVehicleTypes, mountainKeywords } from './constants';

export function useBookRideState() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [pickupManuallySelected, setPickupManuallySelected] = useState(false);
  const [pickupLockedForRide, setPickupLockedForRide] = useState(false);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverStatus, setDriverStatus] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [driverDistance, setDriverDistance] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [rideBooked, setRideBooked] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedRideType, setSelectedRideType] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [packageType, setPackageType] = useState('');
  const [packageSize, setPackageSize] = useState('');
  const [packageDetails, setPackageDetails] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedQuickNote, setSelectedQuickNote] = useState('');
  const [interCityMode, setInterCityMode] = useState(false);
  const [interCityRoute, setInterCityRoute] = useState('');
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [surchargeDetails, setSurchargeDetails] = useState([]);
  const [priceBreakdownExpanded, setPriceBreakdownExpanded] = useState(false);
  const [vehicleTypesExpanded, setVehicleTypesExpanded] = useState(false);
  const [pickupMapsUrl, setPickupMapsUrl] = useState('');
  const [dropoffMapsUrl, setDropoffMapsUrl] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [rideTypes, setRideTypes] = useState(defaultRideTypes);
  const [vehicleTypes, setVehicleTypes] = useState(defaultVehicleTypes);
  
  const pickupDebounceRef = useRef(null);
  const dropoffDebounceRef = useRef(null);

  const resetForm = () => {
    setRideBooked(false);
    setCurrentRide(null);
    setDriverLocation(null);
    setDriverDistance(null);
    setPickupManuallySelected(false);
    setPickupLockedForRide(false);
    setPickupAddress('');
    setDropoffAddress('');
    setSelectedRideType('');
    setSelectedVehicleType('');
    setPackageType('');
    setPackageSize('');
    setPackageDetails('');
    setSpecialInstructions('');
  };

  const navigateToDriverArrived = (params) => router.push({ pathname: '/(passenger)/driver-arrived', params });

  const actions = useBookRideActions({
    interCityMode, interCityRoute, selectedRideType, selectedVehicleType,
    pickupAddress, dropoffLocation, dropoffAddress, receiverName, receiverEmail, receiverPhone,
    userName, userEmail, userPhone, estimatedPrice, packageType, packageSize,
    packageDetails, specialInstructions, pickupLocation, currentLocation, currentRide,
    setCurrentRide, setRideBooked, setPickupLockedForRide, setLoading, resetForm,
    setPickupManuallySelected,
  });

  const set = (key, value) => {
    const setterMap = {
      loading: setLoading, userDataLoading: setUserDataLoading, userEmail: setUserEmail,
      userName: setUserName, userPhone: setUserPhone, currentLocation: setCurrentLocation,
      pickupLocation: setPickupLocation, pickupManuallySelected: setPickupManuallySelected,
      pickupLockedForRide: setPickupLockedForRide, dropoffLocation: setDropoffLocation,
      driverLocation: setDriverLocation, driverStatus: setDriverStatus,
      routeCoordinates: setRouteCoordinates, driverDistance: setDriverDistance,
      pickupAddress: setPickupAddress, dropoffAddress: setDropoffAddress,
      pickupSuggestions: setPickupSuggestions, dropoffSuggestions: setDropoffSuggestions,
      showPickupSuggestions: setShowPickupSuggestions, showDropoffSuggestions: setShowDropoffSuggestions,
      rideBooked: setRideBooked, currentRide: setCurrentRide, locationLoading: setLocationLoading,
      selectedRideType: setSelectedRideType, estimatedPrice: setEstimatedPrice,
      packageType: setPackageType, packageSize: setPackageSize, packageDetails: setPackageDetails,
      specialInstructions: setSpecialInstructions, selectedQuickNote: setSelectedQuickNote,
      interCityMode: setInterCityMode, interCityRoute: setInterCityRoute,
      pricingLoaded: setPricingLoaded, selectedVehicleType: setSelectedVehicleType,
      surchargeDetails: setSurchargeDetails, priceBreakdownExpanded: setPriceBreakdownExpanded,
      vehicleTypesExpanded: setVehicleTypesExpanded, pickupMapsUrl: setPickupMapsUrl,
      dropoffMapsUrl: setDropoffMapsUrl, receiverName: setReceiverName,
      receiverEmail: setReceiverEmail, receiverPhone: setReceiverPhone,
      rideTypes: setRideTypes, vehicleTypes: setVehicleTypes,
    };
    if (key === 'pickupDebounceRef') { pickupDebounceRef.current = value; }
    else if (key === 'dropoffDebounceRef') { dropoffDebounceRef.current = value; }
    else { const setter = setterMap[key]; if (setter) setter(value); else console.warn(`No setter found for key: ${key}`); }
  };

  return {
    loading, setLoading,
    userDataLoading, setUserDataLoading,
    userEmail, setUserEmail,
    userName, setUserName,
    userPhone, setUserPhone,
    currentLocation, setCurrentLocation,
    pickupLocation, setPickupLocation,
    pickupManuallySelected, setPickupManuallySelected,
    pickupLockedForRide, setPickupLockedForRide,
    dropoffLocation, setDropoffLocation,
    driverLocation, setDriverLocation,
    driverStatus, setDriverStatus,
    routeCoordinates, setRouteCoordinates,
    driverDistance, setDriverDistance,
    pickupAddress, setPickupAddress,
    dropoffAddress, setDropoffAddress,
    pickupSuggestions, setPickupSuggestions,
    dropoffSuggestions, setDropoffSuggestions,
    showPickupSuggestions, setShowPickupSuggestions,
    showDropoffSuggestions, setShowDropoffSuggestions,
    rideBooked, setRideBooked,
    currentRide, setCurrentRide,
    locationLoading, setLocationLoading,
    selectedRideType, setSelectedRideType,
    estimatedPrice, setEstimatedPrice,
    packageType, setPackageType,
    packageSize, setPackageSize,
    packageDetails, setPackageDetails,
    specialInstructions, setSpecialInstructions,
    selectedQuickNote, setSelectedQuickNote,
    interCityMode, setInterCityMode,
    interCityRoute, setInterCityRoute,
    pricingLoaded, setPricingLoaded,
    selectedVehicleType, setSelectedVehicleType,
    surchargeDetails, setSurchargeDetails,
    priceBreakdownExpanded, setPriceBreakdownExpanded,
    vehicleTypesExpanded, setVehicleTypesExpanded,
    pickupMapsUrl, setPickupMapsUrl,
    dropoffMapsUrl, setDropoffMapsUrl,
    receiverName, setReceiverName,
    receiverEmail, setReceiverEmail,
    receiverPhone, setReceiverPhone,
    rideTypes, setRideTypes,
    vehicleTypes, setVehicleTypes,
    pickupDebounceRef,
    dropoffDebounceRef,
    resetForm,
    navigateToDriverArrived,
    set,
    actions,
  };
}

export function useBookRideEffects(state) {
  const {
    userEmail, setUserEmail, userName, setUserName, userPhone, setUserPhone,
    userDataLoading, setUserDataLoading, pickupLockedForRide, setPickupLockedForRide,
    setCurrentLocation, setLocationLoading, setPickupAddress, setPickupManuallySelected,
    setRouteCoordinates, setCurrentRide, setRideBooked, setPickupLocation, setPickupAddr,
    setDropoffAddress, setSelectedRideType, setSelectedVehicleType, setPackageType,
    setPackageSize, setPackageDetails, setSpecialInstructions, setUserDataLoading: setUserDataLoading2,
    selectedRideType, selectedVehicleType, interCityMode, interCityRoute,
    rideTypes, vehicleTypes, setRideTypes, setVehicleTypes, dropoffAddress, setEstimatedPrice, setSurchargeDetails,
    packageSize, setSelectedVehicleType: setVehicleType, pricingLoaded, setPricingLoaded,
    driverLocation, setDriverLocation, setDriverStatus, setDriverDistance,
    pickupLocation, currentRide, currentLocation: currentLoc
  } = state;

  useEffect(() => {
    loadUserData();
    const cleanup = setupSocketListeners();
    return () => { cleanup(); socketService.removeAllListeners(); };
  }, []);

  useEffect(() => {
    if (userEmail && !userDataLoading && !pickupLockedForRide) {
      getCurrentLocation();
    }
  }, [userEmail, userDataLoading, pickupLockedForRide]);

  useEffect(() => { if (userEmail) socketService.joinRoom(userEmail); }, [userEmail]);

   useEffect(() => {
    let passengerSubscription = null;
    const startPassengerLocationTracking = async () => {
      if (!userEmail || !currentRide) return;
       if (!['accepted'].includes(currentRide.status)) return;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        passengerSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
          (loc) => {
            socketService.updatePassengerLocation(userEmail, {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            }, currentRide.id);
          }
        );
      } catch (error) {
        console.error('Error starting passenger location tracking:', error);
      }
    };

    startPassengerLocationTracking();

    return () => {
      if (passengerSubscription) {
        try { passengerSubscription.remove(); } catch (e) {}
      }
    };
  }, [userEmail, currentRide]);

  useEffect(() => { loadPricing(); }, []);

  useEffect(() => { calculateFare(); }, [selectedRideType, selectedVehicleType, interCityMode, interCityRoute, pricingLoaded, dropoffAddress]);

  useEffect(() => {
    if (packageSize) {
      if (packageSize === 'Small') setVehicleType('motorcycle');
      else if (packageSize === 'Medium') setVehicleType('sedan');
      else if (packageSize === 'Large') setVehicleType('truck');
    }
  }, [packageSize]);

  async function loadUserData() {
    const email = await authService.getUserEmail();
    const info = await authService.getDriverInfo();
    setUserEmail(email || ''); setUserName(info?.name || 'Passenger'); setUserPhone(info?.phone || '');
    await loadActiveRide(email); setUserDataLoading(false);
  }

  async function loadActiveRide(email) {
    if (!email) { setUserDataLoading(false); return; }
    try {
      const response = await ridesAPI.getRides({ passenger_email: email });
      if (response.data?.length) {
        const activeRide = response.data.find(r => ['driver_accepted', 'accepted', 'arrived_pickup', 'active', 'arriving', 'pending'].includes(r.status));
        if (activeRide) {
          setCurrentRide(activeRide); setRideBooked(true);
          setPickupAddr(activeRide.pickup || activeRide.pickup_location || '');
          setDropoffAddress(activeRide.dropoff || activeRide.dropoff_location || '');
          if (activeRide.price) setEstimatedPrice(parseFloat(activeRide.price));
          if (activeRide.ride_type) setSelectedRideType(activeRide.ride_type);
          if (activeRide.vehicle_type) setSelectedVehicleType(activeRide.vehicle_type);
          if (activeRide.package_type) setPackageType(activeRide.package_type);
          if (activeRide.package_size) setPackageSize(activeRide.package_size);
          if (activeRide.package_details) setPackageDetails(activeRide.package_details);
          if (activeRide.special_instructions) setSpecialInstructions(activeRide.special_instructions);
          setPickupLockedForRide(true);
          if (activeRide.pickup_lat && activeRide.pickup_lng) setPickupLocation({ latitude: parseFloat(activeRide.pickup_lat), longitude: parseFloat(activeRide.pickup_lng) });
          if (['arrived_pickup', 'active', 'arriving'].includes(activeRide.status)) {
            state.navigateToDriverArrived({
              rideId: activeRide.id, driverName: activeRide.driver_name, driverPhone: activeRide.driver_phone,
              driverVehicle: activeRide.driver_vehicle, pickupAddress: activeRide.pickup || activeRide.pickup_location || '',
              dropoffAddress: activeRide.dropoff || activeRide.dropoff_location || '', pickupLat: activeRide.pickup_lat, pickupLng: activeRide.pickup_lng
            });
          }
          setUserDataLoading(false); return;
        }
      }
    } catch (error) { console.log('No active ride found'); }
    setUserDataLoading(false);
  }

  async function loadPricing() {
    try {
      const response = await fareAPI.getPricing();
      if (response.data) {
        const { locationPrices, vehiclePrices } = response.data;
        setRideTypes(prev => prev.map(ride => ({ ...ride, basePrice: locationPrices[ride.id] || ride.basePrice || 0 })));
        setVehicleTypes(prev => prev.map(vehicle => ({ ...vehicle, price: vehiclePrices[vehicle.id] || vehicle.price || 0 })));
        setPricingLoaded(true);
      }
    } catch (error) { console.log('Error loading pricing:', error); setPricingLoaded(true); }
  }

  function calculateFare() {
    let totalPrice = 0, basePrice = 0, vehiclePrice = 0;
    if (interCityMode && interCityRoute) {
      const route = interCityRoutesData.find(r => r.id === interCityRoute);
      basePrice = route?.basePrice || 0;
      vehiclePrice = selectedVehicleType ? (vehicleTypes.find(v => v.id === selectedVehicleType)?.price || 0) : 0;
      totalPrice = basePrice + vehiclePrice;
    } else {
      const ride = rideTypes.find(r => r.id === selectedRideType);
      const vehicle = vehicleTypes.find(v => v.id === selectedVehicleType);
      basePrice = ride?.basePrice || 0; vehiclePrice = vehicle?.price || 0;
      totalPrice = basePrice + vehiclePrice;
    }
    let surcharge = 0; const surchargeDetails = [];
    if (dropoffAddress) {
      const isMountain = mountainKeywords.some(kw => dropoffAddress.toLowerCase().includes(kw.toLowerCase()));
      if (isMountain) { surcharge += 80; surchargeDetails.push({ name: 'Mountain/Village Fee', amount: 80 }); }
    }
    const currentHour = new Date().getHours();
    if (currentHour >= 21 || currentHour < 6) { surcharge += 50; surchargeDetails.push({ name: 'Night Shift (after 9PM)', amount: 50 }); }
    totalPrice += surcharge; setEstimatedPrice(totalPrice); setSurchargeDetails(surchargeDetails);
  }

  function setupSocketListeners() {
    socketService.connect();
    if (userEmail) socketService.joinRoom(userEmail);

    socketService.on('rideCreated', (ride) => {
      if (ride.passenger_email === userEmail) {
        setCurrentRide({ id: ride.id, ...ride, status: 'requested' }); setRideBooked(true); setPickupLockedForRide(true);
        if (ride.pickup_lat && ride.pickup_lng) setPickupLocation({ latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) });
        if (ride.pickup || ride.pickup_location) setPickupAddress(ride.pickup || ride.pickup_location);
      }
    });

    socketService.on('rideUpdated', (ride) => {
      if (ride.id === currentRide?.id || ride.passenger_email === userEmail || ride.passengerEmail === userEmail) {
    setCurrentRide((prev) => {
      const base = prev || {};
      const safeRide = Object.fromEntries(
        Object.entries(ride).filter(([_, v]) => v !== undefined)
      );
      return { ...base, ...safeRide };
    });
    if (ride.status === 'driver_accepted' || ride.status === 'accepted') {
      if (ride.dropoff_location || ride.dropoff) {
        setDropoffAddress(ride.dropoff_location || ride.dropoff);
      }
      if (ride.price) {
        setEstimatedPrice(ride.price);
      }
      if (ride.pickup_lat && ride.pickup_lng) {
        setPickupLocation({ latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) });
      }
      if (ride.dropoff_lat && ride.dropoff_lng) {
        setDropoffLocation({ latitude: parseFloat(ride.dropoff_lat), longitude: parseFloat(ride.dropoff_lng) });
      }
    }
    if (['accepted', 'arrived_pickup', 'active', 'arriving'].includes(ride.status)) {
      if (ride.driver_lat && ride.driver_lng) {
        setDriverLocation({ latitude: parseFloat(ride.driver_lat), longitude: parseFloat(ride.driver_lng) });
        if (pickupLocation) geoService.getETA({ latitude: parseFloat(ride.driver_lat), longitude: parseFloat(ride.driver_lng) }, pickupLocation).then(result => { if (result?.duration) setDriverDistance(Math.round(result.duration / 60)); });
      } else if (ride.pickup_lat && ride.pickup_lng) setDriverLocation({ latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) });
    }
    setRideBooked(true);
    if (ride.status === 'cancelled' || ride.status === 'canceled') {
      Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
      setRideBooked(false);
      state.resetForm?.();
    }
      }
    });

    socketService.on('dispatchUpdated', (dispatch) => {
      if (dispatch.passenger_email === userEmail || dispatch.passengerEmail === userEmail) {
        const safeDispatch = Object.fromEntries(
          Object.entries(dispatch).filter(([_, v]) => v !== undefined)
        );
        setCurrentRide((prev) => ({ ...(prev || {}), ...safeDispatch }));
        setRideBooked(true);
      }
    });

    return () => socketService.removeAllListeners();
  }

  async function getCurrentLocation() {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Location permission is required.'); setLocationLoading(false); return; }
      const location = await Location.getCurrentPositionAsync({});
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setCurrentLocation(coords);
      if (state.dropoffLocation) { const routeCoords = await geoService.getRouteCoordinates(coords, state.dropoffLocation); setRouteCoordinates(routeCoords?.length ? routeCoords : [coords, state.dropoffLocation]); }
      try {
        const addressStr = await geoService.reverseGeocode(coords.latitude, coords.longitude);
        if (addressStr) { if (!state.pickupManuallySelected && !state.pickupLockedForRide && !state.pickupAddress) setPickupAddress(addressStr); }
        else { if (!state.pickupManuallySelected && !state.pickupLockedForRide && !state.pickupAddress) setPickupAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`); }
      } catch { if (!state.pickupManuallySelected && !state.pickupLockedForRide && !state.pickupAddress) setPickupAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`); }
    } catch (error) { console.error('Error getting location:', error); Alert.alert('Error', 'Could not get your current location.'); }
    finally { setLocationLoading(false); }
  }

  return { loadUserData, loadPricing, calculateFare, setupSocketListeners, getCurrentLocation };
}

export function useBookRideActions(state) {
  const {
    setCurrentRide, setRideBooked, setPickupLockedForRide, setLoading,
    resetForm
  } = state;

  async function handleBookRide() {
    const {
      interCityMode, interCityRoute, selectedRideType, selectedVehicleType, pickupAddress, dropoffAddress,
      receiverName, receiverEmail, receiverPhone, userName, userEmail, userPhone, estimatedPrice,
      packageType, packageSize, packageDetails, specialInstructions, pickupLocation, currentLocation
    } = state;

    if (interCityMode) {
      if (!interCityRoute || !selectedVehicleType) { Alert.alert('Error', 'Please select a route and vehicle type'); return; }
    } else {
      if (!selectedRideType || !selectedVehicleType) { Alert.alert('Error', 'Please select a city hub area and vehicle type'); return; }
    }
    if (!pickupAddress || !dropoffAddress) { Alert.alert('Error', 'Please enter both pickup and dropoff locations'); return; }
    if (!receiverName || !receiverName.trim()) { Alert.alert('Error', 'Please enter receiver name'); return; }
    if (!receiverEmail || !receiverEmail.trim()) { Alert.alert('Error', 'Please enter receiver email'); return; }
    if (!receiverPhone || !receiverPhone.trim()) { Alert.alert('Error', 'Please enter receiver phone number'); return; }
    if (!userName || !userName.trim()) { Alert.alert('Error', 'User data not loaded yet.'); return; }

    Alert.alert('Confirm Receiver Details', `Name: ${receiverName}\nEmail: ${receiverEmail}\nPhone: ${receiverPhone}`, [
      { text: 'Edit', style: 'cancel' },
      { text: 'Confirm & Book', onPress: async () => {
        setLoading(true);
        try {
          const rideData = {
            passenger_email: userEmail, passenger_name: userName, passenger_phone: userPhone,
            pickup: pickupAddress, dropoff: dropoffAddress,
            pickup_lat: pickupLocation?.latitude || currentLocation?.latitude,
            pickup_lng: pickupLocation?.longitude || currentLocation?.longitude,
            dropoff_lat: state.dropoffLocation?.latitude,
            dropoff_lng: state.dropoffLocation?.longitude,
            ride_type: interCityMode ? interCityRoute : selectedRideType,
            vehicle_type: selectedVehicleType, package_type: packageType, package_size: packageSize,
            package_details: packageDetails, special_instructions: specialInstructions,
            price: estimatedPrice, status: 'pending', inter_city: interCityMode,
            receiver_name: receiverName || null, receiver_email: receiverEmail || null, receiver_phone: receiverPhone || null,
          };
          const response = await ridesAPI.createRide(rideData);
          const ride = response.data;
          setCurrentRide({ id: ride.rideId, ...rideData, status: 'pending' });
          setRideBooked(true);
          setPickupLockedForRide(true);
          Alert.alert('Courier Requested!', 'Looking for nearby couriers...');
        } catch (error) {
          console.error('Booking error:', error);
          Alert.alert('Error', 'Failed to book dispatch.');
        } finally {
          setLoading(false);
        }
      }},
    ]);
  }

  function handleCancelRide() {
    const { currentRide } = state;
    if (!currentRide) return;
    Alert.alert('Cancel Dispatch', 'Are you sure you want to cancel this dispatch?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        try {
          await ridesAPI.cancelRide(currentRide.id || currentRide.rideId);
          resetForm();
          Alert.alert('Cancelled', 'Your ride has been cancelled.');
        } catch (error) {
          Alert.alert('Error', 'Failed to cancel ride');
        }
      }},
    ]);
  }

  async function handleConfirmPickup() {
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

  async function handleConfirmComplete() {
    const { currentRide, setCurrentRide, setRideBooked } = state;
    if (!currentRide) return;
    Alert.alert('Confirm Delivery Complete', 'Has your delivery been completed successfully?', [
      { text: 'Not Yet', style: 'cancel' },
      { text: 'Yes, Complete', onPress: async () => {
        try {
          await ridesAPI.confirmComplete(currentRide.id);
          setCurrentRide({ ...currentRide, status: 'confirmed' });
          setRideBooked(false);
          Alert.alert('Delivery Confirmed', 'Payment has been released to the courier. Thank you!');
        } catch (error) {
          Alert.alert('Error', 'Failed to confirm delivery');
        }
      }},
    ]);
  }

  return { handleBookRide, handleCancelRide, handleConfirmPickup, handleConfirmComplete };
}