# Unified Video Framework - Complete Setup Guide

## 🚀 Quick Start

This guide will help you run both the frontend demo and rental API backend servers for the unified video framework with email authentication and paywall functionality.

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **PostgreSQL** (optional - system works without DB)
- **Git**

## 📁 Project Structure

```
unified-video-framework/
├── apps/
│   └── rental-api/          # Backend API server (port 3100)
│       ├── src/
│       ├── dist/
│       ├── .env
│       └── package.json
├── apps/demo/               # Frontend demo files
├── server.js                # Frontend static server (port 3000)
├── package.json
└── README.md
```

## 🔧 Step-by-Step Setup

### Step 1: Clone and Install Dependencies

```bash
# Navigate to the project directory
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"

# Install main project dependencies
npm install

# Install rental API dependencies
cd apps\rental-api
npm install
cd ..\..
```

### Step 2: Configure Environment Variables

The rental API uses environment variables for configuration:

```bash
# Check the rental API .env file
cat apps\rental-api\.env
```

**Default Configuration:**
```env
# Server
APP_BASE_URL=http://localhost:3100
PORT=3100

# Database (optional)
DATABASE_URL=postgres://postgres:password@localhost:5432/uvf

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
CASHFREE_APP_ID=YOUR_CASHFREE_APP_ID
CASHFREE_SECRET_KEY=YOUR_CASHFREE_SECRET_KEY
CASHFREE_BASE_URL=https://sandbox.cashfree.com

# Development
ENABLE_DEV_MOCKS=1
```

### Step 3: Build the Rental API

```bash
# Build the TypeScript backend
cd apps\rental-api
npm run build
cd ..\..
```

## 🎯 Running the Servers

### Method 1: Manual Start (Recommended for Development)

#### Terminal 1 - Start Rental API Backend (Port 3100)
```bash
# Navigate to rental API directory
cd apps\rental-api

# Start the backend server
npm start

# You should see:
# [rental-api] listening on :3100
```

#### Terminal 2 - Start Frontend Demo Server (Port 3000)
```bash
# Navigate back to root directory
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"

# Start the frontend server
node server.js

# You should see:
# Server running at: http://localhost:3000
```

### Method 2: PowerShell Background Jobs

```powershell
# Start Rental API as background job
Start-Job -ScriptBlock { 
    cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework\apps\rental-api"
    npm start 
}

# Start Frontend Server as background job
Start-Job -ScriptBlock { 
    cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"
    node server.js 
}

# Check job status
Get-Job

# View job output (to see OTPs)
Receive-Job -Id 1  # Replace with actual job ID
```

### Method 3: Using npm Scripts (if configured)

```bash
# From root directory
npm run dev:api     # Starts rental API
npm run dev:demo    # Starts demo server
```

## ✅ Verification Steps

### 1. Check Both Servers are Running

```bash
# Test Frontend Server (Port 3000)
curl http://localhost:3000
# Should return HTML content

# Test Rental API (Port 3100)
curl -X POST http://localhost:3100/api/auth/request-otp -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
# Should return: {"success":true,"message":"Verification code sent to your email","email":"test@example.com"}
```

### 2. Check Processes

```bash
# Windows - Check what's running on each port
netstat -ano | findstr :3000
netstat -ano | findstr :3100

# Should show processes listening on both ports
```

## 🌐 Access Points

### Frontend Demo
- **URL**: http://localhost:3000
- **Demo Page**: http://localhost:3000/apps/demo/demo.html
- **Enhanced Player**: http://localhost:3000/apps/demo/enhanced-player.html

### Backend API Endpoints
- **Base URL**: http://localhost:3100
- **Request OTP**: `POST /api/auth/request-otp`
- **Verify OTP**: `POST /api/auth/verify-otp`
- **User Info**: `GET /api/auth/me`
- **Rentals**: `POST /api/rentals/rent-video`

## 🔐 Testing Authentication Flow

### 1. Request OTP
```bash
curl -X POST http://localhost:3100/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 2. Check Console for OTP
Look in the rental API server console for:
```
[AUTH] OTP for test@example.com: 123456 (expires in 5 minutes)
```

### 3. Verify OTP
```bash
curl -X POST http://localhost:3100/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

## 🎬 Complete Workflow Test

1. **Open Browser**: Navigate to http://localhost:3000
2. **Email Modal**: Should appear immediately asking for email
3. **Enter Email**: Use any valid email format (e.g., test@example.com)
4. **Click "Send OTP"**: Check the rental API console for the OTP code
5. **Enter OTP**: Use the code from the console
6. **Authentication Success**: Modal should close, video should start
7. **Free Preview**: Video plays for the configured free duration
8. **Paywall**: After free time expires, paywall should show with "Rent Now" button

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Kill process on port 3100
netstat -ano | findstr :3100
taskkill /PID <PID> /F
```

### API Not Responding
```bash
# Check if rental API is built
cd apps\rental-api
ls dist/  # Should contain .js files

# Rebuild if needed
npm run build
```

### CORS Issues
The servers are configured with CORS enabled:
- Frontend server: Serves with CORS headers
- Rental API: Configured with `cors()` middleware

### Database Connection (Optional)
The system works without a database. If you want to use PostgreSQL:
```bash
# Set DATABASE_URL in apps/rental-api/.env
DATABASE_URL=postgres://username:password@localhost:5432/database_name
```

## 📝 Development Tips

### Viewing Logs
```bash
# View rental API logs in real-time
cd apps\rental-api
npm start  # Keep this terminal open to see OTP codes

# View frontend server logs
node server.js  # Keep this terminal open to see requests
```

### Hot Reload for Development
```bash
# Use development mode for rental API (auto-restart on changes)
cd apps\rental-api
npm run dev  # Uses ts-node-dev for hot reload
```

### Stopping Servers
```bash
# If running in terminals: Ctrl+C in each terminal

# If running as background jobs:
Stop-Job -Id <JobId>
Remove-Job -Id <JobId>
```

## 🎯 Success Indicators

✅ **Frontend Server**: Browser loads demo page at http://localhost:3000
✅ **Rental API**: Console shows `[rental-api] listening on :3100`
✅ **Authentication**: Email modal appears and OTP request returns success
✅ **Paywall**: After free preview, "Rent Now" button is visible
✅ **No CORS errors**: Browser console shows no cross-origin errors

## 📞 Support

If you encounter issues:
1. Check both terminals/consoles for error messages
2. Verify ports 3000 and 3100 are not blocked by firewall
3. Ensure all npm dependencies are installed
4. Check the network tab in browser dev tools for failed requests

---

**Note**: The system is configured for development with mock payment gateways and console-based OTP delivery. For production, configure proper email service and payment gateway credentials.
