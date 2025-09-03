' UnifiedVideoPlayer Component for Roku
' Implements the core video player functionality

sub init()
    m.video = m.top.findNode("videoPlayer")
    m.loadingIndicator = m.top.findNode("loadingIndicator")
    m.errorDialog = m.top.findNode("errorDialog")
    
    ' Initialize player state
    m.state = {
        isPlaying: false,
        isPaused: true,
        isBuffering: false,
        isEnded: false,
        isError: false,
        currentTime: 0,
        duration: 0,
        bufferedPercentage: 0,
        volume: 100,
        isMuted: false,
        playbackRate: 1.0,
        currentQualityIndex: -1,
        availableQualities: []
    }
    
    ' Setup video event observers
    setupVideoObservers()
    
    ' Initialize analytics
    m.analytics = CreateObject("roSGNode", "TrackerTask")
end sub

sub setupVideoObservers()
    ' Video player state observers
    m.video.observeField("state", "onVideoStateChange")
    m.video.observeField("position", "onPositionChange")
    m.video.observeField("duration", "onDurationChange")
    m.video.observeField("bufferingStatus", "onBufferingChange")
    m.video.observeField("errorMsg", "onVideoError")
    m.video.observeField("streamInfo", "onStreamInfoChange")
    m.video.observeField("availableAudioTracks", "onAudioTracksChange")
    m.video.observeField("availableSubtitleTracks", "onSubtitleTracksChange")
    
    ' Control observers
    m.top.observeField("control", "onControlChange")
    m.top.observeField("seek", "onSeekChange")
    m.top.observeField("volume", "onVolumeChange")
end sub

' Load video content
sub loadContent(contentNode as Object)
    if contentNode = invalid then
        showError("Invalid content")
        return
    end if
    
    ' Create content node if string URL provided
    if type(contentNode) = "roString" then
        content = CreateObject("roSGNode", "ContentNode")
        content.url = contentNode
        content.streamFormat = detectStreamFormat(contentNode)
    else
        content = contentNode
    end if
    
    ' Handle DRM if present
    if content.drmParams <> invalid then
        configureDRM(content)
    end if
    
    ' Handle subtitles
    if content.subtitleConfig <> invalid then
        configureSubtitles(content)
    end if
    
    ' Set content to video player
    m.video.content = content
    
    ' Update state
    m.top.state = "loading"
    m.loadingIndicator.visible = true
    
    ' Log analytics event
    trackEvent("video_load", {url: content.url})
end sub

' Detect stream format from URL
function detectStreamFormat(url as String) as String
    if instr(url, ".m3u8") > 0 then
        return "hls"
    else if instr(url, ".mpd") > 0 then
        return "dash"
    else if instr(url, ".ism") > 0 then
        return "ism"
    else
        return "mp4"
    end if
end function

' Configure DRM
sub configureDRM(content as Object)
    drmParams = content.drmParams
    
    if drmParams.type = "widevine" then
        ' Widevine configuration
        content.drmLicenseUrl = drmParams.licenseUrl
        content.drmKeySystem = "widevine"
        
        if drmParams.headers <> invalid then
            content.httpHeaders = drmParams.headers
        end if
    else if drmParams.type = "playready" then
        ' PlayReady configuration
        content.drmLicenseUrl = drmParams.licenseUrl
        content.drmKeySystem = "playready"
    end if
end sub

' Configure subtitles
sub configureSubtitles(content as Object)
    subtitleConfig = content.subtitleConfig
    
    if subtitleConfig <> invalid and subtitleConfig.Count() > 0 then
        subtitleTracks = []
        
        for each subtitle in subtitleConfig
            track = {
                url: subtitle.url,
                language: subtitle.language,
                name: subtitle.label
            }
            subtitleTracks.push(track)
        end for
        
        content.subtitleTracks = subtitleTracks
    end if
end sub

' Handle video state changes
sub onVideoStateChange()
    state = m.video.state
    
    if state = "playing" then
        m.state.isPlaying = true
        m.state.isPaused = false
        m.loadingIndicator.visible = false
        m.top.state = "playing"
        trackEvent("video_play")
        
    else if state = "paused" then
        m.state.isPlaying = false
        m.state.isPaused = true
        m.top.state = "paused"
        trackEvent("video_pause")
        
    else if state = "buffering" then
        m.state.isBuffering = true
        m.loadingIndicator.visible = true
        m.top.state = "buffering"
        
    else if state = "finished" then
        m.state.isEnded = true
        m.state.isPlaying = false
        m.top.state = "ended"
        trackEvent("video_complete")
        
    else if state = "error" then
        m.state.isError = true
        m.state.isPlaying = false
        handleError()
    end if
end sub

' Handle position changes
sub onPositionChange()
    m.state.currentTime = m.video.position
    m.top.currentTime = m.video.position
    
    ' Calculate buffered percentage
    if m.video.duration > 0 then
        m.state.bufferedPercentage = (m.video.bufferingStatus.percentage / 100.0)
        m.top.bufferedPercentage = m.state.bufferedPercentage
    end if
end sub

' Handle duration change
sub onDurationChange()
    m.state.duration = m.video.duration
    m.top.duration = m.video.duration
end sub

