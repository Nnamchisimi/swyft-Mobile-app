import React, { useState, useEffect, useRef, useCallback } from "react";
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader, Polygon } from "@react-google-maps/api";
import { Paper, Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { io } from "socket.io-client";

const containerStyle = { width: "100%", height: 400 };

export default function DriverMap({ ride, onLocationUpdate, driverId }) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [map, setMap] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [routeMode, setRouteMode] = useState('pickup');

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyBrptwerlWpVYRC3P9hsxm415pTkqIEfME",
    libraries: ["places"],
  });

  // Initialize geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(position);
        onLocationUpdate(position);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onLocationUpdate]);

  // Watch for geolocation changes
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(position);
        onLocationUpdate(position);
      },
      (err) => console.error("Geolocation watch error:", err),
      { enableHighAccuracy: true, interval: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onLocationUpdate]);

  // Socket.io connection for real-time updates
  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("connect", () => console.log("Connected to socket server"));
    newSocket.on("driverLocationUpdated", (data) => {
      if (data.driverId === driverId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [driverId]);

  // Send location updates to server
  useEffect(() => {
    if (socket && driverLocation && driverId) {
      socket.emit("driverLocationUpdate", {
        driverId,
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        timestamp: Date.now()
      });
    }
  }, [socket, driverLocation, driverId]);

  // Geocoding function
  const geocodeAddress = useCallback(async (address) => {
    if (!window.google?.maps?.Geocoder) return null;
    
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        } else {
          console.error("Geocode failed:", status);
          resolve(null);
        }
      });
    });
  }, []);

  // Directions service
  const calculateRoute = useCallback(async (origin, destination) => {
    if (!window.google?.maps?.DirectionsService || !origin || !destination) return;

    const directionsService = new window.google.maps.DirectionsService();
    const result = await new Promise((resolve) => {
      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true
        },
        (result, status) => {
          if (status === "OK" && result) {
            resolve(result);
          } else {
            console.error(`Error fetching directions: ${status}`);
            resolve(null);
          }
        }
      );
    });

    return result;
  }, []);

  // Handle map click for setting pickup/dropoff
  const handleMapClick = useCallback((event) => {
    const position = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };

    if (routeMode === 'pickup') {
      setPickup(position);
    } else {
      setDropoff(position);
    }

    // Calculate route if both points are set
    if (pickup && dropoff) {
      calculateRoute(pickup, dropoff).then((result) => {
        if (result) {
          setDirections(result);
          setDistance(result.routes[0].legs[0].distance.text);
          setDuration(result.routes[0].legs[0].duration.text);
        }
      });
    }
  }, [pickup, dropoff, routeMode, calculateRoute]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback((event, type) => {
    const position = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };

    if (type === 'pickup') {
      setPickup(position);
    } else if (type === 'dropoff') {
      setDropoff(position);
    }

    // Recalculate route
    if (pickup && dropoff) {
      calculateRoute(pickup, dropoff).then((result) => {
        if (result) {
          setDirections(result);
          setDistance(result.routes[0].legs[0].distance.text);
          setDuration(result.routes[0].legs[0].duration.text);
        }
      });
    }
  }, [pickup, dropoff, calculateRoute]);

  // Set map reference
  const onMapLoad = useCallback((map) => {
    setMap(map);
  }, []);

  // Change route mode
  const setRouteModeType = (mode) => {
    setRouteMode(mode);
    setPickup(null);
    setDropoff(null);
    setDirections(null);
    setDistance(null);
    setDuration(null);
  };

  // Geocode address input
  const handleAddressGeocode = async (address, type) => {
    const position = await geocodeAddress(address);
    if (position) {
      if (type === 'pickup') {
        setPickup(position);
      } else {
        setDropoff(position);
      }
    }
  };

  if (!isLoaded) {
    return (
      <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading Maps...</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      {/* Route Mode Selector */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Route Mode</InputLabel>
        <Select
          value={routeMode}
          onChange={(e) => setRouteModeType(e.target.value)}
          label="Route Mode"
        >
          <MenuItem value="pickup">Set Pickup Location</MenuItem>
          <MenuItem value="dropoff">Set Dropoff Location</MenuItem>
        </Select>
      </FormControl>

      {/* Address Input */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          label="Pickup Address"
          onBlur={(e) => handleAddressGeocode(e.target.value, 'pickup')}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Dropoff Address"
          onBlur={(e) => handleAddressGeocode(e.target.value, 'dropoff')}
          sx={{ flex: 1 }}
        />
      </Box>

      {/* Map Container */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={driverLocation || { lat: 0, lng: 0 }}
        zoom={14}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: 'greedy'
        }}
        onLoad={onMapLoad}
        onClick={handleMapClick}
      >
        {/* Driver Marker */}
        {driverLocation && (
          <Marker
            position={driverLocation}
            label={{ text: "D", color: "#fff", fontSize: "16px", fontWeight: "bold" }}
            icon={{ 
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              scaledSize: new window.google?.maps?.Size(40, 40)
            }}
            draggable={false}
          />
        )}

        {/* Pickup Marker */}
        {pickup && (
          <Marker
            position={pickup}
            label={{ text: "P", color: "#fff", fontSize: "16px", fontWeight: "bold" }}
            icon={{ 
              url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
              scaledSize: new window.google?.maps?.Size(32, 32)
            }}
            draggable={true}
            onDragEnd={(e) => handleMarkerDragEnd(e, 'pickup')}
          />
        )}

        {/* Dropoff Marker */}
        {dropoff && (
          <Marker
            position={dropoff}
            label={{ text: "D", color: "#fff", fontSize: "16px", fontWeight: "bold" }}
            icon={{ 
              url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
              scaledSize: new window.google?.maps?.Size(32, 32)
            }}
            draggable={true}
            onDragEnd={(e) => handleMarkerDragEnd(e, 'dropoff')}
          />
        )}

        {/* Route Line */}
        {directions && <DirectionsRenderer directions={directions} />}

        {/* Geofence/Polygon Example */}
        {/* Define service area */}
        <Polygon
          paths={[
            { lat: 40.7128, lng: -74.0060 },
            { lat: 40.7228, lng: -74.0060 },
            { lat: 40.7228, lng: -74.0160 },
            { lat: 40.7128, lng: -74.0160 }
          ]}
          options={{
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#FF0000",
            fillOpacity: 0.35
          }}
        />
      </GoogleMap>

      {/* Statistics Panel */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>Route Statistics</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Distance</Typography>
            <Typography variant="h5" color="primary.main">{distance || "N/A"}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Duration</Typography>
            <Typography variant="h5" color="secondary.main">{duration || "N/A"}</Typography>
          </Box>
        </Box>
        
        {/* Live Status */}
        <Box sx={{ mt: 2, p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="body2">
            <strong>Driver Status:</strong> {driverLocation ? "Online & Moving" : "Offline"}
          </Typography>
          <Typography variant="body2">
            <strong>Pickup Set:</strong> {pickup ? "Yes" : "No"}
          </Typography>
          <Typography variant="body2">
            <strong>Dropoff Set:</strong> {dropoff ? "Yes" : "No"}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
