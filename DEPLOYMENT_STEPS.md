# Swyft Deployment Guide - Step by Step Commands

## Step 1: Install MongoDB Driver

```bash
cd backend
npm install mongoose
```

## Step 2: Set Up MongoDB Atlas (Cloud Database)

### 2a. Create MongoDB Atlas Account
1. Go to: https://www.mongodb.com/atlas/database
2. Click "Try Free" → Create account
3. Fill in your details and verify email

### 2b. Create Free Cluster
```
1. After login, click "Build a Database"
2. Choose "Free" tier (M0)
3. Give it a name: "swyft"
4. Click "Create"
```

### 2c. Create Database User
```
1. On left sidebar, click "Database Access"
2. Click "Add New Database User"
3. Username: swyftuser
4. Password: Generate and SAVE IT (you'll need it)
5. Role: "Read and Write to any database"
6. Click "Add User"
```

### 2d. Network Access (Allow All)
```
1. Click "Network Access" on left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Click "Confirm"
```

### 2e. Get Connection String
```
1. Click "Database" → "Connect" → "Drivers"
2. Copy the connection string
3. It looks like: mongodb+srv://swyftuser:<password>@cluster0.xxx.mongodb.net/?...
```

## Step 3: Update Backend .env File

Replace the MONGODB_URI line in `backend/.env` with your actual connection string:

```
MONGODB_URI=mongodb+srv://swyftuser:YOUR_PASSWORD@cluster0.xxx.mongodb.net/swyft?retryWrites=true&w=majority
```

## Step 4: Test MongoDB Backend Locally

```bash
cd backend
node server-mongo.js
```

If successful, you should see "MongoDB connected successfully!"

## Step 5: Deploy to Render (Backend)

### 5a. Push Code to GitHub
```bash
# Initialize git if not already
git init
git add .
git commit -m "Add MongoDB support"

# Create GitHub repo and push (do this in GitHub website)
git remote add origin https://github.com/YOUR_USERNAME/swyft.git
git push -u origin main
```

### 5b. Deploy on Render
```
1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Settings:
   - Name: swyft-backend
   - Environment: Node
   - Build Command: npm install
   - Start Command: node server-mongo.js
6. Add these Environment Variables:
   - MONGODB_URI: (your MongoDB Atlas connection string)
   - JWT_SECRET: supersecretkey
   - EMAIL_USER: kombosawb@gmail.com
   - EMAIL_PASS: kyka ypey hfar rjvg
   - PORT: 3001
   - FRONTEND_URL: https://your-app.expo.dev
   - API_URL: https://swyft-backend.onrender.com
7. Click "Deploy"
```

Wait 2-3 minutes for deployment. You'll get a URL like: `https://swyft-backend.onrender.com`

## Step 6: Update Mobile App Config

After Render deployment, update the URL in your mobile app:

Edit `swyft-mobile/src/constants/config.js`:
```javascript
export const API_URL = 'https://swyft-backend.onrender.com';
export const SOCKET_URL = 'https://swyft-backend.onrender.com';
```

## Step 7: Test with Expo Go

```bash
cd swyft-mobile
npx expo start
```

Scan the QR code with your iPhone to test live!

## Step 8: Build for iOS App Store

```bash
cd swyft-mobile

# Install EAS if not installed
npm install -g eas-cli

# Login to Expo
eas login

# Configure for iOS build
eas build --platform ios --profile development
```

This will create an .ipa file you can install on your iPhone for testing!

---

## Quick Command Summary

```bash
# Backend - Install MongoDB driver
cd backend && npm install mongoose

# Backend - Test MongoDB version locally
cd backend && node server-mongo.js

# Mobile - Start for development
cd swyft-mobile && npx expo start

# Mobile - Build for iOS
cd swyft-mobile && eas build --platform ios --profile development
```
