// Simple HTTP server for local development
// This server properly handles CORS and MIME types for video streaming

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const HOST = 'localhost';

// MIME type mappings
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.m3u8': 'application/x-mpegURL',
    '.ts': 'video/MP2T',
    '.mpd': 'application/dash+xml',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Parse URL
    const parsedUrl = url.parse(req.url);
    
    // Extract pathname
    let pathname = `.${parsedUrl.pathname}`;
    
    // Default to index.html for root
    if (pathname === './') {
        pathname = './apps/demo/demo.html';
    }
    
    // Resolve full path
    const filePath = path.resolve(pathname);
    
    // Security check - ensure we're not serving files outside the project directory
    const projectDir = path.resolve('./');
    if (!filePath.startsWith(projectDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }
    
    // Check if file exists
    fs.exists(filePath, (exist) => {
        if (!exist) {
            // File not found
            res.statusCode = 404;
            res.end(`File ${pathname} not found!`);
            return;
        }

        // If directory, try to serve index.html
        if (fs.statSync(filePath).isDirectory()) {
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
                serveFile(indexPath, res);
            } else {
                res.statusCode = 403;
                res.end('Directory listing not allowed');
            }
            return;
        }

        // Serve the file
        serveFile(filePath, res);
    });
});

function serveFile(filePath, res) {
    // Read file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 500;
            res.end(`Error getting the file: ${err}.`);
        } else {
            // Set proper headers
            const ext = path.parse(filePath).ext;
            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            
            // Add CORS headers for development
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
            
            // Set content type
            res.setHeader('Content-Type', mimeType);
            
            // Enable byte-range requests for video streaming
            if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
                res.setHeader('Accept-Ranges', 'bytes');
            }
            
            // Send the file
            res.statusCode = 200;
            res.end(data);
        }
    });
}

server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     Unified Video Framework - Development Server      ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

Server running at: http://${HOST}:${PORT}
Demo page: http://${HOST}:${PORT}/apps/demo/demo.html

Press Ctrl+C to stop the server
`);
});
