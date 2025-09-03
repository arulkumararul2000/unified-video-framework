import Foundation
import AVFoundation
import AVKit
import React

@objc(UnifiedVideoPlayer)
class UnifiedVideoPlayer: RCTEventEmitter {
    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var playerLayer: AVPlayerLayer?
    private var playerViewController: AVPlayerViewController?
    private var timeObserver: Any?
    private var statusObserver: NSKeyValueObservation?
    private var bufferObserver: NSKeyValueObservation?
    private var currentQualityIndex: Int = -1
    private var availableQualities: [VideoQuality] = []
    
    struct VideoQuality {
        let height: Int
        let width: Int
        let bitrate: Int
        let label: String
        let index: Int
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return [
            "onReady",
            "onPlay",
            "onPause",
            "onEnded",
            "onTimeUpdate",
            "onBuffering",
            "onError",
            "onQualityChanged",
            "onVolumeChanged",
            "onFullscreenChanged",
            "onProgress",
            "onSeeking",
            "onSeeked",
            "onLoadedMetadata"
        ]
    }
    
    @objc
    func initialize(_ config: NSDictionary) {
        DispatchQueue.main.async {
            self.player = AVPlayer()
            self.setupNotifications()
            self.sendEvent(withName: "onReady", body: nil)
        }
    }
    
    @objc
    func load(_ source: NSDictionary) {
        guard let urlString = source["url"] as? String,
              let url = URL(string: urlString) else {
            sendEvent(withName: "onError", body: [
                "code": "INVALID_URL",
                "message": "Invalid video URL"
            ])
            return
        }
        
        DispatchQueue.main.async {
            // Handle DRM if provided
            if let drm = source["drm"] as? NSDictionary {
                self.loadDRMContent(url: url, drm: drm)
            } else {
                self.loadStandardContent(url: url)
            }
            
            // Handle subtitles if provided
            if let subtitles = source["subtitles"] as? [[String: Any]] {
                self.loadSubtitles(subtitles)
            }
        }
    }
    
    private func loadStandardContent(url: URL) {
        let asset = AVAsset(url: url)
        playerItem = AVPlayerItem(asset: asset)
        
        // Setup quality detection for HLS
        if url.absoluteString.contains(".m3u8") {
            detectHLSQualities(asset: asset)
        }
        
        setupPlayerItemObservers()
        player?.replaceCurrentItem(with: playerItem)
        
        // Get video metadata
        asset.loadValuesAsynchronously(forKeys: ["duration", "tracks"]) {
            var error: NSError? = nil
            let status = asset.statusOfValue(forKey: "duration", error: &error)
            
            if status == .loaded {
                let duration = CMTimeGetSeconds(asset.duration)
                let tracks = asset.tracks(withMediaType: .video)
                
                if let videoTrack = tracks.first {
                    let size = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
                    
                    DispatchQueue.main.async {
                        self.sendEvent(withName: "onLoadedMetadata", body: [
                            "duration": duration,
                            "width": abs(size.width),
                            "height": abs(size.height)
                        ])
                    }
                }
            }
        }
    }
    
    private func loadDRMContent(url: URL, drm: NSDictionary) {
        guard let licenseUrl = drm["licenseUrl"] as? String,
              let drmType = drm["type"] as? String else {
            sendEvent(withName: "onError", body: [
                "code": "DRM_CONFIG_ERROR",
                "message": "Invalid DRM configuration"
            ])
            return
        }
        
        if drmType == "fairplay" {
            loadFairPlayContent(url: url, licenseUrl: licenseUrl, headers: drm["headers"] as? [String: String])
        } else {
            sendEvent(withName: "onError", body: [
                "code": "DRM_NOT_SUPPORTED",
                "message": "DRM type \(drmType) not supported on iOS"
            ])
        }
    }
    
