//
//  ViewController.swift
//  UnifiedVideoPlayer Sample App
//
//  Example of integrating UnifiedVideoPlayer into an existing iOS app
//

import UIKit
import UnifiedVideoPlayer

class ViewController: UIViewController {
    
    // MARK: - IBOutlets
    @IBOutlet weak var playerContainer: UIView!
    @IBOutlet weak var playPauseButton: UIButton!
    @IBOutlet weak var progressSlider: UISlider!
    @IBOutlet weak var currentTimeLabel: UILabel!
    @IBOutlet weak var durationLabel: UILabel!
    @IBOutlet weak var volumeSlider: UISlider!
    @IBOutlet weak var loadingIndicator: UIActivityIndicatorView!
    @IBOutlet weak var errorLabel: UILabel!
    
    // MARK: - Properties
    private var videoPlayer: UnifiedVideoPlayer!
    private var isSliderTracking = false
    
    // Sample video URLs
    private let sampleVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
        "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    ]
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupVideoPlayer()
        loadSampleVideo()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        videoPlayer?.pause()
    }
    
    deinit {
        videoPlayer?.destroy()
    }
    
    // MARK: - Setup
    private func setupUI() {
        errorLabel.isHidden = true
        loadingIndicator.hidesWhenStopped = true
        
        // Configure sliders
        progressSlider.value = 0
        volumeSlider.value = 1.0
        
        // Style the player container
        playerContainer.backgroundColor = .black
        playerContainer.layer.cornerRadius = 8
        playerContainer.clipsToBounds = true
    }
    
    private func setupVideoPlayer() {
        // Initialize the player
        videoPlayer = UnifiedVideoPlayer()
        
        // Configure player
        let config = PlayerConfiguration(dictionary: [
            "autoPlay": false,
            "controls": false, // Using custom controls
            "muted": false,
            "debug": true
        ])
        
        // Initialize with container
        videoPlayer.initialize(container: playerContainer, configuration: config)
        
        // Set up event listeners
        setupPlayerEventListeners()
    }
    
    private func setupPlayerEventListeners() {
        // Ready event
        videoPlayer.onReady = { [weak self] in
            self?.handlePlayerReady()
        }
        
        // Play/Pause events
        videoPlayer.onPlay = { [weak self] in
            self?.updatePlayPauseButton(isPlaying: true)
        }
        
        videoPlayer.onPause = { [weak self] in
            self?.updatePlayPauseButton(isPlaying: false)
        }
        
        // Time updates
        videoPlayer.onTimeUpdate = { [weak self] currentTime in
            self?.updateProgress(currentTime: currentTime)
        }
        
        // Buffering
        videoPlayer.onBuffering = { [weak self] isBuffering in
            self?.handleBuffering(isBuffering)
        }
        
        // Metadata loaded
        videoPlayer.onLoadedMetadata = { [weak self] metadata in
            self?.handleMetadataLoaded(metadata)
        }
        
        // Error handling
        videoPlayer.onError = { [weak self] error in
            self?.handleError(error)
        }
        
        // State changes
        videoPlayer.onStateChange = { [weak self] state in
            self?.handleStateChange(state)
        }
        
        // Video ended
        videoPlayer.onEnded = { [weak self] in
            self?.handleVideoEnded()
        }
    }
    
    // MARK: - Loading Content
    private func loadSampleVideo() {
        // Load the first sample video
        let videoUrl = sampleVideos[0]
        
        let source = MediaSource(url: videoUrl)
        videoPlayer.load(source: source)
    }
    
    // MARK: - Event Handlers
    private func handlePlayerReady() {
        DispatchQueue.main.async { [weak self] in
            self?.loadingIndicator.stopAnimating()
            self?.playPauseButton.isEnabled = true
        }
    }
    
    private func handleBuffering(_ isBuffering: Bool) {
        DispatchQueue.main.async { [weak self] in
            if isBuffering {
                self?.loadingIndicator.startAnimating()
            } else {
                self?.loadingIndicator.stopAnimating()
            }
        }
    }
    
    private func handleMetadataLoaded(_ metadata: [String: Any]) {
        print("Video metadata loaded: \(metadata)")
        
        DispatchQueue.main.async { [weak self] in
            if let duration = metadata["duration"] as? Double {
                self?.progressSlider.maximumValue = Float(duration)
                self?.durationLabel.text = self?.formatTime(duration) ?? "00:00"
            }
            
            if let width = metadata["width"] as? CGFloat,
               let height = metadata["height"] as? CGFloat {
                print("Video resolution: \(width)x\(height)")
            }
        }
    }
    
    private func handleError(_ error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.loadingIndicator.stopAnimating()
            self?.errorLabel.isHidden = false
            self?.errorLabel.text = "Error: \(error.localizedDescription)"
            self?.playPauseButton.isEnabled = false
        }
    }
    
    private func handleStateChange(_ state: PlayerState) {
        print("Player state changed: \(state)")
    }
    
    private func handleVideoEnded() {
        DispatchQueue.main.async { [weak self] in
            self?.updatePlayPauseButton(isPlaying: false)
            self?.progressSlider.value = 0
            self?.currentTimeLabel.text = "00:00"
        }
    }
    
    // MARK: - UI Updates
    private func updatePlayPauseButton(isPlaying: Bool) {
        DispatchQueue.main.async { [weak self] in
            let title = isPlaying ? "Pause" : "Play"
            self?.playPauseButton.setTitle(title, for: .normal)
        }
    }
    
    private func updateProgress(currentTime: Double) {
        guard !isSliderTracking else { return }
        
        DispatchQueue.main.async { [weak self] in
            self?.progressSlider.value = Float(currentTime)
            self?.currentTimeLabel.text = self?.formatTime(currentTime) ?? "00:00"
        }
    }
    
    private func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
    
    // MARK: - IBActions
    @IBAction func playPauseButtonTapped(_ sender: UIButton) {
        videoPlayer.togglePlayPause()
    }
    
    @IBAction func progressSliderValueChanged(_ sender: UISlider) {
        videoPlayer.seek(to: Double(sender.value))
    }
    
    @IBAction func progressSliderTouchDown(_ sender: UISlider) {
        isSliderTracking = true
    }
    
    @IBAction func progressSliderTouchUp(_ sender: UISlider) {
        isSliderTracking = false
    }
    
    @IBAction func volumeSliderValueChanged(_ sender: UISlider) {
        videoPlayer.setVolume(sender.value)
    }
    
    @IBAction func muteButtonTapped(_ sender: UIButton) {
        videoPlayer.toggleMute()
        sender.setTitle(sender.title(for: .normal) == "Mute" ? "Unmute" : "Mute", for: .normal)
    }
    
    @IBAction func skipBackwardButtonTapped(_ sender: UIButton) {
        videoPlayer.seekBackward(seconds: 10)
    }
    
    @IBAction func skipForwardButtonTapped(_ sender: UIButton) {
        videoPlayer.seekForward(seconds: 10)
    }
    
    @IBAction func loadVideoButtonTapped(_ sender: UIButton) {
        // Show action sheet with video options
        let actionSheet = UIAlertController(title: "Select Video", message: nil, preferredStyle: .actionSheet)
        
        actionSheet.addAction(UIAlertAction(title: "MP4 Video", style: .default) { [weak self] _ in
            self?.videoPlayer.load(url: self?.sampleVideos[0] ?? "")
        })
        
        actionSheet.addAction(UIAlertAction(title: "HLS Stream", style: .default) { [weak self] _ in
            self?.videoPlayer.load(url: self?.sampleVideos[1] ?? "")
        })
        
        actionSheet.addAction(UIAlertAction(title: "Test Stream", style: .default) { [weak self] _ in
            self?.videoPlayer.load(url: self?.sampleVideos[2] ?? "")
        })
        
        actionSheet.addAction(UIAlertAction(title: "Custom URL", style: .default) { [weak self] _ in
            self?.showCustomURLDialog()
        })
        
        actionSheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        // iPad compatibility
        if let popover = actionSheet.popoverPresentationController {
            popover.sourceView = sender
            popover.sourceRect = sender.bounds
        }
        
        present(actionSheet, animated: true)
    }
    
    @IBAction func fullscreenButtonTapped(_ sender: UIButton) {
        // Present player in fullscreen
        videoPlayer.initializeWithViewController(viewController: self, configuration: nil)
    }
    
    // MARK: - Helper Methods
    private func showCustomURLDialog() {
        let alert = UIAlertController(title: "Enter Video URL", message: nil, preferredStyle: .alert)
        
        alert.addTextField { textField in
            textField.placeholder = "https://example.com/video.mp4"
            textField.keyboardType = .URL
        }
        
        alert.addAction(UIAlertAction(title: "Load", style: .default) { [weak self] _ in
            if let url = alert.textFields?.first?.text, !url.isEmpty {
                self?.videoPlayer.load(url: url)
            }
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        present(alert, animated: true)
    }
}

// MARK: - Extension for DRM Content (Advanced Usage)
extension ViewController {
    
    func loadDRMProtectedContent() {
        let drm = DRMConfiguration(
            type: "fairplay",
            licenseUrl: "https://license.server.com/fairplay"
        )
        drm.certificateUrl = "https://certificate.server.com/cert"
        
        let source = MediaSource(url: "https://example.com/protected-content.m3u8")
        source.drm = drm
        
        videoPlayer.load(source: source)
    }
    
    func loadVideoWithSubtitles() {
        let subtitle = SubtitleTrack(
            url: "https://example.com/subtitles-en.vtt",
            language: "en",
            label: "English"
        )
        
        let source = MediaSource(url: "https://example.com/video.mp4")
        source.subtitles = [subtitle]
        
        videoPlayer.load(source: source)
    }
}
