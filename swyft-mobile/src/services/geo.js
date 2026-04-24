import { GOOGLE_MAPS_API_KEY } from '../constants/config';

/**
 * Google Maps Geo-Location Service
 * Centralized service for all map, routing, and location operations
 */

export const geoService = {
  /**
   * Get ETA between two locations using Google Directions API
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @param {string} mode - 'driving', 'walking', 'bicycling', 'transit'
   * @returns {Promise<{duration: number, distance: number, polyline: string}|null>}
   */
  async getETA(origin, destination, mode = 'driving') {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destStr = `${destination.latitude},${destination.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_API_KEY}&mode=${mode}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        return {
          duration: leg.duration?.value || null, // seconds
          distance: leg.distance?.value || null,  // meters
          polyline: route.overview_polyline?.points || null,
          bounds: route.bounds,
        };
      }
      return null;
    } catch (error) {
      console.error('Google Directions API error:', error.message);
      return null;
    }
  },

  /**
   * Get route polyline coordinates between two points
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @returns {Promise<Array<{latitude, longitude}>|null>}
   */
  async getRouteCoordinates(origin, destination) {
    try {
      const result = await this.getETA(origin, destination);
      if (result?.polyline) {
        return this.decodePolyline(result.polyline);
      }
      return null;
    } catch (error) {
      console.error('getRouteCoordinates error:', error);
      return null;
    }
  },

  /**
   * Decode a Google encoded polyline string to array of coordinates
   * @param {string} encoded - Encoded polyline string
   * @returns {Array<{latitude, longitude}>}
   */
  decodePolyline(encoded) {
    if (!encoded) return [];
    
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat * 1e-5,
        longitude: lng * 1e-5,
      });
    }

    return points;
  },

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Calculate ETA from distance (fallback method)
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} avgSpeedKmh - Average speed in km/h
   * @returns {string} Formatted ETA string
   */
  formatETAFromDistance(distanceKm, avgSpeedKmh = 30) {
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    if (timeMinutes < 1) return 'Less than 1 min';
    if (timeMinutes === 1) return '1 min away';
    if (timeMinutes < 60) return `${timeMinutes} mins away`;
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    return `${hours}h ${mins}m away`;
  },

  /**
   * Format ETA from seconds (Google API response)
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted ETA string
   */
  formatETA(seconds) {
    if (!seconds || seconds < 60) return 'Less than 1 min';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} mins away`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m away`;
  },

  /**
   * Reverse geocode coordinates to address
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<string|null>}
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error.message);
      return null;
    }
  },

  /**
   * Get place suggestions (autocomplete) from Google Places API
   * @param {string} query - Search query
   * @param {number|null} userLat - User's current latitude for biasing
   * @param {number|null} userLon - User's current longitude for biasing
   * @returns {Promise<Array<{display_name, short_name, place_id, lat, lon, type}>>}
   */
  async getPlaceSuggestions(query, userLat = null, userLon = null) {
    if (!query || query.length < 2) return [];

    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:cy`;

      if (userLat && userLon) {
        url += `&location=${userLat},${userLon}&radius=50000`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        return data.predictions.map(item => ({
          display_name: item.description,
          short_name: item.structured_formatting?.main_text || item.description.split(',')[0],
          place_id: item.place_id,
          type: 'google_place',
        }));
      }
      return [];
    } catch (error) {
      console.error('Place autocomplete error:', error.message);
      return [];
    }
  },

  /**
   * Get place details from Google Places API
   * @param {string} placeId
   * @returns {Promise<{lat, lon, display_name}|null>}
   */
  async getPlaceDetails(placeId) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&fields=geometry,formatted_address`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.result) {
        return {
          lat: data.result.geometry.location.lat,
          lon: data.result.geometry.location.lng,
          display_name: data.result.formatted_address,
        };
      }
      return null;
    } catch (error) {
      console.error('Place details error:', error.message);
      return null;
    }
  },

  /**
   * Parse Google Maps URL to extract coordinates
   * @param {string} url - Google Maps URL
   * @returns {{latitude: number, longitude: number}|null}
   */
  parseGoogleMapsUrl(url) {
    try {
      // Check for @lat,lng pattern
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return {
          latitude: parseFloat(atMatch[1]),
          longitude: parseFloat(atMatch[2]),
        };
      }

      // Check for q=lat,lng pattern
      const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        return {
          latitude: parseFloat(qMatch[1]),
          longitude: parseFloat(qMatch[2]),
        };
      }

      // Check for ll=lat,lng pattern
      const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) {
        return {
          latitude: parseFloat(llMatch[1]),
          longitude: parseFloat(llMatch[2]),
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error.message);
      return null;
    }
  },
};

export default geoService;