    private func loadFairPlayContent(url: URL, licenseUrl: String, headers: [String: String]?) {
        // FairPlay implementation would go here
        // This is a simplified version
        let asset = AVURLAsset(url: url)
        
        // Set up content key session for FairPlay
        // Implementation details omitted for brevity
        
        playerItem = AVPlayerItem(asset: asset)
        setupPlayerItemObservers()
        player?.replaceCurrentItem(with: playerItem)
    }
    
    private func detectHLSQualities(asset: AVAsset) {
        guard let urlAsset = asset as? AVURLAsset else { return }
        
        // Access the available media selection options
        Task {
            do {
                let characteristics = try await urlAsset.load(.availableMediaCharacteristicsWithMediaSelectionOptions)
                
                for characteristic in characteristics {
                    if let group = try await urlAsset.loadMediaSelectionGroup(for: characteristic) {
                        let options = group.options
                        
                        availableQualities = options.enumerated().map { index, option in
                            let displayName = option.displayName ?? "Quality \(index + 1)"
                            
                            // Try to extract resolution from display name
                            var height = 0
                            if let match = displayName.range(of: "\\d+p", options: .regularExpression) {
                                let heightStr = displayName[match].dropLast()
                                height = Int(heightStr) ?? 0
                            }
                            
                            return VideoQuality(
                                height: height,
                                width: 0,
                                bitrate: 0,
                                label: displayName,
                                index: index
                            )
                        }
                    }
                }
            } catch {
                print("Error loading HLS qualities: \(error)")
            }
        }
    }
    
    private func loadSubtitles(_ subtitles: [[String: Any]]) {
        guard let playerItem = playerItem else { return }
        
        for subtitle in subtitles {
            guard let urlString = subtitle["url"] as? String,
                  let url = URL(string: urlString),
                  let language = subtitle["language"] as? String,
                  let label = subtitle["label"] as? String else { continue }
            
            let asset = AVAsset(url: url)
            let track = AVMutableCompositionTrack()
            
            // Add subtitle track to player item
            // Implementation details for subtitle loading
        }
    }
    
