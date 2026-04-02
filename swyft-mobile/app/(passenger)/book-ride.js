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
  Platform,
  Linking,
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
  const [selectedRideType, setSelectedRideType] = useState('standard');
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  
  const pickupDebounceRef = useRef(null);
  const dropoffDebounceRef = useRef(null);

  const rideTypes = [
    { id: 'economy', name: 'Lefkosa', icon: 'sedan', price: 350, time: '5-60 min', desc: 'Affordable rides' },
    { id: 'standard', name: 'Girne', icon: 'sedan', price: 450, time: '30-60mins', desc: 'Comfortable rides' },
    { id: 'luxury', name: 'Magusa', icon: 'sedan', price: 550, time: '1-2 hrs', desc: 'Premium vehicles' },
  ];

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
    
    calculateFare();
  }, [selectedRideType]);

  
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

  const calculateFare = async () => {
    const ride = rideTypes.find(r => r.id === selectedRideType);
    if (ride) {
      setEstimatedPrice(ride.price);
    }
  };

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
            `Your driver is on the way!\n\nDriver: ${ride.driver_name || 'Driver'}\nRating: ⭐ ${ride.driver_rating ? ride.driver_rating.toFixed(1) : '5.0'}\nPhone: ${ride.driver_phone || 'N/A'}\nVehicle: ${ride.driver_vehicle || 'N/A'}`,
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
              driverVehicle: ride.driver_vehicle,
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
              text: 'Rate Your Driver',
              onPress: () => router.push({
                pathname: '/(passenger)/rate-ride',
                params: { 
                  rideId: ride.id,
                  driverName: ride.driver_name,
                  driverVehicle: ride.driver_vehicle,
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
      };

      const response = await ridesAPI.createRide(rideData);
      const ride = response.data;
      
      setCurrentRide({ id: ride.rideId, ...rideData, status: 'pending' });
      setRideBooked(true);
      
      setPickupLockedForRide(true);
      
      Alert.alert(
        'Ride Requested!',
        'Looking for nearby drivers...\n\nYou will be notified when a driver accepts your ride.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Error', 'Failed to book ride. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;

    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
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
          {currentRide?.status === 'pending' && 'Finding your driver...'}
          {currentRide?.status === 'accepted' && 'Driver is on the way!'}
          {currentRide?.status === 'active' && 'Enjoy your ride!'}
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
              <Text style={styles.driverName}>{currentRide.driver_name || 'Your Driver'}</Text>
              <Text style={styles.driverPhone}>{currentRide.driver_phone || 'Phone not available'}</Text>
              <Text style={styles.driverVehicle}>{currentRide.driver_vehicle || 'Vehicle'}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStar}>⭐</Text>
                <Text style={styles.ratingText}>{currentRide.driver_rating ? currentRide.driver_rating.toFixed(1) : '5.0'}</Text>
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

      {}
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
                title="Your Driver"
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
              placeholder="Where are you going?"
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
        <Text style={styles.sectionTitle}>Choose Your Ride</Text>
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
                name={ride.icon === 'car' ? 'car' : ride.icon === 'sedan' ? 'car-sport' : 'star'} 
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
              <Text style={[
                styles.rideTypePrice,
                selectedRideType === ride.id && styles.rideTypePriceSelected,
              ]}>
                ₺{ride.price}
              </Text>
              <Text style={styles.rideTypeDesc}>{ride.desc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {}
      <View style={styles.priceEstimate}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Estimated Fare</Text>
          <Text style={styles.priceValue}>₺{estimatedPrice}</Text>
        </View>
        <Text style={styles.priceNote}>Final price may vary based on traffic and route</Text>
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
          <Text style={styles.bookButtonText}>Book Ride • ₺{estimatedPrice}</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>Book a Ride</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {rideBooked ? renderRideStatus() : renderBookingForm()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
});
