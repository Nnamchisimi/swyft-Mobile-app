import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Dimensions,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_OSM } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ridesAPI, fareAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { socketService } from '../../src/services/socket';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

const { width } = Dimensions.get('window');

export default function BookRideScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  
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
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [rideTypes, setRideTypes] = useState([
    { id: 'economy', name: 'Lefkosa', icon: 'location', time: '5-60 min', desc: 'Affordable rides' },
    { id: 'standard', name: 'Girne', icon: 'location', time: '30-60mins', desc: 'Comfortable rides' },
    { id: 'luxury', name: 'Magusa', icon: 'location', time: '1-2 hrs', desc: 'Premium vehicles' },
  ]);
  const [vehicleTypes, setVehicleTypes] = useState([
    { id: 'motorcycle', name: 'Motorcycle', icon: 'bicycle', desc: 'Documents, small items', examples: 'Letters, small electronics, keys' },
    { id: 'sedan', name: 'Sedan', icon: 'car-sport', desc: 'Medium packages', examples: 'Clothing, small boxes, food orders' },
    { id: 'truck', name: 'Van/Truck', icon: 'bus', desc: 'Large packages', examples: 'Furniture, large boxes, appliances' },
  ]);

  
  const pickupDebounceRef = useRef(null);
  const dropoffDebounceRef = useRef(null);

  useEffect(() => {
    loadUserData();
    
    
    setupSocketListeners();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  
  useEffect(() => {
    
    
    
    
    if (userEmail && !userDataLoading && !pickupLockedForRide) {
      getCurrentLocation();
    }
  }, [userEmail, userDataLoading, pickupLockedForRide]);

  
  useEffect(() => {
    if (userEmail) {
      socketService.joinRoom(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const response = await fareAPI.getPricing();
      console.log('Pricing response:', response.data);
      if (response.data) {
        const { locationPrices, vehiclePrices } = response.data;
        
        setRideTypes(prev => prev.map(ride => ({
          ...ride,
          price: locationPrices[ride.id] || 0
        })));
        
        setVehicleTypes(prev => prev.map(vehicle => ({
          ...vehicle,
          price: vehiclePrices[vehicle.id] || 0
        })));
        
        setPricingLoaded(true);
        console.log('Prices loaded successfully');
      }
    } catch (error) {
      console.log('Error loading pricing:', error);
    }
  };

  useEffect(() => {
    calculateFare();
  }, [selectedRideType, selectedVehicleType, pricingLoaded]);

  useEffect(() => {
    if (packageSize) {
      if (packageSize === 'Small') {
        setSelectedVehicleType('motorcycle');
      } else if (packageSize === 'Medium') {
        setSelectedVehicleType('sedan');
      } else if (packageSize === 'Large') {
        setSelectedVehicleType('truck');
      }
    }
  }, [packageSize]);

  const calculateFare = async () => {
    const ride = rideTypes.find(r => r.id === selectedRideType);
    const vehicle = vehicleTypes.find(v => v.id === selectedVehicleType);
    const ridePrice = ride ? ride.price : 0;
    const vehiclePrice = vehicle ? vehicle.price : 0;
    setEstimatedPrice(ridePrice + vehiclePrice);
  };

  
  useEffect(() => {
    const handleAllDriverLocation = (data) => {
      console.log('Received driverLocationUpdated:', data);
      console.log('Current ride ID:', currentRide?.id);
      
      
      if (currentRide && data.rideId === currentRide.id) {
        const newDriverLoc = { latitude: data.lat, longitude: data.lng };
        setDriverLocation(newDriverLoc);
        
        
        if (data.status) {
          setDriverStatus(data.status);
        }
        
        
        const pickupLoc = pickupLocation ? { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude } : (currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null);
        const dropoffLoc = dropoffLocation;
        
        const newRoute = [];
        
        newRoute.push(newDriverLoc);
        
        if (pickupLoc) {
          newRoute.push(pickupLoc);
        }
        
        if (dropoffLoc) {
          newRoute.push(dropoffLoc);
        }
        setRouteCoordinates(newRoute);
        
        
        if (currentLocation) {
          const distanceKm = calculateDistance(
            newDriverLoc.latitude,
            newDriverLoc.longitude,
            currentLocation.latitude,
            currentLocation.longitude
          );
          const estimatedMinutes = Math.round(distanceKm * 2);
          setDriverDistance(estimatedMinutes);
        }
      }
    };
    
    socketService.on('driverLocationUpdated', handleAllDriverLocation);
    
    return () => {
      socketService.off('driverLocationUpdated', handleAllDriverLocation);
    };
  }, [currentRide, currentLocation, dropoffLocation]);

  const loadUserData = async () => {
    const email = await authService.getUserEmail();
    const info = await authService.getDriverInfo();
    setUserEmail(email || '');
    setUserName(info?.name || 'Passenger');
    setUserPhone(info?.phone || '');
    
    
    await loadActiveRide(email);
    
    
    setUserDataLoading(false);
  };

  const loadActiveRide = async (email) => {
    if (!email) {
      setUserDataLoading(false);
      return;
    }
    try {
      const response = await ridesAPI.getRides({ email });
      if (response.data && response.data.length > 0) {
        
        const activeRide = response.data.find(
          ride => ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'active' || ride.status === 'pending'
        );
        if (activeRide) {
          setCurrentRide(activeRide);
          setRideBooked(true);
          setPickupAddress(activeRide.pickup || activeRide.pickup_location || '');
          setDropoffAddress(activeRide.dropoff || activeRide.dropoff_location || '');
          
          if (activeRide.price) {
            setEstimatedPrice(parseFloat(activeRide.price));
          }
          if (activeRide.ride_type) {
            setSelectedRideType(activeRide.ride_type);
          }
          if (activeRide.vehicle_type) {
            setSelectedVehicleType(activeRide.vehicle_type);
          }
          if (activeRide.package_type) {
            setPackageType(activeRide.package_type);
          }
          if (activeRide.package_size) {
            setPackageSize(activeRide.package_size);
          }
          if (activeRide.package_details) {
            setPackageDetails(activeRide.package_details);
          }
          if (activeRide.special_instructions) {
            setSpecialInstructions(activeRide.special_instructions);
          }
          
          setPickupLockedForRide(true);
          
          if (activeRide.pickup_lat && activeRide.pickup_lng) {
            setPickupLocation({
              latitude: parseFloat(activeRide.pickup_lat),
              longitude: parseFloat(activeRide.pickup_lng),
            });
          }
          
          
          if (activeRide.status === 'arrived' || activeRide.status === 'active') {
            router.push({
              pathname: '/(passenger)/driver-arrived',
              params: {
                rideId: activeRide.id,
                driverName: activeRide.driver_name,
                driverPhone: activeRide.driver_phone,
                driverVehicle: activeRide.driver_vehicle,
                pickupAddress: activeRide.pickup || activeRide.pickup_location || '',
                dropoffAddress: activeRide.dropoff || activeRide.dropoff_location || '',
                pickupLat: activeRide.pickup_lat,
                pickupLng: activeRide.pickup_lng,
              },
            });
          }
          
          
          setUserDataLoading(false);
          return;
        }
      }
    } catch (error) {
      console.log('No active ride found');
    }
    
    setUserDataLoading(false);
  };

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for automatic location detection.');
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(coords);
      
      
      if (dropoffLocation) {
        setRouteCoordinates([coords, dropoffLocation]);
      }
      
      
      try {
        const addresses = await Location.reverseGeocodeAsync(coords);
        if (addresses.length > 0) {
          const addr = addresses[0];
          const addressStr = `${addr.street || ''} ${addr.name || ''}, ${addr.city || ''}`.trim();
          
          
          
          
          if (!pickupManuallySelected && !pickupLockedForRide && !pickupAddress) {
            setPickupAddress(addressStr || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
          }
        }
      } catch (e) {
        if (!pickupManuallySelected && !pickupLockedForRide && !pickupAddress) {
          setPickupAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location. Please enter manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  
  useEffect(() => {
    let locationInterval = null;
    
    
    if (currentRide && (currentRide.status === 'accepted' || currentRide.status === 'arrived' || currentRide.status === 'active') && currentLocation) {
      
      socketService.updatePassengerLocation(userEmail, currentLocation, currentRide.id);
      
      
      locationInterval = setInterval(() => {
        if (currentLocation && currentRide?.id) {
          socketService.updatePassengerLocation(userEmail, currentLocation, currentRide.id);
        }
      }, 5000);
    }
    
    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
      }
    };
  }, [currentRide, currentLocation, userEmail]);

  
  const fetchLocationSuggestions = async (query, userLat = null, userLon = null) => {
    if (!query || query.length < 2) return [];
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
      
      
      
      if (userLat && userLon) {
        
        const latDelta = 0.5;
        const lonDelta = 0.5;
        const viewbox = `${userLon - lonDelta},${userLat - latDelta},${userLon + lonDelta},${userLat + latDelta}`;
        url += `&viewbox=${viewbox}&bounded=1`;
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SwyftApp/1.0',
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      if (data && Array.isArray(data)) {
        return data.map(item => ({
          display_name: item.display_name,
          short_name: item.address?.city || item.address?.town || item.address?.village || item.name || item.display_name.split(',')[0],
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type,
        }));
      }
      return [];
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.log('Autocomplete error:', error.message);
      }
      return [];
    }
  };

  
  const handlePickupChange = (address) => {
    setPickupAddress(address);
    
    if (address.length > 0) {
      setPickupManuallySelected(true);
    }
    setShowPickupSuggestions(address.length > 2);
    
    
    if (pickupDebounceRef.current) {
      clearTimeout(pickupDebounceRef.current);
    }
    
    if (address.length < 2) {
      setPickupSuggestions([]);
      return;
    }
    
    
    pickupDebounceRef.current = setTimeout(async () => {
      const suggestions = await fetchLocationSuggestions(
        address,
        currentLocation?.latitude,
        currentLocation?.longitude
      );
      setPickupSuggestions(suggestions);
    }, 300);
  };

  
  const handleDropoffChange = (address) => {
    setDropoffAddress(address);
    setShowDropoffSuggestions(address.length > 2);
    
    
    if (dropoffDebounceRef.current) {
      clearTimeout(dropoffDebounceRef.current);
    }
    
    if (address.length < 2) {
      setDropoffSuggestions([]);
      setDropoffLocation(null);
      return;
    }
    
    
    dropoffDebounceRef.current = setTimeout(async () => {
      const suggestions = await fetchLocationSuggestions(
        address,
        currentLocation?.latitude,
        currentLocation?.longitude
      );
      setDropoffSuggestions(suggestions);
      
      
      if (suggestions.length > 0) {
        setDropoffLocation({
          latitude: suggestions[0].lat,
          longitude: suggestions[0].lon,
        });
      }
    }, 300);
  };

  
  const handleSelectPickupSuggestion = (suggestion) => {
    setPickupAddress(suggestion.display_name);
    setPickupLocation({
      latitude: suggestion.lat,
      longitude: suggestion.lon,
    });
    setPickupSuggestions([]);
    setShowPickupSuggestions(false);
    
    setPickupManuallySelected(true);
    
    
    if (dropoffLocation) {
      setRouteCoordinates([
        { latitude: suggestion.lat, longitude: suggestion.lon },
        dropoffLocation
      ]);
    }
  };

  
  const handleSelectDropoffSuggestion = (suggestion) => {
    setDropoffAddress(suggestion.display_name);
    setDropoffLocation({
      latitude: suggestion.lat,
      longitude: suggestion.lon,
    });
    setDropoffSuggestions([]);
    setShowDropoffSuggestions(false);
    
    
    if (pickupLocation) {
      setRouteCoordinates([
        pickupLocation,
        { latitude: suggestion.lat, longitude: suggestion.lon }
      ]);
    } else if (currentLocation) {
      setRouteCoordinates([
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: suggestion.lat, longitude: suggestion.lon }
      ]);
    }
  };

  const setupSocketListeners = () => {
    socketService.connect();
    
    
    if (userEmail) {
      socketService.joinRoom(userEmail);
    }
    
    socketService.on('rideCreated', (ride) => {
      if (ride.passengerEmail === userEmail) {
        setCurrentRide({ id: ride.id, ...ride, status: 'requested' });
        setRideBooked(true);
        
        setPickupLockedForRide(true);
        
        if (ride.pickup_lat && ride.pickup_lng) {
          setPickupLocation({
            latitude: parseFloat(ride.pickup_lat),
            longitude: parseFloat(ride.pickup_lng),
          });
        }
        if (ride.pickup || ride.pickup_location) {
          setPickupAddress(ride.pickup || ride.pickup_location);
        }
      }
    });
    
    socketService.on('rideUpdated', (ride) => {
      console.log('rideUpdated received:', ride);
      console.log('currentRide:', currentRide);
      console.log('userEmail:', userEmail);
      
      
      if (ride.id === currentRide?.id || ride.passenger_email === userEmail || ride.passengerEmail === userEmail) {
        setCurrentRide(ride);
        setRideBooked(true);
        
        if (ride.status === 'accepted') {
          Alert.alert(
            'Driver Found!',
            `Your courier is on the way!\n\nCourier: ${ride.driver_name || 'Courier'}\nRating: ⭐ ${ride.driver_rating ? Number(ride.driver_rating).toFixed(1) : '5.0'}\nPhone: ${ride.driver_phone || 'N/A'}\nVehicle: ${ride.driver_vehicle || ride.vehicle_type || 'N/A'}`,
            [{ text: 'Great!' }]
          );
          
          if (ride.driver_lat && ride.driver_lng) {
            setDriverLocation({
              latitude: parseFloat(ride.driver_lat),
              longitude: parseFloat(ride.driver_lng),
            });
            
            if (currentLocation) {
              const distanceKm = calculateDistance(
                parseFloat(ride.driver_lat),
                parseFloat(ride.driver_lng),
                currentLocation.latitude,
                currentLocation.longitude
              );
              const estimatedMinutes = Math.round(distanceKm * 2);
              setDriverDistance(estimatedMinutes);
            }
          } else if (ride.pickup_lat && ride.pickup_lng) {
            setDriverLocation({
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            });
          }
        } else if (ride.status === 'arrived' || ride.status === 'active') {
          
          router.push({
            pathname: '/(passenger)/driver-arrived',
            params: {
              rideId: ride.id,
              driverName: ride.driver_name,
              driverPhone: ride.driver_phone,
              driverVehicle: ride.driver_vehicle || ride.vehicle_type,
              pickupAddress: pickupAddress,
              dropoffAddress: dropoffAddress,
              pickupLat: ride.pickup_lat,
              pickupLng: ride.pickup_lng,
            },
          });
        } else if (ride.status === 'in_progress') {
          Alert.alert('Ride Started', 'Your ride has begun. Enjoy your trip!');
        } else if (ride.status === 'completed') {
          Alert.alert(
            '🎉 Arrived at Destination!', 
            `You have arrived at your destination!\n\nFare: ₺${ride.price || estimatedPrice}`,
            [{ 
              text: 'Rate Your Courier',
              onPress: () => router.push({
                pathname: '/(passenger)/rate-ride',
                params: { 
                  rideId: ride.id,
                  driverName: ride.driver_name,
                  driverVehicle: ride.driver_vehicle || ride.vehicle_type,
                },
              })
            }]
          );
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
        } else if (ride.status === 'cancelled' || ride.status === 'canceled') {
          Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
          setRideBooked(false);
          setCurrentRide(null);
          setDriverLocation(null);
          setDriverDistance(null);
          setPickupManuallySelected(false);
          setPickupLockedForRide(false);
        }
      }
    });

    socketService.on('dispatchUpdated', (dispatch) => {
      console.log('dispatchUpdated received:', dispatch);
      if (dispatch.passenger_email === userEmail || dispatch.passengerEmail === userEmail) {
        setCurrentRide(dispatch);
        setRideBooked(true);
      }
    });
  };

  
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleBookRide = async () => {
    if (!pickupAddress.trim()) {
      Alert.alert('Error', 'Please enter a pickup location');
      return;
    }

    if (!dropoffAddress.trim()) {
      Alert.alert('Error', 'Please enter a dropoff location');
      return;
    }

    setLoading(true);
    try {
      const rideData = {
        passengerName: userName,
        passengerEmail: userEmail,
        passengerPhone: userPhone || 'N/A',
        pickup: pickupAddress,
        dropoff: dropoffAddress,
        rideType: selectedRideType,
        ridePrice: estimatedPrice,
        pickupLat: pickupLocation?.latitude,
        pickupLng: pickupLocation?.longitude,
        dropoffLat: dropoffLocation?.latitude,
        dropoffLng: dropoffLocation?.longitude,
        packageType: packageType || null,
        packageSize: packageSize || null,
        vehicleType: selectedVehicleType || null,
        packageDetails: packageDetails || null,
        specialInstructions: selectedQuickNote ? `${selectedQuickNote}${specialInstructions ? '. ' + specialInstructions : ''}` : (specialInstructions || null),
      };

      const response = await ridesAPI.createRide(rideData);
      const ride = response.data;
      
      setCurrentRide({ id: ride.rideId, ...rideData, status: 'pending' });
      setRideBooked(true);
      
      setPickupLockedForRide(true);
      
      Alert.alert(
        'Courier Requested!',
        'Looking for nearby couriers...\n\nYou will be notified when a courier accepts your ride.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Error', 'Failed to book dispatch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;

    Alert.alert(
      'Cancel Dispatch',
      'Are you sure you want to cancel this dispatch?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await ridesAPI.cancelRide(currentRide.id || currentRide.rideId);
              setRideBooked(false);
              setCurrentRide(null);
              setPickupManuallySelected(false);
              setPickupLockedForRide(false);
              Alert.alert('Cancelled', 'Your ride has been cancelled.');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride');
            }
          },
        },
      ]
    );
  };

  const renderRideStatus = () => (
    <View style={styles.statusContainer}>
      <View style={styles.statusHeader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.statusTitle}>
          {currentRide?.status === 'pending' && 'Finding your courier...'}
          {currentRide?.status === 'accepted' && 'courier is on the way!'}
          {currentRide?.status === 'active' && 'Delivery is on the way!'}
        </Text>
      </View>

      {currentRide?.status === 'accepted' && (
        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {(currentRide.driver_name || 'D').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{currentRide.driver_name || 'Your Courier'}</Text>
              <Text style={styles.driverPhone}>{currentRide.driver_phone || 'Phone not available'}</Text>
              <Text style={styles.driverVehicle}>Courier: {currentRide.driver_vehicle || currentRide.vehicle_type || 'Vehicle'}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStar}>⭐</Text>
                <Text style={styles.ratingText}>{currentRide.driver_rating ? Number(currentRide.driver_rating).toFixed(1) : '5.0'}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => {
              if (currentRide.driver_phone) {
                Linking.openURL(`tel:${currentRide.driver_phone}`);
              } else {
                Alert.alert('Error', 'Driver phone number not available');
              }
            }}
          >
            <Ionicons name="call" size={20} color={COLORS.white} />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tripDetails}>
        <View style={styles.tripRow}>
          <View style={[styles.tripDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.tripTextContainer}>
            <Text style={styles.tripLabel}>PICKUP</Text>
            <Text style={styles.tripText}>{pickupAddress}</Text>
          </View>
        </View>
        <View style={styles.tripConnector} />
        <View style={styles.tripRow}>
          <View style={[styles.tripDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.tripTextContainer}>
            <Text style={styles.tripLabel}>DROPOFF</Text>
            <Text style={styles.tripText}>{dropoffAddress}</Text>
          </View>
        </View>
      </View>

      {driverLocation && driverDistance && (
        <View style={styles.etaContainer}>
          <Ionicons name="car" size={20} color={COLORS.white} />
          <Text style={styles.etaText}>
            {driverStatus === 'arrived' ? 'Driver has arrived!' : 
             driverStatus === 'in_progress' ? 'Ride in progress' : 
             `Driver arriving in ${driverDistance} min`}
          </Text>
        </View>
      )}

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Estimated Fare</Text>
        <Text style={styles.priceValue}>₺{estimatedPrice}</Text>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide}>
        <Text style={styles.cancelButtonText}>Cancel Ride</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBookingForm = () => (
    <>
      {}
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_OSM}
            initialRegion={{
              latitude: (pickupLocation || currentLocation)?.latitude,
              longitude: (pickupLocation || currentLocation)?.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
          >
            {}
            {pickupLocation && (
              <Marker
                coordinate={{
                  latitude: pickupLocation.latitude,
                  longitude: pickupLocation.longitude,
                }}
                title="Pickup Location"
                pinColor={COLORS.success}
              />
            )}
            
            {}
            {dropoffLocation && (
              <Marker
                coordinate={{
                  latitude: dropoffLocation.latitude,
                  longitude: dropoffLocation.longitude,
                }}
                title="Dropoff Location"
                pinColor={COLORS.error}
              />
            )}
            
            {}
            {driverLocation && (
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title="Your Courier"
              >
                <View style={styles.driverMarkerStyle}>
                  <Ionicons name="car" size={16} color="white" />
                </View>
              </Marker>
            )}
            
            {}
            {routeCoordinates.length > 1 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={COLORS.primary}
                strokeWidth={4}
                lineDashPattern={[0]}
              />
            )}
            
            {}
            {driverLocation && pickupLocation && dropoffLocation && routeCoordinates.length <= 1 && (
              <>
                <Polyline
                  coordinates={[
                    driverLocation,
                    pickupLocation,
                  ]}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
                <Polyline
                  coordinates={[
                    pickupLocation,
                    dropoffLocation,
                  ]}
                  strokeColor={COLORS.success}
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
              </>
            )}
            
            {}
            {!driverLocation && pickupLocation && dropoffLocation && (
              <>
                <Polyline
                  coordinates={[pickupLocation, dropoffLocation]}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
              </>
            )}
            
            {}
            {!driverLocation && !pickupLocation && currentLocation && dropoffLocation && (
              <Polyline
                coordinates={[
                  { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                  dropoffLocation
                ]}
                strokeColor={COLORS.primary}
                strokeWidth={4}
                lineDashPattern={[0]}
              />
            )}
          </MapView>
        ) : (
          <View style={[styles.mapPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
          </View>
        )}
      </View>

      {}
      <View style={styles.locationSection}>
        <View style={styles.inputRow}>
          <View style={[styles.inputDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>PICKUP</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter pickup location"
              placeholderTextColor={COLORS.textSecondary}
              value={pickupAddress}
              onChangeText={handlePickupChange}
              onFocus={() => setShowPickupSuggestions(true)}
            />
            {}
            {showPickupSuggestions && pickupSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {pickupSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectPickupSuggestion(suggestion)}
                  >
                    <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {suggestion.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.inputConnector} />

        <View style={styles.inputRow}>
          <View style={[styles.inputDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>DROPOFF</Text>
            <TextInput
              style={styles.input}
              placeholder="Package Destination?"
              placeholderTextColor={COLORS.textSecondary}
              value={dropoffAddress}
              onChangeText={handleDropoffChange}
              onFocus={() => setShowDropoffSuggestions(true)}
            />
            {}
            {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {dropoffSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectDropoffSuggestion(suggestion)}
                  >
                    <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {suggestion.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.currentLocationButton} 
          onPress={getCurrentLocation}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="location" size={20} color={COLORS.primary} />
              <Text style={styles.currentLocationText}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {}
      <View style={styles.rideTypesSection}>
        <Text style={styles.sectionTitle}>Choose Your Courier</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {rideTypes.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={[
                styles.rideTypeCard,
                selectedRideType === ride.id && styles.rideTypeCardSelected,
              ]}
              onPress={() => setSelectedRideType(ride.id)}
            >
              <Ionicons 
                name="location" 
                size={28} 
                color={selectedRideType === ride.id ? COLORS.primary : COLORS.textSecondary} 
              />
              <Text style={[
                styles.rideTypeName,
                selectedRideType === ride.id && styles.rideTypeNameSelected,
              ]}>
                {ride.name}
              </Text>
              <Text style={styles.rideTypeTime}>{ride.time}</Text>
              {pricingLoaded ? (
                <Text style={[
                  styles.rideTypePrice,
                  selectedRideType === ride.id && styles.rideTypePriceSelected,
                ]}>
                  ₺{ride.price}
                </Text>
              ) : (
                <Text style={styles.rideTypePrice}>₺...</Text>
              )}
              <Text style={styles.rideTypeDesc}>{ride.desc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.vehicleTypesSection}>
        <Text style={styles.sectionTitle}>Vehicle Required (Based on Size)</Text>
        <View style={styles.vehicleTypeContainer}>
          {vehicleTypes.map((vehicle) => (
            <View
              key={vehicle.id}
              style={[
                styles.vehicleTypeCard,
                selectedVehicleType === vehicle.id && styles.vehicleTypeCardSelected,
              ]}
            >
              <Ionicons 
                name={vehicle.icon} 
                size={28} 
                color={selectedVehicleType === vehicle.id ? COLORS.white : COLORS.textSecondary} 
              />
              <Text style={[
                styles.vehicleTypeName,
                selectedVehicleType === vehicle.id && styles.vehicleTypeNameSelected,
              ]}>
                {vehicle.name}
              </Text>
              <Text style={[
                styles.vehicleTypeDesc,
                selectedVehicleType === vehicle.id && styles.vehicleTypeDescSelected,
              ]}>
                {vehicle.desc}
              </Text>
              <Text style={[
                styles.vehicleTypeExamples,
                selectedVehicleType === vehicle.id && styles.vehicleTypeExamplesSelected,
              ]}>
                {vehicle.examples}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {}
      <View style={styles.priceEstimate}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Delivery Price</Text>
          <Text style={styles.priceValue}>₺{estimatedPrice}</Text>
        </View>
        <Text style={styles.priceNote}>Matched with nearest courier</Text>
      </View>

      <View style={styles.packageSection}>
        <Text style={styles.sectionTitle}>Package Details</Text>
        
        <Text style={styles.inputLabel}>TYPE OF PACKAGE</Text>
        <View style={styles.packageTypeContainer}>
          {['Food', 'Document', 'Parcel'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.packageTypeButton,
                packageType === type && styles.packageTypeButtonSelected,
              ]}
              onPress={() => setPackageType(type)}
            >
              <Text style={[
                styles.packageTypeText,
                packageType === type && styles.packageTypeTextSelected,
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {packageType && (
          <>
            <Text style={styles.inputLabel}>PACKAGE DETAILS</Text>
            <TextInput
              style={styles.packageDetailsInput}
              placeholder={`e.g., ${packageType === 'Food' ? 'Pizza, Burgers, Groceries...' : packageType === 'Document' ? 'Envelope, Folder, ID card...' : 'Electronics, Clothes, Books...'}`}
              placeholderTextColor={COLORS.textSecondary}
              value={packageDetails}
              onChangeText={setPackageDetails}
              multiline
            />
          </>
        )}

        <Text style={styles.inputLabel}>SIZE</Text>
        <View style={styles.packageSizeContainer}>
          {['Small', 'Medium', 'Large'].map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.packageSizeButton,
                packageSize === size && styles.packageSizeButtonSelected,
              ]}
              onPress={() => setPackageSize(size)}
            >
              <Ionicons 
                name={size === 'Small' ? 'cube-outline' : size === 'Medium' ? 'cube' : 'cube-sharp'} 
                size={20} 
                color={packageSize === size ? COLORS.white : COLORS.textSecondary} 
              />
              <Text style={[
                styles.packageSizeText,
                packageSize === size && styles.packageSizeTextSelected,
              ]}>
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {packageSize && (
          <Text style={styles.sizeHelperText}>
            {packageSize === 'Small' && 'Fits in a backpack or small box (documents, small electronics, keys)'}
            {packageSize === 'Medium' && 'Fits in a car trunk or large box (clothing, food orders, small items)'}
            {packageSize === 'Large' && 'Needs a van or truck (furniture, large boxes, appliances)'}
          </Text>
        )}

        <Text style={styles.inputLabel}>SPECIAL INSTRUCTIONS</Text>
        <View style={styles.specialInstructionsContainer}>
          {['Fragile', 'Keep upright'].map((instruction) => (
            <TouchableOpacity
              key={instruction}
              style={[
                styles.instructionChip,
                selectedQuickNote === instruction && styles.instructionChipSelected,
              ]}
              onPress={() => setSelectedQuickNote(selectedQuickNote === instruction ? '' : instruction)}
            >
              <Ionicons 
                name={instruction === 'Fragile' ? 'alert-circle-outline' : 'arrow-up-outline'} 
                size={16} 
                color={selectedQuickNote === instruction ? COLORS.white : COLORS.textSecondary} 
              />
              <Text style={[
                styles.instructionChipText,
                selectedQuickNote === instruction && styles.instructionChipTextSelected,
              ]}>
                {instruction}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>ADDITIONAL NOTES</Text>
        <TextInput
          style={styles.packageDetailsInput}
          placeholder="Any other special requirements..."
          placeholderTextColor={COLORS.textSecondary}
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
        />
      </View>

      {}
<TouchableOpacity
        style={[styles.bookButton, loading && styles.bookButtonDisabled]}
        onPress={handleBookRide}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.bookButtonText}>Book • ₺{estimatedPrice}</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.brandName}>SWYFTinc</Text>
            <Text style={styles.headerTitle}>Book a Courier</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {rideBooked ? renderRideStatus() : renderBookingForm()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mapContainer: {
    height: 300,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  mapPlaceholderText: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  driverMarkerStyle: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  mapLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationSection: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  inputContainer: {
    flex: 1,
    position: 'relative',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 8,
  },
  inputConnector: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  currentLocationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  currentLocationText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  rideTypesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  rideTypeCard: {
    width: 120,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rideTypeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#E3F2FD',
  },
  rideTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  rideTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  rideTypeNameSelected: {
    color: COLORS.primary,
  },
  rideTypeTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rideTypePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  rideTypePriceSelected: {
    color: COLORS.primary,
  },
  rideTypeDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  priceEstimate: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  priceNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  etaText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  bookButtonDisabled: {
    opacity: 0.7,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  statusContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverVehicle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  driverPhone: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingStar: {
    fontSize: 12,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  callButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  tripDetails: {
    marginBottom: 20,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  tripTextContainer: {
    flex: 1,
  },
  tripLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  tripText: {
    fontSize: 14,
    color: COLORS.text,
  },
  tripConnector: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  cancelButton: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  packageSection: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  packageTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  packageTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  packageTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  packageTypeTextSelected: {
    color: COLORS.white,
  },
  packageSizeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  packageSizeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageSizeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  packageSizeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  packageSizeTextSelected: {
    color: COLORS.white,
  },
  sizeHelperText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  specialInstructionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  instructionChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  instructionChipSelected: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  instructionChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  instructionChipTextSelected: {
    color: COLORS.white,
  },
  packageDetailsInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vehicleTypesSection: {
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleTypeCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleTypeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  vehicleTypeName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  vehicleTypeNameSelected: {
    color: COLORS.white,
  },
  vehicleTypesSection: {
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleTypeCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleTypePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  vehicleTypePriceSelected: {
    color: COLORS.white,
  },
  vehicleTypeDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  vehicleTypeDescSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  vehicleTypeExamples: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  vehicleTypeExamplesSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
});
