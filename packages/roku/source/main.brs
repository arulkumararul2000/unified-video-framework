' Main entry point for Roku Unified Video Player
sub Main(args as Dynamic)
    ' Initialize the screen
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)
    
    ' Create the main scene
    scene = screen.CreateScene("MainScene")
    screen.show()
    
    ' Pass launch arguments to scene
    if args <> invalid and args.contentId <> invalid then
        scene.launchArgs = args
    end if
    
    ' Main event loop
    while true
        msg = wait(0, m.port)
        msgType = type(msg)
        
        if msgType = "roSGScreenEvent" then
            if msg.isScreenClosed() then
                return
            end if
        end if
    end while
end sub
