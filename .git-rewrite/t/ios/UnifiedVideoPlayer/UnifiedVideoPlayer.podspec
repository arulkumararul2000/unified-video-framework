Pod::Spec.new do |s|
  s.name             = 'UnifiedVideoPlayer'
  s.version          = '0.1.0'
  s.summary          = 'Unified video player SDK for iOS (HLS, FairPlay DRM, PiP, AirPlay, Remote Command Center).'
  s.description      = <<-DESC
A unified, embeddable iOS video player SDK powered by AVPlayer.
Features:
- HLS playback with robust event API
- Subtitles/audio track selection
- Picture-in-Picture and AirPlay support
- FairPlay DRM (SPC/CKC) integration hooks
- Remote Command Center & Now Playing
- Background audio
DESC
  s.homepage         = 'https://github.com/your-org/unified-video-framework'
  s.license          = { :type => 'MIT' }
  s.author           = { 'Your Company' => 'support@example.com' }
  s.source           = { :git => 'https://github.com/your-org/unified-video-framework-ios.git', :tag => s.version.to_s }
  s.platform         = :ios, '12.0'
  s.swift_version    = '5.8'

  # This podspec lives next to the Sources directory
  s.source_files = 'Sources/**/*.{swift,h,m}'

  s.frameworks = 'AVFoundation', 'AVKit', 'MediaPlayer'
  s.requires_arc = true

  s.pod_target_xcconfig = {
    'OTHER_SWIFT_FLAGS' => '$(inherited) -DUNIFIED_VIDEO_PLAYER',
    'SWIFT_OPTIMIZATION_LEVEL' => '$(inherited)'
  }
end

