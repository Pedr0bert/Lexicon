#!/usr/bin/env python3
"""
Lexicon v3 Local Server with Transparent Ollama Proxy
Zero-dependencies (Python standard library only).
Serves static frontend and proxies /ollama/* and /api/* to local Ollama (port 11434)
eliminating all browser CORS and Private Network Access (PNA) restrictions.
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys
import socket

PORT = int(os.environ.get('PORT', 8000))
OLLAMA_TARGET = "http://127.0.0.1:11434"

class LexiconHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Universal CORS headers for local productivity
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/ollama/') or self.path.startswith('/api/'):
            self._proxy('GET')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/ollama/') or self.path.startswith('/api/'):
            self._proxy('POST')
        else:
            self.send_error(404, "File not found")

    def _proxy(self, method):
        target_path = self.path
        if target_path.startswith('/ollama'):
            target_path = target_path[len('/ollama'):]
        if not target_path.startswith('/'):
            target_path = '/' + target_path

        target_url = OLLAMA_TARGET + target_path

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else None

        req_headers = {}
        for k, v in self.headers.items():
            if k.lower() not in ['host', 'origin', 'referer', 'content-length']:
                req_headers[k] = v
        req_headers['Host'] = '127.0.0.1:11434'

        req = urllib.request.Request(target_url, data=post_data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    if k.lower() not in ['transfer-encoding', 'content-length', 'access-control-allow-origin']:
                        self.send_header(k, v)
                resp_data = resp.read()
                self.send_header('Content-Length', str(len(resp_data)))
                self.end_headers()
                self.wfile.write(resp_data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            err_data = e.read()
            self.send_header('Content-Length', str(len(err_data)))
            self.end_headers()
            self.wfile.write(err_data)
        except urllib.error.URLError as e:
            if isinstance(e.reason, socket.timeout) or isinstance(e.reason, TimeoutError):
                self.send_response(504)
                msg = f'{{"error": "Ollama request timed out after 120s: {str(e.reason)}"}}'.encode('utf-8')
            elif isinstance(e.reason, ConnectionRefusedError):
                self.send_response(502)
                msg = f'{{"error": "Ollama connection refused at {OLLAMA_TARGET}."}}'.encode('utf-8')
            else:
                self.send_response(502)
                msg = f'{{"error": "Failed to connect to local Ollama at {OLLAMA_TARGET}: {str(e.reason)}"}}'.encode('utf-8')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
        except TimeoutError as e:
            self.send_response(504)
            msg = f'{{"error": "Ollama request timed out after 120s: {str(e)}"}}'.encode('utf-8')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
        except Exception as e:
            self.send_response(500)
            msg = f'{{"error": "Internal proxy error: {str(e)}"}}'.encode('utf-8')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

if __name__ == '__main__':
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    with socketserver.ThreadingTCPServer(("", PORT), LexiconHTTPHandler) as httpd:
        print(f"Lexicon server listening on http://localhost:{PORT}")
        print(f"Ollama proxy active on http://localhost:{PORT}/ollama -> {OLLAMA_TARGET}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
