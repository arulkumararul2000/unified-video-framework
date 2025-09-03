# How to Run the Unified Video Framework Locally

Due to browser security policies (CORS), you need to run a local web server to properly test all features of the video framework, especially streaming formats like HLS and DASH.

## Quick Start Options

### Option 1: Using Node.js (Recommended)

If you have Node.js installed:

```bash
# Navigate to the project directory
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"

# Run the Node.js server
node server.js
```

Then open your browser and go to: **http://localhost:3000**

### Option 2: Using Python 3

If you have Python 3 installed:

```bash
# Navigate to the project directory
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"

# Run the Python server
python server.py
# or
python3 server.py
```

Then open your browser and go to: **http://localhost:3000**

### Option 3: Using Python's Built-in Server (Simple)

For a quick test with Python:

```bash
# Navigate to the project directory
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"

# Python 3
python -m http.server 3000

# Python 2 (if that's what you have)
python -m SimpleHTTPServer 3000
```

Then open: **http://localhost:3000/apps/demo/demo.html**

### Option 4: Using Live Server Extension (VS Code)

If you're using Visual Studio Code:

1. Install the "Live Server" extension by Ritwick Dey
2. Right-click on `apps/demo/demo.html`
3. Select "Open with Live Server"

### Option 5: Using npm's http-server

If you have npm installed globally:

```bash
# Install http-server globally (one time only)
npm install -g http-server

# Navigate to the project directory
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"

# Run the server
http-server -p 3000 --cors
```

Then open: **http://localhost:3000/apps/demo/demo.html**

## Why a Web Server is Required

### ❌ What Doesn't Work with file:// Protocol:
- **CORS restrictions**: External libraries (HLS.js, dash.js) may not load
- **Module imports**: ES6 modules won't work
- **Streaming protocols**: HLS and DASH streams won't play
- **Fetch requests**: Can't load external resources
- **Security features**: Some browser APIs are restricted

### ✅ What Works with a Proper Web Server:
- All video formats (MP4, HLS, DASH)
- Dynamic library loading
- Full CORS support
- Proper MIME types for streaming
- All browser features enabled

## Testing the Demo

Once your server is running:

1. **Open the demo**: Go to http://localhost:3000
2. **Test basic playback**: Click on any MP4 sample video
3. **Test streaming**: Try HLS or DASH samples
4. **Toggle modes**: Switch between Enhanced and Native modes
5. **Test features**: Try quality selection, PiP, fullscreen, etc.

## Browser Compatibility

For best results, use modern browsers:
- **Chrome/Edge**: Full support for all features
- **Firefox**: Full support for all features
- **Safari**: Native HLS support, full feature set
- **Opera**: Full support for all features

## Troubleshooting

### Port Already in Use
If port 3000 is busy, you can change it:
- In `server.js` or `server.py`, change `PORT = 3000` to another number
- Use `http-server -p 8080` for a different port

### CORS Errors
If you see CORS errors:
- Make sure you're using one of the server methods above
- Don't open the HTML file directly (file:// protocol)
- Check that the server is running properly

### Videos Not Playing
- Check browser console for errors (F12)
- Ensure Enhanced Mode is ON for HLS/DASH content
- Try a different browser
- Check your internet connection for streaming samples

## Development Tips

1. **Keep the server running** while developing
2. **Use browser DevTools** (F12) to debug
3. **Check the Console** for error messages
4. **Test in multiple browsers** for compatibility
5. **Use Enhanced Mode** for full streaming support

## Production Deployment

For production, you would typically:
- Serve files from a proper web server (Apache, Nginx, IIS)
- Use a CDN for video content
- Implement proper authentication if needed
- Set up HTTPS for security
- Configure proper CORS policies

---

Need help? Check the main README.md or open an issue on the project repository.
