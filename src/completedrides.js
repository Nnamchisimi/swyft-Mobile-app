import React from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";

export default function CompletedRides({ rides }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  return (
    <Box sx={{ width: isDesktop ? 500 : "100%" }}>
      {}
      <Box
        sx={{
          bgcolor: "#4caf50",
          color: "white",
          p: 2,
          fontWeight: "bold",
          fontSize: isDesktop ? "1.25rem" : "1rem",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        Completed Rides
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
        <List>
          {rides.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No completed rides.
            </Typography>
          ) : (
            rides.map((ride) => (
              <React.Fragment key={ride.id || ride._id}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={`#${ride.id || ride._id} - ${
                      ride.passenger_name
                    } (${ride.ride_type})`}
                    secondary={
                      <>
                        <Typography variant="body2" color="textSecondary">
                          From: {ride.pickup_location}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          To: {ride.dropoff_location}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Passenger: {ride.passenger_name} -{" "}
                          {ride.passenger_phone}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Driver: {ride.driver_name || "—"}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Driver Phone: {ride.driver_phone || "—"}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Vehicle: {ride.driver_vehicle || "—"}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Completed At:{" "}
                          {new Date(ride.completed_at).toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Fare: ₺{ride.price?.toFixed(2) || "0.00"}
                                           
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))
          )}
        </List>
      </Box>
    </Box>
  );
}
