import React, { useState, useEffect, useRef } from "react";
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import { Paper, Box, Typography } from "@mui/material";

const containerStyle = { width: "100%", height: 400 };

export default function DriverMap({ ride }) {
  const [driverLocation, setDriverLocation] = useState(null); // null initially
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const mapRef = useRef(null);
  const [hasPickedUp, setHasPickedUp] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyAcngMU7US6QjMQ5R9DRLhDhvCEqwCxsWo",
    libraries: ["places"],
  });

  // ✅ Get system location on load
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  }, []);

  // Geocode pickup & dropoff
  useEffect(() => {
    if (!ride || !isLoaded || !window.google?.maps?.Geocoder) return;

    const geocoder = new window.google.maps.Geocoder();

    const geocodeAddress = (address, setLocation) => {
      if (!address) return setLocation(null);
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results[0]) {
          setLocation({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
        } else setLocation(null);
      });
    };

    geocodeAddress(ride.pickup_location, setPickup);
    geocodeAddress(ride.dropoff_location, setDropoff);
  }, [ride, isLoaded]);

  // Track driver geolocation continuously
  useEffect(() => {
    if (!ride) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ride]);

  // Directions
  useEffect(() => {
    if (!pickup || !dropoff || !driverLocation) return;

    const directionsService = new window.google.maps.DirectionsService();
    const destination = hasPickedUp ? dropoff : pickup;

    directionsService.route(
      { origin: driverLocation, destination, travelMode: window.google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === "OK" && result.routes[0]) {
          setDirections(result);
          setDistance(result.routes[0].legs[0].distance.text);
          setDuration(result.routes[0].legs[0].duration.text);

          if (!hasPickedUp) {
            const distanceToPickup = Math.sqrt(
              (driverLocation.lat - pickup.lat) ** 2 + (driverLocation.lng - pickup.lng) ** 2
            );
            if (distanceToPickup < 0.0005) setHasPickedUp(true); // ~50 meters
          }

          if (mapRef.current) {
            const bounds = new window.google.maps.LatLngBounds();
            result.routes[0].overview_path.forEach((p) => bounds.extend(p));
            mapRef.current.fitBounds(bounds);
          }
        }
      }
    );
  }, [pickup, dropoff, driverLocation, hasPickedUp]);

  // Only render map once system location is available
  if (!isLoaded || !driverLocation) {
    return <Typography>Loading map and fetching your location…</Typography>;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        mt: 2,
        p: 1,
        borderRadius: 2,
        overflow: "hidden",
        height: 400,
        width: { xs: "100%", sm: "80%", md: "40%", mx: "auto" },
      }}
    >
      <Box sx={{ height: "90%", width: "100%" }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={pickup || dropoff || driverLocation}
          zoom={13}
          onLoad={(map) => (mapRef.current = map)}
        >
          {pickup && <Marker position={pickup} label="Pickup" />}
          {dropoff && <Marker position={dropoff} label="Drop-off" />}
          {driverLocation && (
            <Marker
              position={driverLocation}
              icon={{
                url: "https://maps.google.com/mapfiles/kml/shapes/cabs.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
            />
          )}
          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>
      </Box>
      {(distance || duration) && (
        <Box sx={{ mt: 1, textAlign: "center" }}>
          {distance && <Typography variant="body1">Distance: {distance}</Typography>}
          {duration && <Typography variant="body1">Duration: {duration}</Typography>}
        </Box>
      )}
    </Paper>
  );
}
