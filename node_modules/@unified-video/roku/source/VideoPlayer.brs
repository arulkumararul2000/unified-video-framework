' ********************************************************
' ** Unified Video Framework - Roku Implementation
' ** VideoPlayer.brs - Main video player component
' ********************************************************

' Initialize the video player component
Function VideoPlayer_Init() as Object
    this = {
        ' Component properties
        videoContent: CreateObject("roSGNode", "ContentNode")
        video: invalid
        state: "idle"
        config: {}
        
        ' Public methods
        Load: VideoPlayer_Load
        Play: VideoPlayer_Play
        Pause: VideoPlayer_Pause
        Stop: VideoPlayer_Stop
        Seek: VideoPlayer_Seek
        SetVolume: VideoPlayer_SetVolume
        GetCurrentTime: VideoPlayer_GetCurrentTime
        GetDuration: VideoPlayer_GetDuration
        GetState: VideoPlayer_GetState
        Destroy: VideoPlayer_Destroy
        
        ' Event handling
        SetEventCallback: VideoPlayer_SetEventCallback
        eventCallback: invalid
    }
    
    ' Create the video node
    this.video = CreateObject("roSGNode", "Video")
    this.video.observeField("state", "OnVideoStateChange")
    this.video.observeField("position", "OnPositionChange")
    this.video.observeField("duration", "OnDurationChange")
    
    return this
End Function

' Load a video source
Function VideoPlayer_Load(source as Object) as Void
    m.videoContent.url = source.url
    m.videoContent.title = source.title
    
    ' Set streaming format
    if source.type = "application/x-mpegURL" then
        m.videoContent.streamFormat = "hls"
    else if source.type = "application/dash+xml" then
        m.videoContent.streamFormat = "dash"
    else
        m.videoContent.streamFormat = "mp4"
    end if
    
    ' Handle DRM if present
    if source.drm <> invalid then
        VideoPlayer_SetupDRM(source.drm)
    end if
    
    ' Set subtitles if present
    if source.subtitles <> invalid then
        VideoPlayer_SetupSubtitles(source.subtitles)
    end if
    
    m.video.content = m.videoContent
    m.state = "loaded"
    
    ' Trigger ready event
    if m.eventCallback <> invalid then
        m.eventCallback("ready", {})
    end if
End Function

' Start playback
Function VideoPlayer_Play() as Void
    if m.state = "loaded" or m.state = "paused" then
        m.video.control = "play"
        m.state = "playing"
        
        if m.eventCallback <> invalid then
            m.eventCallback("play", {})
        end if
    end if
End Function

' Pause playback
Function VideoPlayer_Pause() as Void
    if m.state = "playing" then
        m.video.control = "pause"
        m.state = "paused"
        
        if m.eventCallback <> invalid then
            m.eventCallback("pause", {})
        end if
    end if
End Function

' Stop playback
Function VideoPlayer_Stop() as Void
    m.video.control = "stop"
    m.state = "stopped"
    
    if m.eventCallback <> invalid then
        m.eventCallback("stop", {})
    end if
End Function

' Seek to position (in seconds)
Function VideoPlayer_Seek(position as Float) as Void
    m.video.seek = position
    
    if m.eventCallback <> invalid then
        m.eventCallback("seeking", {position: position})
    end if
End Function

' Set volume (0.0 to 1.0)
Function VideoPlayer_SetVolume(volume as Float) as Void
    ' Roku doesn't have direct volume control from apps
    ' This would typically be handled by the system
    print "Volume control is handled by system"
End Function

' Get current playback position in seconds
Function VideoPlayer_GetCurrentTime() as Float
    return m.video.position
End Function

' Get video duration in seconds
Function VideoPlayer_GetDuration() as Float
    return m.video.duration
End Function

' Get current player state
Function VideoPlayer_GetState() as String
    return m.state
End Function

' Clean up resources
Function VideoPlayer_Destroy() as Void
    m.video.control = "stop"
    m.video = invalid
    m.videoContent = invalid
    m.state = "idle"
End Function

' Set event callback function
Function VideoPlayer_SetEventCallback(callback as Function) as Void
    m.eventCallback = callback
End Function

' Setup DRM configuration
Function VideoPlayer_SetupDRM(drm as Object) as Void
    if drm.type = "playready" then
        m.videoContent.drmParams = {
            licenseServerURL: drm.licenseUrl
            serializationURL: drm.certificateUrl
        }
    else if drm.type = "widevine" then
        m.videoContent.drmParams = {
            keySystem: "Widevine"
            licenseServerURL: drm.licenseUrl
        }
    end if
End Function

' Setup subtitles
Function VideoPlayer_SetupSubtitles(subtitles as Object) as Void
    subtitleTracks = []
    
    for each subtitle in subtitles
        track = {
            url: subtitle.url
            language: subtitle.language
            name: subtitle.label
        }
        subtitleTracks.push(track)
    end for
    
    m.videoContent.subtitleTracks = subtitleTracks
End Function

' Handle video state changes
Sub OnVideoStateChange()
    state = m.video.state
    
    if state = "playing" then
        m.state = "playing"
        if m.eventCallback <> invalid then
            m.eventCallback("playing", {})
        end if
    else if state = "paused" then
        m.state = "paused"
    else if state = "buffering" then
        if m.eventCallback <> invalid then
            m.eventCallback("buffering", {})
        end if
    else if state = "error" then
        m.state = "error"
        if m.eventCallback <> invalid then
            m.eventCallback("error", {
                code: m.video.errorCode
                message: m.video.errorMsg
            })
        end if
    else if state = "finished" then
        m.state = "ended"
        if m.eventCallback <> invalid then
            m.eventCallback("ended", {})
        end if
    end if
End Sub

' Handle position changes
Sub OnPositionChange()
    if m.eventCallback <> invalid then
        m.eventCallback("timeupdate", {
            currentTime: m.video.position
            duration: m.video.duration
        })
    end if
End Sub

' Handle duration changes
Sub OnDurationChange()
    if m.eventCallback <> invalid then
        m.eventCallback("durationchange", {
            duration: m.video.duration
        })
    end if
End Sub
