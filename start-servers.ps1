# Unified Video Framework - Server Startup Script
# This script starts both the frontend and backend servers

Write-Host "🚀 Starting Unified Video Framework Servers..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Blue

# Get the current directory
$rootDir = Get-Location

# Check if we're in the correct directory
if (-not (Test-Path "server.js") -or -not (Test-Path "apps\rental-api")) {
    Write-Host "❌ Error: Please run this script from the unified-video-framework root directory" -ForegroundColor Red
    Write-Host "Current directory: $rootDir" -ForegroundColor Yellow
    exit 1
}

# Function to check if a port is in use
function Test-Port {
    param($Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Kill existing processes on our ports if needed
Write-Host "🔍 Checking for existing processes..." -ForegroundColor Yellow

if (Test-Port 3000) {
    Write-Host "⚠️  Port 3000 is in use. Attempting to free it..." -ForegroundColor Yellow
    $process3000 = netstat -ano | findstr :3000 | Select-String "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
    if ($process3000) {
        taskkill /PID $process3000 /F 2>$null
        Start-Sleep -Seconds 2
    }
}

if (Test-Port 3100) {
    Write-Host "⚠️  Port 3100 is in use. Attempting to free it..." -ForegroundColor Yellow
    $process3100 = netstat -ano | findstr :3100 | Select-String "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] }
    if ($process3100) {
        taskkill /PID $process3100 /F 2>$null
        Start-Sleep -Seconds 2
    }
}

# Check if rental API is built
if (-not (Test-Path "apps\rental-api\dist\server.js")) {
    Write-Host "🔨 Building rental API..." -ForegroundColor Yellow
    Set-Location "apps\rental-api"
    npm run build
    Set-Location $rootDir
}

Write-Host "🎯 Starting Backend Server (Rental API) on port 3100..." -ForegroundColor Cyan

# Start Rental API Server
$rentalApiJob = Start-Job -ScriptBlock {
    param($rootDir)
    Set-Location "$rootDir\apps\rental-api"
    npm start
} -ArgumentList $rootDir

Start-Sleep -Seconds 3

Write-Host "🌐 Starting Frontend Server (Demo) on port 3000..." -ForegroundColor Cyan

# Start Frontend Demo Server
$frontendJob = Start-Job -ScriptBlock {
    param($rootDir)
    Set-Location $rootDir
    node server.js
} -ArgumentList $rootDir

Start-Sleep -Seconds 3

# Check if servers started successfully
Write-Host "✅ Verifying servers..." -ForegroundColor Yellow

$rentalApiRunning = $false
$frontendRunning = $false

# Test Rental API
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3100/api/auth/request-otp" -Method POST -ContentType "application/json" -Body '{"email":"test@startup.com"}' -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $rentalApiRunning = $true
        Write-Host "✅ Rental API (Backend) - RUNNING on port 3100" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Rental API (Backend) - FAILED to start on port 3100" -ForegroundColor Red
}

# Test Frontend Server
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $frontendRunning = $true
        Write-Host "✅ Frontend Server (Demo) - RUNNING on port 3000" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Frontend Server (Demo) - FAILED to start on port 3000" -ForegroundColor Red
}

Write-Host "================================================" -ForegroundColor Blue

if ($rentalApiRunning -and $frontendRunning) {
    Write-Host "🎉 SUCCESS! Both servers are running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor White
    Write-Host "   Frontend Demo: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   Enhanced Player: http://localhost:3000/apps/demo/enhanced-player.html" -ForegroundColor Cyan
    Write-Host "   Rental API: http://localhost:3100" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Job Management:" -ForegroundColor White
    Write-Host "   Frontend Job ID: $($frontendJob.Id)" -ForegroundColor Yellow
    Write-Host "   Rental API Job ID: $($rentalApiJob.Id)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 View Logs (to see OTP codes):" -ForegroundColor White
    Write-Host "   Receive-Job -Id $($rentalApiJob.Id)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⏹️  Stop Servers:" -ForegroundColor White
    Write-Host "   Stop-Job -Id $($frontendJob.Id), $($rentalApiJob.Id)" -ForegroundColor Yellow
    Write-Host "   Remove-Job -Id $($frontendJob.Id), $($rentalApiJob.Id)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🧪 Test the complete flow:" -ForegroundColor White
    Write-Host "   1. Open http://localhost:3000 in your browser" -ForegroundColor Cyan
    Write-Host "   2. Email modal should appear" -ForegroundColor Cyan
    Write-Host "   3. Enter any email and click 'Send OTP'" -ForegroundColor Cyan
    Write-Host "   4. Check this console for OTP code using: Receive-Job -Id $($rentalApiJob.Id)" -ForegroundColor Cyan
    Write-Host "   5. Enter the OTP to authenticate" -ForegroundColor Cyan
    Write-Host "   6. Video should play, then show paywall after free preview" -ForegroundColor Cyan
    
} else {
    Write-Host "❌ STARTUP FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Troubleshooting:" -ForegroundColor White
    
    if (-not $rentalApiRunning) {
        Write-Host "   • Check rental API logs: Receive-Job -Id $($rentalApiJob.Id)" -ForegroundColor Yellow
        Write-Host "   • Verify apps/rental-api/.env file exists" -ForegroundColor Yellow
        Write-Host "   • Try manual start: cd apps/rental-api && npm start" -ForegroundColor Yellow
    }
    
    if (-not $frontendRunning) {
        Write-Host "   • Check frontend logs: Receive-Job -Id $($frontendJob.Id)" -ForegroundColor Yellow
        Write-Host "   • Verify server.js exists in root directory" -ForegroundColor Yellow
        Write-Host "   • Try manual start: node server.js" -ForegroundColor Yellow
    }
    
    # Clean up jobs if startup failed
    Stop-Job -Id $frontendJob.Id, $rentalApiJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $frontendJob.Id, $rentalApiJob.Id -ErrorAction SilentlyContinue
}

Write-Host "================================================" -ForegroundColor Blue
