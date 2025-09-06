//
//  ContentView.swift
//  UnifiedVideoPlayer SwiftUI Sample App
//
//  Example of using UnifiedVideoPlayer with SwiftUI
//

import SwiftUI
import UnifiedVideoPlayer

struct ContentView: View {
    @StateObject private var playerModel = UnifiedVideoPlayerModel(
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    )
    
    @State private var selectedVideoIndex = 0
    @State private var showVideoSelection = false
    @State private var customURL = ""
    @State private var showCustomURLAlert = false
    
    let sampleVideos = [
        ("Big Buck Bunny", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"),
        ("HLS Stream", "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8"),
        ("Test Stream", "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")
    ]
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Video Player
                CustomUnifiedVideoPlayer(
                    url: sampleVideos[selectedVideoIndex].1,
                    configuration: PlayerConfiguration(dictionary: [
                        "autoPlay": false,
                        "controls": true,
                        "debug": true
                    ])
                )
                .aspectRatio(16/9, contentMode: .fit)
                .background(Color.black)
                
                // Controls Section
                ScrollView {
                    VStack(spacing: 20) {
                        // Video Selection
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Select Video")
                                .font(.headline)
                            
                            ForEach(0..<sampleVideos.count, id: \.self) { index in
                                Button(action: {
                                    selectedVideoIndex = index
                                    loadVideo(url: sampleVideos[index].1)
                                }) {
                                    HStack {
                                        Image(systemName: selectedVideoIndex == index ? "checkmark.circle.fill" : "circle")
                                        Text(sampleVideos[index].0)
                                        Spacer()
                                    }
                                    .foregroundColor(selectedVideoIndex == index ? .blue : .primary)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                            
                            Button("Load Custom URL") {
                                showCustomURLAlert = true
                            }
                            .foregroundColor(.blue)
                        }
                        .padding()
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(10)
                        
                        // Player Info
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Player Information")
                                .font(.headline)
                            
                            InfoRow(label: "State", value: playerStateText)
                            InfoRow(label: "Duration", value: formatTime(playerModel.duration))
                            InfoRow(label: "Current Time", value: formatTime(playerModel.currentTime))
                            InfoRow(label: "Volume", value: String(format: "%.0f%%", playerModel.volume * 100))
                            InfoRow(label: "Quality", value: playerModel.currentVideoQuality)
                            
                            if let error = playerModel.error {
                                InfoRow(label: "Error", value: error.localizedDescription)
                                    .foregroundColor(.red)
                            }
                        }
                        .padding()
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(10)
                        
                        // Advanced Features
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Advanced Features")
                                .font(.headline)
                            
                            Button("Load DRM Content") {
                                loadDRMContent()
                            }
                            
                            Button("Load with Subtitles") {
                                loadVideoWithSubtitles()
                            }
                        }
                        .padding()
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(10)
                    }
                    .padding()
                }
            }
            .navigationTitle("SwiftUI Video Player")
            .navigationBarTitleDisplayMode(.inline)
        }
        .alert("Enter Video URL", isPresented: $showCustomURLAlert) {
            TextField("https://example.com/video.mp4", text: $customURL)
            Button("Cancel", role: .cancel) { }
            Button("Load") {
                if !customURL.isEmpty {
                    loadVideo(url: customURL)
                }
            }
        }
    }
    
    private var playerStateText: String {
        if playerModel.isPlaying {
            return "Playing"
        } else if playerModel.isBuffering {
            return "Buffering..."
        } else {
            return "Paused"
        }
    }
    
    private func loadVideo(url: String) {
        let source = MediaSource(url: url)
        // Note: In a real implementation, you'd reinitialize the player with the new source
        // This is simplified for demonstration
    }
    
    private func loadDRMContent() {
        let drm = DRMConfiguration(
            type: "fairplay",
            licenseUrl: "https://license.server.com/fairplay"
        )
        drm.certificateUrl = "https://certificate.server.com/cert"
        
        let source = MediaSource(url: "https://example.com/protected-content.m3u8")
        source.drm = drm
        
        // Load the DRM protected content
        // playerModel would need to be reinitialized with this source
    }
    
    private func loadVideoWithSubtitles() {
        let subtitle = SubtitleTrack(
            url: "https://example.com/subtitles-en.vtt",
            language: "en",
            label: "English"
        )
        
        let source = MediaSource(url: "https://example.com/video.mp4")
        source.subtitles = [subtitle]
        
        // Load video with subtitles
        // playerModel would need to be reinitialized with this source
    }
    
    private func formatTime(_ time: Double) -> String {
        guard !time.isNaN && !time.isInfinite else { return "00:00" }
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label + ":")
                .fontWeight(.medium)
            Spacer()
            Text(value)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Alternative Full-Screen Player View
struct FullScreenPlayerView: View {
    @Environment(\.presentationMode) var presentationMode
    let videoURL: String
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            CustomUnifiedVideoPlayer(
                url: videoURL,
                configuration: PlayerConfiguration(dictionary: [
                    "autoPlay": true,
                    "controls": true
                ])
            )
            
            // Close button
            VStack {
                HStack {
                    Spacer()
                    Button(action: {
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title)
                            .foregroundColor(.white)
                            .background(Color.black.opacity(0.5))
                            .clipShape(Circle())
                    }
                    .padding()
                }
                Spacer()
            }
        }
    }
}

// MARK: - List View with Multiple Videos
struct VideoListView: View {
    let videos = [
        VideoItem(title: "Big Buck Bunny", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", thumbnail: "thumbnail1"),
        VideoItem(title: "Elephant Dream", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", thumbnail: "thumbnail2"),
        VideoItem(title: "For Bigger Blazes", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", thumbnail: "thumbnail3")
    ]
    
    @State private var selectedVideo: VideoItem?
    
    var body: some View {
        NavigationView {
            List(videos) { video in
                VideoRow(video: video) {
                    selectedVideo = video
                }
            }
            .navigationTitle("Video Library")
            .sheet(item: $selectedVideo) { video in
                FullScreenPlayerView(videoURL: video.url)
            }
        }
    }
}

struct VideoItem: Identifiable {
    let id = UUID()
    let title: String
    let url: String
    let thumbnail: String
}

struct VideoRow: View {
    let video: VideoItem
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                // Thumbnail placeholder
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 120, height: 67.5)
                    .overlay(
                        Image(systemName: "play.circle.fill")
                            .font(.title)
                            .foregroundColor(.white)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(video.title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text("Tap to play")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Preview
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
