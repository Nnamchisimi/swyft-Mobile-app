# SWYFT

SWYFT is a ride-booking platform with a mobile app and a desktop web application.

## Project Structure

```
swyft/
├── backend/          # Express.js backend API and database
├── swyft-mobile/     # React Native mobile app (Expo)
├── web/              # Desktop web app (Create React App)
├── .env              # Environment variables
└── README.md         # This file
```

### Mobile App (`swyft-mobile/`)

- React Native with Expo
- Passenger and driver flows
- Run from `swyft-mobile/` directory

### Web App (`web/`)

- React with Create React App
- Admin and moderator dashboards
- Run from `web/` directory

### Backend (`backend/`)

- Express.js server
- MongoDB database
- Socket.IO for real-time updates

## Getting Started

See the individual app directories for setup instructions.
