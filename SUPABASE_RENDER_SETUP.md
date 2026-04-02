# Supabase & Render Setup Guide for Swyft

This guide will help you connect your Supabase PostgreSQL database to your Swyft project and deploy it to Render.

## Part 1: Setting Up Supabase

### 1.1 Get Your Supabase Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Find the **Connection string** section
5. Select **URI** format
6. Copy the connection string (it looks like this):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

### 1.2 Update Your Environment Variables

Update your `backend/.env` file with the following:

```env
# Supabase PostgreSQL Database
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# JWT Secret (keep this secure!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email credentials for sending verification
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 1.3 Install PostgreSQL Dependencies

Run this command in your backend directory:

```bash
cd backend
npm install pg
npm uninstall mysql2
```

### 1.4 Update Database Connection in Server

Update your `backend/server.js` to use the new Supabase connection:

```javascript
// Change this line:
// const db = require('./db');

// To this:
const db = require('./db-supabase');
```

### 1.5 Run the Database Schema on Supabase

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `backend/full_database_schema.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the schema

**Important Notes for Supabase:**
- Supabase uses PostgreSQL, so the schema has been adapted accordingly
- The `IF NOT EXISTS` clauses work in PostgreSQL
- ENUM types are created automatically in PostgreSQL
- Timestamps use `TIMESTAMPTZ` for timezone awareness

## Part 2: Deploying to Render

### 2.1 Prepare Your Repository

1. Make sure all your code is committed to Git
2. Push your code to GitHub/GitLab/Bitbucket

### 2.2 Create a Render Account

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Sign up or log in

### 2.3 Create a New Web Service

1. Click **New** → **Web Service**
2. Connect your repository
3. Configure the service:

   **Basic Settings:**
   - **Name**: `swyft-backend` (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: `backend` (if your backend is in a subdirectory)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 2.4 Set Environment Variables on Render

In your Render service settings, add these environment variables:

```
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
JWT_SECRET=your-production-jwt-secret-very-secure
EMAIL_USER=your-production-email@gmail.com
EMAIL_PASS=your-production-app-password
NODE_ENV=production
PORT=10000
```

**Important:** Render assigns a port automatically via the `PORT` environment variable. Your app should use `process.env.PORT || 5000`.

### 2.5 Update package.json for Production

Make sure your `backend/package.json` has the correct start script:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 2.6 Deploy

1. Click **Create Web Service**
2. Render will automatically build and deploy your application
3. Monitor the logs for any errors

## Part 3: Connecting Mobile App to Render Backend

### 3.1 Update Mobile App Configuration

Update `swyft-mobile/src/constants/config.js`:

```javascript
const config = {
  // For local development
  // API_URL: 'http://localhost:5000',
  
  // For production (Render)
  API_URL: 'https://your-service-name.onrender.com',
  
  // Socket URL (same as API for Render)
  SOCKET_URL: 'https://your-service-name.onrender.com'
};

export default config;
```

### 3.2 Update Mobile App Services

Update `swyft-mobile/src/services/api.js` to use the production URL:

```javascript
import config from '../constants/config';

const API_URL = config.API_URL;
```

## Part 4: Testing the Connection

### 4.1 Test Database Connection Locally

```bash
cd backend
node -e "const db = require('./db-supabase'); db.query('SELECT NOW()', (err, res) => { console.log(err, res); db.end(); });"
```

### 4.2 Test API Endpoints

Use tools like Postman or curl to test your API:

```bash
# Test health endpoint
curl https://your-service-name.onrender.com/api/health

# Test user registration
curl -X POST https://your-service-name.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","email":"test@example.com","password":"password123","role":"passenger"}'
```

## Part 5: Troubleshooting

### Common Issues and Solutions

#### 1. SSL Connection Error
**Error**: `self signed certificate in certificate chain`

**Solution**: The SSL configuration in `db-supabase.js` already handles this with `rejectUnauthorized: false`.

#### 2. Connection Timeout
**Error**: `Connection timeout`

**Solution**: 
- Check your Supabase project is not paused
- Verify the connection string is correct
- Check if your IP is whitelisted in Supabase (Supabase allows all IPs by default)

#### 3. Render Deployment Fails
**Error**: Build fails or service won't start

**Solution**:
- Check the build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify the start command is correct
- Make sure the root directory is set correctly

#### 4. CORS Issues
**Error**: `Access-Control-Allow-Origin` errors

**Solution**: Update CORS configuration in `server.js`:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:19006', // Expo development
    'https://your-service-name.onrender.com', // Render production
    'exp://your-expo-url' // Expo production
  ],
  credentials: true
}));
```

#### 5. Environment Variables Not Loading
**Error**: `undefined` values for environment variables

**Solution**:
- Verify `.env` file exists in the backend directory
- Check that `require('dotenv').config()` is at the top of your entry file
- On Render, ensure environment variables are set in the dashboard

## Part 6: Security Best Practices

### 6.1 Environment Variables
- Never commit `.env` files to version control
- Use different JWT secrets for development and production
- Rotate secrets regularly

### 6.2 Database Security
- Use strong passwords for your Supabase database
- Enable Row Level Security (RLS) in Supabase for additional protection
- Regularly backup your database

### 6.3 API Security
- Use HTTPS in production (Render provides this automatically)
- Implement rate limiting
- Validate all user inputs
- Use parameterized queries to prevent SQL injection

## Part 7: Monitoring and Maintenance

### 7.1 Render Monitoring
- Use Render's built-in metrics and logs
- Set up alerts for service failures
- Monitor response times and error rates

### 7.2 Supabase Monitoring
- Use Supabase's dashboard to monitor database performance
- Set up database backups
- Monitor connection pool usage

### 7.3 Application Logging
Implement comprehensive logging in your application:

```javascript
// Add to server.js
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
```

## Quick Reference

### Supabase Connection String Format
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### Render Environment Variables
```
SUPABASE_DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
EMAIL_USER=your-email
EMAIL_PASS=your-password
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
node -e "const db = require('./db-supabase'); db.query('SELECT NOW()', (err, res) => { console.log(err, res); db.end(); });"
```

## Support

If you encounter issues:
1. Check the Render logs for error messages
2. Verify your Supabase connection string
3. Ensure all environment variables are set correctly
4. Test the database connection locally first

For additional help:
- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)
- [Node.js PostgreSQL Guide](https://node-postgres.com/)
