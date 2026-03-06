import React, { useState, useEffect, useRef } from "react";
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import { Box, Paper, Typography } from "@mui/material";
import { io } from "socket.io-client";

const containerStyle = { width: "100%", height: 400 };

export default function PassengerMap({ passengerEmail, pickupLocation, dropoffLocation, rideBooked, rideId }) {
  const [passengerLocation, setPassengerLocation] = useState(null); // will get from system
  const [pickup, setPickup] = useState(pickupLocation || null);
  const [dropoff, setDropoff] = useState(dropoffLocation || null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const mapRef = useRef(null);

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
      (pos) => setPassengerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  }, []);

  // ✅ Connect passenger to socket room & listen for driver updates
  useEffect(() => {
    if (!rideId || !passengerEmail) return;

    const socket = io("http://localhost:5000");
    socket.emit("joinRideRoom", rideId);

    socket.on("connect", () => console.log("Connected to socket server"));
    socket.on("driverLocationUpdated", (data) => {
      if (data.rideId === rideId) setDriverLocation({ lat: data.lat, lng: data.lng });
    });

    return () => {
      socket.emit("leaveRideRoom", rideId);
      socket.disconnect();
    };
  }, [rideId, passengerEmail]);

  // ✅ Geocode pickup & dropoff
  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.Geocoder) return;

    const geocoder = new window.google.maps.Geocoder();

    const geocodeAddress = (address, setLocation) => {
      if (!address) return;
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results[0]) {
          setLocation({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          });
        } else {
          console.error("Geocode failed:", status);
        }
      });
    };

    geocodeAddress(pickupLocation?.address, setPickup);
    geocodeAddress(dropoffLocation?.address, setDropoff);
  }, [pickupLocation?.address, dropoffLocation?.address, isLoaded]);

  // ✅ Fetch directions
  useEffect(() => {
    if (!isLoaded || !pickup || !dropoff || !passengerLocation) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result.routes[0]) {
          setDirections(result);
          setDistance(result.routes[0].legs[0].distance.text);
          setDuration(result.routes[0].legs[0].duration.text);

          if (mapRef.current) {
            const bounds = new window.google.maps.LatLngBounds();
            result.routes[0].overview_path.forEach((p) => bounds.extend(p));
            mapRef.current.fitBounds(bounds);
          }
        }
      }
    );
  }, [pickup, dropoff, isLoaded, passengerLocation]);

  // ✅ Reset map on rideBooked
  useEffect(() => {
    if (rideBooked) {
      setPickup(null);
      setDropoff(null);
      setDriverLocation(null);
      setDirections(null);
      setDistance(null);
      setDuration(null);
      setPassengerLocation(null);
    }
  }, [rideBooked]);

  // Only render map when API loaded & location available
  if (!isLoaded || !passengerLocation) {
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
          center={pickup || dropoff || driverLocation || passengerLocation}
          zoom={13}
          onLoad={(map) => (mapRef.current = map)}
        >
          {pickup && <Marker position={pickup} label="Pickup" />}
          {dropoff && <Marker position={dropoff} label="Drop-off" />}
          {driverLocation && <Marker position={driverLocation} label="Driver" />}
          {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
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