    private func setupPlayerItemObservers() {
        guard let playerItem = playerItem else { return }
        
        // Status observer
        statusObserver = playerItem.observe(\.status) { [weak self] item, _ in
            if item.status == .failed {
                self?.sendEvent(withName: "onError", body: [
                    "code": "PLAYBACK_ERROR",
                    "message": item.error?.localizedDescription ?? "Unknown playback error"
                ])
            }
        }
        
        // Buffer observer
        bufferObserver = playerItem.observe(\.isPlaybackBufferEmpty) { [weak self] item, _ in
            self?.sendEvent(withName: "onBuffering", body: ["isBuffering": item.isPlaybackBufferEmpty])
        }
        
        // Time observer
        let interval = CMTime(seconds: 0.25, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            let seconds = CMTimeGetSeconds(time)
            self?.sendEvent(withName: "onTimeUpdate", body: ["currentTime": seconds])
            
            // Calculate buffer progress
            if let timeRanges = self?.playerItem?.loadedTimeRanges,
               let duration = self?.playerItem?.duration {
                var buffered: Double = 0
                
                for value in timeRanges {
                    let timeRange = value.timeRangeValue
                    let start = CMTimeGetSeconds(timeRange.start)
                    let end = start + CMTimeGetSeconds(timeRange.duration)
                    
                    if seconds >= start && seconds <= end {
                        buffered = end
                        break
                    }
                }
                
                let total = CMTimeGetSeconds(duration)
                if total > 0 {
                    let percentage = (buffered / total) * 100
                    self?.sendEvent(withName: "onProgress", body: ["bufferedPercentage": percentage])
                }
            }
        }
    }
    
    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFinishPlaying),
            name: .AVPlayerItemDidPlayToEndTime,
            object: nil
        )
    }
    
    @objc private func playerDidFinishPlaying() {
        sendEvent(withName: "onEnded", body: nil)
    }
    
    @objc
    func play() {
        DispatchQueue.main.async {
            self.player?.play()
            self.sendEvent(withName: "onPlay", body: nil)
        }
    }
    
    @objc
    func pause() {
        DispatchQueue.main.async {
            self.player?.pause()
            self.sendEvent(withName: "onPause", body: nil)
        }
    }
    
    @objc
    func seek(_ time: Double) {
        DispatchQueue.main.async {
            let cmTime = CMTime(seconds: time, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
            self.sendEvent(withName: "onSeeking", body: nil)
            
            self.player?.seek(to: cmTime) { [weak self] completed in
                if completed {
                    self?.sendEvent(withName: "onSeeked", body: ["currentTime": time])
                }
            }
        }
    }
    
    @objc
    func setVolume(_ volume: Double) {
        DispatchQueue.main.async {
            self.player?.volume = Float(volume)
            self.sendEvent(withName: "onVolumeChanged", body: ["volume": volume])
        }
    }
    
    @objc
    func setPlaybackRate(_ rate: Double) {
        DispatchQueue.main.async {
            self.player?.rate = Float(rate)
        }
    }
    
    @objc
    func setQuality(_ index: Int) {
        guard index >= 0 && index < availableQualities.count else { return }
        
        currentQualityIndex = index
        let quality = availableQualities[index]
        
        // Implementation for quality switching in HLS
        // This would involve selecting the appropriate variant in the HLS manifest
        
        sendEvent(withName: "onQualityChanged", body: [
            "height": quality.height,
            "width": quality.width,
            "bitrate": quality.bitrate,
            "label": quality.label,
            "index": quality.index
        ])
    }
    
    @objc
    func getQualities(_ callback: @escaping RCTResponseSenderBlock) {
        let qualities = availableQualities.map { quality in
            return [
                "height": quality.height,
                "width": quality.width,
                "bitrate": quality.bitrate,
                "label": quality.label,
                "index": quality.index
            ]
        }
        callback([NSNull(), qualities])
    }
    
    @objc
    func getCurrentTime(_ callback: @escaping RCTResponseSenderBlock) {
        guard let player = player else {
            callback([0])
            return
        }
        
        let time = CMTimeGetSeconds(player.currentTime())
        callback([time])
    }
    
    @objc
    func getDuration(_ callback: @escaping RCTResponseSenderBlock) {
        guard let duration = playerItem?.duration else {
            callback([0])
            return
        }
        
        let seconds = CMTimeGetSeconds(duration)
        callback([seconds])
    }
    
    @objc
    func enterFullscreen() {
        DispatchQueue.main.async {
            guard self.playerViewController == nil else { return }
            
            self.playerViewController = AVPlayerViewController()
            self.playerViewController?.player = self.player
            
            if let rootViewController = UIApplication.shared.keyWindow?.rootViewController {
                rootViewController.present(self.playerViewController!, animated: true) {
                    self.sendEvent(withName: "onFullscreenChanged", body: ["isFullscreen": true])
                }
            }
        }
    }
    
    @objc
    func exitFullscreen() {
        DispatchQueue.main.async {
            self.playerViewController?.dismiss(animated: true) {
                self.playerViewController = nil
                self.sendEvent(withName: "onFullscreenChanged", body: ["isFullscreen": false])
            }
        }
    }
    
    @objc
    func enterPictureInPicture() {
        DispatchQueue.main.async {
            guard AVPictureInPictureController.isPictureInPictureSupported() else {
                self.sendEvent(withName: "onError", body: [
                    "code": "PIP_NOT_SUPPORTED",
                    "message": "Picture in Picture is not supported on this device"
                ])
                return
            }
            
            // PiP implementation would go here
        }
    }
    
    @objc
    func destroy() {
        DispatchQueue.main.async {
            self.player?.pause()
            self.player?.replaceCurrentItem(with: nil)
            
            if let timeObserver = self.timeObserver {
                self.player?.removeTimeObserver(timeObserver)
            }
            
            self.statusObserver?.invalidate()
            self.bufferObserver?.invalidate()
            
            NotificationCenter.default.removeObserver(self)
            
            self.player = nil
            self.playerItem = nil
            self.playerLayer = nil
            self.playerViewController = nil
        }
    }
    
    deinit {
        destroy()
    }
}
