# Test video URLs in the framework

Write-Host ""
Write-Host "Testing Video URLs in Unified Video Framework" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

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

$workingCount = 0
$brokenCount = 0
$uncertainCount = 0

foreach ($item in $urls) {
    Write-Host ""
    Write-Host "Testing: $($item.Name) [$($item.Type)]" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $item.URL -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host "[OK] URL is accessible" -ForegroundColor Green
        $workingCount++
    }
    catch {
        $errorMsg = $_.Exception.Message
        
        if ($errorMsg -match "403") {
            Write-Host "[ERROR] 403 Forbidden - Access denied" -ForegroundColor Red
            $brokenCount++
        }
        elseif ($errorMsg -match "404") {
            Write-Host "[ERROR] 404 Not Found" -ForegroundColor Red
            $brokenCount++
        }
        else {
            # Try GET request with byte range
            try {
                $response2 = Invoke-WebRequest -Uri $item.URL -Method Get -Headers @{"Range"="bytes=0-1"} -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
                Write-Host "[OK] URL is accessible (via GET)" -ForegroundColor Green
                $workingCount++
            }
            catch {
                Write-Host "[WARNING] Could not verify - may still work in browser" -ForegroundColor Yellow
                $uncertainCount++
            }
        }
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total URLs tested: $($urls.Count)"
Write-Host "Working: $workingCount" -ForegroundColor Green
Write-Host "Broken: $brokenCount" -ForegroundColor Red
Write-Host "Uncertain: $uncertainCount" -ForegroundColor Yellow

if ($brokenCount -gt 0) {
    Write-Host ""
    Write-Host "ACTION REQUIRED: Found broken URLs that need replacement" -ForegroundColor Red
}
else {
    Write-Host ""
    Write-Host "All URLs are working or accessible!" -ForegroundColor Green
}
