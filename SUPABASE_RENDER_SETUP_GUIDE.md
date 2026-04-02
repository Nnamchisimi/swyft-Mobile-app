# Swyft Project: Supabase + Render Setup Guide

This guide will help you set up Supabase as your database and deploy your backend to Render.

## Table of Contents
1. [Supabase Setup](#1-supabase-setup)
2. [Database Schema Setup](#2-database-schema-setup)
3. [Backend Configuration](#3-backend-configuration)
4. [Render Deployment](#4-render-deployment)
5. [Mobile App Configuration](#5-mobile-app-configuration)
6. [Testing](#6-testing)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Supabase Setup

### 1.1 Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project

### 1.2 Get Your Database Connection String
1. In your Supabase dashboard, go to **Settings** → **Database**
2. Find the **Connection string** section
3. Select **URI** format
4. Copy the connection string (it looks like this):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your database password (set during project creation)

### 1.3 Get Your API Keys
1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like: `https://[YOUR-PROJECT-REF].supabase.co`)
   - **anon/public** key (for client-side)
   - **service_role** key (for server-side, keep this secret!)

---

## 2. Database Schema Setup

### 2.1 Run the Schema in Supabase
1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `backend/supabase_schema.sql`
4. Paste it into the SQL editor
5. Click **Run** to execute the schema

### 2.2 Verify Tables Created
1. Go to **Table Editor** in your Supabase dashboard
2. You should see the following tables:
   - `users`
   - `cars`
   - `rides`
   - `driver_profiles`
   - `ratings`
   - `email_tokens`

---

## 3. Backend Configuration

### 3.1 Update Environment Variables
1. Copy `backend/.env.example` to `backend/.env`
2. Update the following variables:

```env
# Supabase Database Connection
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email Configuration (for verification emails)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 3.2 Install Dependencies
Run the following command in the `backend` directory:

```bash
cd backend
npm install
```

This will install the `pg` package for PostgreSQL connectivity.

### 3.3 Update Server.js to Use Supabase
The server.js file needs to be updated to use the new PostgreSQL database. Here are the key changes:

1. **Import the new database module:**
   ```javascript
   // Replace this:
   // const db = require('./db');
   
   // With this:
   const db = require('./db-supabase');
   ```

2. **Update database queries** (if needed):
   - PostgreSQL uses `$1, $2, $3` for parameterized queries instead of `?`
   - Example: `SELECT * FROM users WHERE email = $1` instead of `SELECT * FROM users WHERE email = ?`

### 3.4 Test Database Connection Locally
```bash
cd backend
node -e "const db = require('./db-supabase'); db.query('SELECT NOW()', (err, res) => { if (err) console.error(err); else console.log(res.rows); process.exit(); });"
```

---

## 4. Render Deployment

### 4.1 Create a Render Account
1. Go to [https://render.com](https://render.com)
2. Sign up for a free account

### 4.2 Create a New Web Service
1. Click **New +** → **Web Service**
2. Connect your GitHub/GitLab repository
3. Select the repository containing your Swyft project

### 4.3 Configure the Web Service
Fill in the following settings:

- **Name**: `swyft-backend` (or your preferred name)
- **Region**: Choose the closest to your users
- **Branch**: `main` (or your deployment branch)
- **Root Directory**: `backend` (if your backend is in a subdirectory)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 4.4 Set Environment Variables
In the **Environment** section, add the following variables:

| Key | Value |
|-----|-------|
| `SUPABASE_DATABASE_URL` | Your Supabase connection string |
| `JWT_SECRET` | Your JWT secret (use a strong random string) |
| `EMAIL_USER` | Your email address |
| `EMAIL_PASS` | Your email app password |
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render will override this) |

### 4.5 Deploy
1. Click **Create Web Service**
2. Render will automatically build and deploy your application
3. Wait for the deployment to complete
4. Note your service URL (e.g., `https://swyft-backend.onrender.com`)

---

## 5. Mobile App Configuration

### 5.1 Update API Configuration
Update `swyft-mobile/src/services/api.js` to point to your Render deployment:

```javascript
// For development (local)
// const API_BASE_URL = 'http://localhost:5000';

// For production (Render)
const API_BASE_URL = 'https://swyft-backend.onrender.com';

// Update all API calls to use API_BASE_URL
```

### 5.2 Update Socket Configuration
Update `swyft-mobile/src/services/socket.js` to connect to your Render deployment:

```javascript
import { io } from 'socket.io-client';

// For development (local)
// const SOCKET_URL = 'http://localhost:5000';

// For production (Render)
const SOCKET_URL = 'https://swyft-backend.onrender.com';

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false,
});

export default socket;
```

### 5.3 Build and Test the Mobile App
```bash
cd swyft-mobile
npm install
npx expo start
```

---

## 6. Testing

### 6.1 Test Backend API
Use curl or Postman to test your API:

```bash
# Test health endpoint
curl https://swyft-backend.onrender.com/api/health

# Test user registration
curl -X POST https://swyft-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User","role":"passenger"}'
```

### 6.2 Test Database Connection
Check your Render logs to ensure the database connection is successful:

1. Go to your Render dashboard
2. Click on your web service
3. Check the **Logs** tab for any database connection errors

### 6.3 Test Mobile App
1. Open your mobile app
2. Try to register a new user
3. Try to log in
4. Test the core functionality (booking rides, etc.)

---

## 7. Troubleshooting

### 7.1 Database Connection Issues

**Problem**: `Error: Connection terminated unexpectedly`
**Solution**: 
- Check your Supabase connection string
- Ensure your Supabase project is not paused
- Verify the password in the connection string

**Problem**: `Error: SSL required`
**Solution**: The `db-supabase.js` file already includes SSL configuration. Make sure you're using the correct file.

### 7.2 Render Deployment Issues

**Problem**: Build fails
**Solution**:
- Check the build logs in Render
- Ensure all dependencies are in `package.json`
- Verify the build command is correct

**Problem**: Service crashes on startup
**Solution**:
- Check the logs for error messages
- Verify environment variables are set correctly
- Test locally first

### 7.3 Mobile App Connection Issues

**Problem**: `Network request failed`
**Solution**:
- Verify the API URL is correct
- Check if the backend is running
- Ensure CORS is configured correctly in the backend

**Problem**: Socket connection fails
**Solution**:
- Verify the socket URL is correct
- Check if the backend supports WebSocket connections
- Ensure the socket.io client version matches the server version

---

## 8. Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)
- [Node.js PostgreSQL Tutorial](https://node-postgres.com/)
- [Socket.io Documentation](https://socket.io/docs/v4/)

---

## 9. Quick Reference

### Supabase Connection String Format
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### Render Environment Variables
```
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
NODE_ENV=production
PORT=10000
```

### Useful Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# Test database connection
node -e "const db = require('./db-supabase'); db.query('SELECT NOW()', (err, res) => { if (err) console.error(err); else console.log(res.rows); process.exit(); });"
```

---

## 10. Security Notes

1. **Never commit `.env` files** to version control
2. **Use strong passwords** for your Supabase database
3. **Rotate secrets regularly** (JWT_SECRET, database password)
4. **Enable Row Level Security (RLS)** in Supabase for additional protection
5. **Use HTTPS** for all production connections (Render provides this automatically)

---

## 11. Support

If you encounter issues not covered in this guide:
1. Check the Render logs for error messages
2. Check the Supabase logs for database errors
3. Test the API endpoints using Postman or curl
4. Verify all environment variables are set correctly

For additional help, refer to:
- [Supabase Community](https://github.com/supabase/supabase/discussions)
- [Render Community](https://community.render.com/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)