' Handle buffering changes
sub onBufferingChange()
    bufferingStatus = m.video.bufferingStatus
    
    if bufferingStatus <> invalid then
        m.state.isBuffering = bufferingStatus.percentage < 100
        m.top.isBuffering = m.state.isBuffering
        
        if m.state.isBuffering then
            m.loadingIndicator.visible = true
        else
            m.loadingIndicator.visible = false
        end if
    end if
end sub

' Handle stream info changes (for quality detection)
sub onStreamInfoChange()
    streamInfo = m.video.streamInfo
    
    if streamInfo <> invalid then
        ' Extract quality information
        qualities = []
        
        if streamInfo.streamBitrate <> invalid then
            ' For HLS/DASH adaptive streaming
            for each variant in streamInfo.variants
                quality = {
                    height: variant.height,
                    width: variant.width,
                    bitrate: variant.bitrate,
                    label: variant.height.ToStr() + "p",
                    index: qualities.Count()
                }
                qualities.push(quality)
            end for
        else
            ' Single quality stream
            quality = {
                height: streamInfo.videoHeight,
                width: streamInfo.videoWidth,
                bitrate: streamInfo.measuredBitrate,
                label: streamInfo.videoHeight.ToStr() + "p",
                index: 0
            }
            qualities.push(quality)
        end if
        
        m.state.availableQualities = qualities
        m.top.availableQualities = qualities
    end if
end sub

' Playback control methods
sub play()
    m.video.control = "play"
    m.state.isPlaying = true
    m.state.isPaused = false
end sub

sub pause()
    m.video.control = "pause"
    m.state.isPlaying = false
    m.state.isPaused = true
end sub

sub stop()
    m.video.control = "stop"
    m.state.isPlaying = false
    m.state.isPaused = true
    m.state.currentTime = 0
end sub

sub seek(position as Float)
    m.video.seek = position
    trackEvent("video_seek", {position: position})
end sub

' Volume control
sub setVolume(level as Float)
    ' Roku doesn't support direct volume control
    ' This would typically control the audio track volume
    m.state.volume = level * 100
    m.top.volume = m.state.volume
end sub

sub mute()
    m.video.mute = true
    m.state.isMuted = true
end sub

sub unmute()
    m.video.mute = false
    m.state.isMuted = false
end sub

' Quality selection
sub setQuality(index as Integer)
    if index >= 0 and index < m.state.availableQualities.Count() then
        ' For adaptive streaming, this would set max bitrate
        quality = m.state.availableQualities[index]
        
        ' Set preferred bitrate for adaptive streaming
        m.video.maxVideoBitrate = quality.bitrate
        m.state.currentQualityIndex = index
        
        trackEvent("quality_change", {
            height: quality.height,
            bitrate: quality.bitrate
        })
    end if
end sub

' Enable/disable adaptive bitrate
sub setAdaptiveBitrate(enabled as Boolean)
    if enabled then
        m.video.enableAdaptiveBitrate = true
        m.video.maxVideoBitrate = 0 ' No limit
    else
        m.video.enableAdaptiveBitrate = false
    end if
end sub

' Subtitle control
sub setSubtitleTrack(index as Integer)
    if m.video.availableSubtitleTracks <> invalid then
        if index >= 0 and index < m.video.availableSubtitleTracks.Count() then
            m.video.subtitleTrack = index
        end if
    end if
end sub

sub disableSubtitles()
    m.video.subtitleTrack = -1
end sub

' Audio track selection
sub setAudioTrack(index as Integer)
    if m.video.availableAudioTracks <> invalid then
        if index >= 0 and index < m.video.availableAudioTracks.Count() then
            m.video.audioTrack = index
        end if
    end if
end sub

' Error handling
sub onVideoError()
    errorMsg = m.video.errorMsg
    errorCode = m.video.errorCode
    
    m.state.isError = true
    m.state.isPlaying = false
    m.loadingIndicator.visible = false
    
    showError(errorMsg, errorCode)
    
    trackEvent("video_error", {
        code: errorCode,
        message: errorMsg
    })
end sub

sub handleError()
    errorInfo = m.video.errorInfo
    if errorInfo <> invalid then
        showError(errorInfo.message, errorInfo.code)
    else
        showError("An unknown error occurred")
    end if
end sub

sub showError(message as String, code = 0 as Dynamic)
    m.errorDialog.title = "Playback Error"
    m.errorDialog.message = message
    if code <> invalid then
        m.errorDialog.message = m.errorDialog.message + " (Code: " + code.ToStr() + ")"
    end if
    m.errorDialog.visible = true
end sub

' Analytics tracking
sub trackEvent(eventName as String, params = {} as Object)
    if m.analytics <> invalid then
        m.analytics.trackEvent = {
            event: eventName,
            params: params,
            timestamp: CreateObject("roDateTime").AsSeconds()
        }
    end if
end sub

' Get current player state
function getState() as Object
    return m.state
end function

' Clean up
sub destroy()
    m.video.control = "stop"
    m.video.content = invalid
    
    ' Remove observers
    m.video.unobserveField("state")
    m.video.unobserveField("position")
    m.video.unobserveField("duration")
    m.video.unobserveField("bufferingStatus")
    m.video.unobserveField("errorMsg")
    m.video.unobserveField("streamInfo")
end sub
