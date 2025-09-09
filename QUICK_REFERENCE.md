# 🚀 Quick Reference - Unified Video Framework

## ⚡ One-Click Startup

```powershell
# Run the startup script (PowerShell)
.\start-servers.ps1
```

## 🎯 Manual Startup (2 Terminals)

### Terminal 1 - Backend (Rental API)
```bash
cd apps\rental-api
npm start
# Wait for: [rental-api] listening on :3100
```

### Terminal 2 - Frontend (Demo Server)  
```bash
node server.js
# Wait for: Server running at: http://localhost:3000
```

## 🔗 Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend Demo** | http://localhost:3000 | Main demo page |
| **Enhanced Player** | http://localhost:3000/apps/demo/enhanced-player.html | Clean player interface |
| **Rental API** | http://localhost:3100 | Backend API endpoints |

## 🔐 Authentication Flow

1. **Enter Email** → Any valid format (e.g., `user@example.com`)
2. **Check Console** → Look for: `[AUTH] OTP for user@example.com: 123456`
3. **Enter OTP** → Use the 6-digit code from console
4. **Success** → Video plays, then paywall appears after free preview

## 🛠️ Common Commands

### Check Running Servers
```powershell
# Check ports
netstat -ano | findstr :3000
netstat -ano | findstr :3100

# Test endpoints
Invoke-WebRequest -Uri "http://localhost:3000"
Invoke-WebRequest -Uri "http://localhost:3100/api/auth/request-otp" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com"}'
```

### View Server Logs (Background Jobs)
```powershell
# List all jobs
Get-Job

# View rental API logs (shows OTPs)
Receive-Job -Id <RentalApiJobId>

# View frontend logs  
Receive-Job -Id <FrontendJobId>
```

### Stop Servers
```powershell
# Stop background jobs
Stop-Job -Id <JobId1>, <JobId2>
Remove-Job -Id <JobId1>, <JobId2>

# OR kill by port
$process = netstat -ano | findstr :3000 | Select-String "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
taskkill /PID $process /F
```

### Rebuild Rental API
```bash
cd apps\rental-api
npm run build
npm start
```

## 🎬 Testing Workflow

```bash
# 1. Request OTP via API
curl -X POST http://localhost:3100/api/auth/request-otp -H "Content-Type: application/json" -d '{"email":"test@example.com"}'

# 2. Check console for OTP (appears in rental API logs)
# [AUTH] OTP for test@example.com: 456789

# 3. Verify OTP
curl -X POST http://localhost:3100/api/auth/verify-otp -H "Content-Type: application/json" -d '{"email":"test@example.com","otp":"456789"}'

# 4. Expected response with session token
# {"success":true,"userId":"user_xyz","sessionToken":"session_abc123"}
```

## ❌ Troubleshooting

### Port Already in Use
```powershell
# Find and kill process
netstat -ano | findstr :<PORT>
taskkill /PID <PID> /F
```

### CORS Errors
- Both servers have CORS enabled
- Ensure requests go to correct ports (3000 → frontend, 3100 → API)

### API 404 Errors  
- Verify rental API is built: `ls apps\rental-api\dist\`
- Rebuild if needed: `cd apps\rental-api && npm run build`

### OTP Not Showing
- Check rental API console/logs for `[AUTH] OTP for...` messages
- Use `Receive-Job` command to view background job output

## 📊 Environment Status Check

```powershell
# Quick health check
Write-Host "Frontend (3000):" -NoNewline
try { $r = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2; if($r.StatusCode -eq 200){"✅ OK"}else{"❌ Error"} } catch {"❌ Down"}

Write-Host "Rental API (3100):" -NoNewline  
try { $r = Invoke-WebRequest -Uri "http://localhost:3100/api/auth/request-otp" -Method POST -ContentType "application/json" -Body '{"email":"test@health.com"}' -TimeoutSec 2; if($r.StatusCode -eq 200){"✅ OK"}else{"❌ Error"} } catch {"❌ Down"}
```

## 🎯 Success Indicators

✅ **Frontend**: Browser loads demo at http://localhost:3000  
✅ **Backend**: Console shows `[rental-api] listening on :3100`  
✅ **Auth Modal**: Email dialog appears on page load  
✅ **OTP Generation**: Console shows OTP codes when requested  
✅ **Video Playback**: Video starts after OTP verification  
✅ **Paywall**: "Rent Now" button appears after free preview  

---

**💡 Pro Tips:**
- Keep rental API console open to see OTP codes
- Use the startup script for quick development setup
- Check browser Network tab for API call debugging
- Use PowerShell for better Windows terminal experience
