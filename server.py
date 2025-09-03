#!/usr/bin/env python3
"""
Simple HTTP server for local development of Unified Video Framework
Python 3 alternative to Node.js server
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

PORT = 3000
HOST = "localhost"

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS headers."""
    
    def end_headers(self):
        """Add CORS headers to all responses."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')
        
        # Add proper MIME types for video files
        if self.path.endswith('.m3u8'):
            self.send_header('Content-Type', 'application/x-mpegURL')
        elif self.path.endswith('.mpd'):
            self.send_header('Content-Type', 'application/dash+xml')
        elif self.path.endswith('.ts'):
            self.send_header('Content-Type', 'video/MP2T')
            
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight."""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        # Redirect root to demo page
        if self.path == '/':
            self.path = '/apps/demo/demo.html'
        
        # Log the request
        print(f"GET {self.path}")
        
        # Serve the file
        super().do_GET()

def run_server():
    """Start the development server."""
    try:
        # Change to the project directory
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        
        # Create server
        with socketserver.TCPServer((HOST, PORT), CORSRequestHandler) as httpd:
            print(f"""
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     Unified Video Framework - Development Server      ║
║                     (Python Version)                   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

Server running at: http://{HOST}:{PORT}
Demo page: http://{HOST}:{PORT}/apps/demo/demo.html

Press Ctrl+C to stop the server
""")
            # Start serving
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_server()
