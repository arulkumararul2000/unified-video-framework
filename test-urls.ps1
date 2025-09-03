# Test all video URLs in the framework to ensure they're accessible

Write-Host "Testing Video URLs in Unified Video Framework" -ForegroundColor Cyan
Write-Host "=" * 50

# Define all URLs to test
$urls = @(
    @{Name="Mux HLS Stream"; URL="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; Type="HLS"},
    @{Name="Unified Streaming HLS"; URL="https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"; Type="HLS"},
    @{Name="Akamai DASH BBB"; URL="https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"; Type="DASH"},
    @{Name="Akamai DASH Envivio"; URL="https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd"; Type="DASH"},
    @{Name="Google Shaka DASH"; URL="https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd"; Type="DASH"},
    @{Name="Big Buck Bunny MP4"; URL="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"; Type="MP4"},
    @{Name="Elephants Dream MP4"; URL="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"; Type="MP4"},
    @{Name="Sintel MP4"; URL="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"; Type="MP4"}
)

$results = @()

foreach ($item in $urls) {
    Write-Host "`nTesting: $($item.Name) [$($item.Type)]" -ForegroundColor Yellow
    Write-Host "URL: $($item.URL)" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $item.URL -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq 200) {
            Write-Host "✓ SUCCESS: Status $statusCode" -ForegroundColor Green
            $status = "Working"
        } else {
            Write-Host "⚠ WARNING: Status $statusCode" -ForegroundColor Yellow
            $status = "Warning - Status $statusCode"
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        
        if ($errorMessage -like "*403*") {
            Write-Host "✗ FORBIDDEN: Access denied (403)" -ForegroundColor Red
            $status = "Broken - 403 Forbidden"
        }
        elseif ($errorMessage -like "*404*") {
            Write-Host "✗ NOT FOUND: URL not found (404)" -ForegroundColor Red
            $status = "Broken - 404 Not Found"
        }
        else {
            # Some servers don't support HEAD requests, try GET with limited range
            try {
                $response2 = Invoke-WebRequest -Uri $item.URL -Method Get -Headers @{"Range"="bytes=0-1"} -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                Write-Host "✓ SUCCESS: Server responded (GET request)" -ForegroundColor Green
                $status = "Working"
            }
            catch {
                Write-Host "✗ ERROR: $($_.Exception.Message)" -ForegroundColor Red
                $status = "Error - $($_.Exception.Message)"
            }
        }
    }
    
    $results += [PSCustomObject]@{
        Name = $item.Name
        Type = $item.Type
        URL = $item.URL
        Status = $status
    }
}

Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
Write-Host "SUMMARY REPORT" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Cyan

$working = $results | Where-Object { $_.Status -eq "Working" }
$broken = $results | Where-Object { $_.Status -like "Broken*" }
$errors = $results | Where-Object { $_.Status -like "Error*" -or $_.Status -like "Warning*" }

Write-Host "`nWorking URLs: $($working.Count)/$($results.Count)" -ForegroundColor Green
if ($broken.Count -gt 0) {
    Write-Host "Broken URLs: $($broken.Count)" -ForegroundColor Red
    $broken | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Status)" -ForegroundColor Red
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`nURLs with issues: $($errors.Count)" -ForegroundColor Yellow
    $errors | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Status)" -ForegroundColor Yellow
    }
}

Write-Host "`nDetailed Results:" -ForegroundColor Cyan
$results | Format-Table -AutoSize

# Export results to JSON for reference
$results | ConvertTo-Json -Depth 3 | Out-File "url-test-results.json"
Write-Host "`nResults saved to url-test-results.json" -ForegroundColor Gray
