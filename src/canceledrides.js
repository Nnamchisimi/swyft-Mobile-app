import React from "react";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";

export default function CanceledRides({ rides }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  return (
    <Box sx={{ width: isDesktop ? 500 : "100%" }}>
      {}
      <Box
        sx={{
          bgcolor: "#ff8a80",
          color: "white",
          p: 2,
          fontWeight: "bold",
          fontSize: isDesktop ? "1.25rem" : "1rem",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        Canceled Rides
      </Box>

      {}
      <Box
        sx={{
          border: "1px solid #ccc",
          borderRadius: 3,
          p: 2,
          bgcolor: "#f5f5f5",
          maxHeight: 500,
          minHeight: 400,
          overflowY: "auto",
        }}
      >
        {rides.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No canceled rides.
          </Typography>
        ) : (
          rides.map((ride) => (
            <Box
              key={ride.id || ride._id}
              sx={{
                border: "1px solid #ccc",
                borderRadius: 2,
                p: 2,
                mb: 2,
              }}
            >
              <Typography>
                #{ride.id || ride._id} - {ride.passenger_name} ({ride.ride_type})
              </Typography>
              <Typography>Pickup: {ride.pickup_location}</Typography>
              <Typography>Dropoff: {ride.dropoff_location}</Typography>
              <Typography>Fare: ₺{ride.price?.toFixed(2) || "0.00"}</Typography>
              {ride.canceled_at && (
                <Typography variant="caption" color="text.secondary">
                  Canceled at: {new Date(ride.canceled_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
