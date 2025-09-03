# Test all video URLs in the framework to ensure they're accessible

Write-Host "`nTesting Video URLs in Unified Video Framework`n" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

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
$workingCount = 0
$brokenCount = 0

foreach ($item in $urls) {
    Write-Host "`nTesting: $($item.Name) [$($item.Type)]" -ForegroundColor Yellow
    Write-Host "URL: $($item.URL)" -ForegroundColor Gray
    
    $status = "Unknown"
    
    try {
        # Try a simple web request with a timeout
        $response = Invoke-WebRequest -Uri $item.URL -Method Get -Headers @{"Range"="bytes=0-1"} -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "✓ SUCCESS: URL is accessible" -ForegroundColor Green
        $status = "Working"
        $workingCount++
    }
    catch {
        $errorMsg = $_.Exception.Message
        
        if ($errorMsg -match "403") {
            Write-Host "✗ FORBIDDEN: Access denied (403)" -ForegroundColor Red
            $status = "403 Forbidden"
            $brokenCount++
        }
        elseif ($errorMsg -match "404") {
            Write-Host "✗ NOT FOUND: URL not found (404)" -ForegroundColor Red
            $status = "404 Not Found"
            $brokenCount++
        }
        else {
            Write-Host "⚠ WARNING: Could not verify (may still work in browser)" -ForegroundColor Yellow
            $status = "Uncertain"
        }
    }
    
    $results += [PSCustomObject]@{
        Name = $item.Name
        Type = $item.Type
        Status = $status
    }
}

Write-Host "`n" -NoNewline
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "SUMMARY REPORT" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

Write-Host "`nTotal URLs tested: $($urls.Count)" -ForegroundColor White
Write-Host "✓ Working: $workingCount" -ForegroundColor Green
Write-Host "✗ Broken: $brokenCount" -ForegroundColor Red
Write-Host "⚠ Uncertain: $($urls.Count - $workingCount - $brokenCount)" -ForegroundColor Yellow

Write-Host "`nDetailed Results:" -ForegroundColor Cyan
$results | Format-Table Name, Type, Status -AutoSize

# Show which files use broken URLs if any found
if ($brokenCount -gt 0) {
    Write-Host "`n⚠ Action Required:" -ForegroundColor Red
    Write-Host "Found $brokenCount broken URL(s) that need to be replaced in the framework." -ForegroundColor Red
    
    $brokenUrls = $results | Where-Object { $_.Status -match "403|404" }
    foreach ($broken in $brokenUrls) {
        Write-Host "`n  • $($broken.Name) ($($broken.Status))" -ForegroundColor Yellow
        Write-Host "    Type: $($broken.Type)" -ForegroundColor Gray
    }
}
else {
    Write-Host "`n✓ All URLs are working correctly!" -ForegroundColor Green
}
