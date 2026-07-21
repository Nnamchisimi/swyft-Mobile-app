import geoService from '../services/geo';

export function parseGoogleMapsUrl(url) {
  try {
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        latitude: parseFloat(atMatch[1]),
        longitude: parseFloat(atMatch[2])
      };
    }

    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return {
        latitude: parseFloat(qMatch[1]),
        longitude: parseFloat(qMatch[2])
      };
    }

    const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) {
      return {
        latitude: parseFloat(llMatch[1]),
        longitude: parseFloat(llMatch[2])
      };
    }

    return null;
  } catch (error) {
    console.log('Error parsing Google Maps URL:', error);
    return null;
  }
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function reverseGeocode(lat, lng) {
  return await geoService.reverseGeocode(lat, lng);
}

export async function getPlaceDetails(placeId) {
  return await geoService.getPlaceDetails(placeId);
}

export async function getRouteCoordinates(start, end) {
  return await geoService.getRouteCoordinates(start, end);
}

export async function getETA(origin, destination) {
  return await geoService.getETA(origin, destination);
}