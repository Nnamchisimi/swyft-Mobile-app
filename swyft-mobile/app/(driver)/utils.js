import { Alert, Linking, Platform } from 'react-native';
import { COLORS } from '../../src/constants/config';

export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculateETA = (distanceKm, avgSpeedKmh = 30) => {
  const timeHours = distanceKm / avgSpeedKmh;
  const timeMinutes = Math.round(timeHours * 60);
  if (timeMinutes < 1) return 'Less than 1 min';
  if (timeMinutes === 1) return '1 min away';
  if (timeMinutes < 60) return `${timeMinutes} mins away`;
  const hours = Math.floor(timeMinutes / 60);
  const mins = timeMinutes % 60;
  return `${hours}h ${mins}m away`;
};

export const openNavigation = (lat, lng, address) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const appleMapsUrl = `maps://?daddr=${latitude},${longitude}`;
  const wazeUrl = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;

  Alert.alert(
    'Open Navigation',
    'Choose a navigation app',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Google Maps',
        onPress: () => Linking.openURL(googleMapsUrl),
      },
      {
        text: 'Waze',
        onPress: () => Linking.openURL(wazeUrl),
      },
      Platform.OS === 'ios' ? {
        text: 'Apple Maps',
        onPress: () => Linking.openURL(appleMapsUrl),
      } : { text: '', style: 'cancel' },
    ]
  );
};
