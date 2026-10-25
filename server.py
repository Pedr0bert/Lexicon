#!/usr/bin/env python3
"""
Lexicon Local Server with a restricted Ollama proxy.
Zero dependencies (Python standard library only).

- Serves the static frontend (only an allow-listed set of paths; never .git,
  logs or server sources).
- Proxies a small allow-list of Ollama endpoints under /ollama/api/* and
  /api/* to the local Ollama instance.
- Binds to 127.0.0.1 by default and only accepts proxy requests coming from
  the app's own origin, so other websites and LAN devices cannot drive Ollama.

Environment variables:
  PORT           (default 8000)
  LEXICON_HOST   (default 127.0.0.1; set to 0.0.0.0 ONLY if you understand the risk)
  OLLAMA_TARGET  (default http://127.0.0.1:11434)
  OLLAMA_TIMEOUT (seconds, default 600)
"""
import http.server
import json
import os
import socket
import socketserver
import sys
import urllib.error
import urllib.parse
import urllib.request

PORT = int(os.environ.get('PORT', 8000))
HOST = os.environ.get('LEXICON_HOST', '127.0.0.1')
OLLAMA_TARGET = os.environ.get('OLLAMA_TARGET', 'http://127.0.0.1:11434').rstrip('/')
OLLAMA_TIMEOUT = float(os.environ.get('OLLAMA_TIMEOUT', 600))
MAX_BODY_BYTES = 8 * 1024 * 1024

# Only the Ollama endpoints the app actually uses (read-only / inference).
# Model management endpoints (pull, push, create, copy, delete) are NOT exposed.
PROXY_ALLOW = {
    'GET': {'/api/tags', '/api/version', '/api/ps'},
    'POST': {'/api/generate', '/api/chat', '/api/show', '/api/embeddings', '/api/embed'},
}

# Static files that may be served.
STATIC_ALLOW_PREFIXES = ('/css/', '/js/', '/assets/')
STATIC_ALLOW_FILES = {'/', '/index.html', '/favicon.ico'}

SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cross-Origin-Opener-Policy': 'same-origin',
}


def json_bytes(obj):
    return json.dumps(obj).encode('utf-8')


class ReusableThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class LexiconHTTPHandler(http.server.SimpleHTTPRequestHandler):
    server_version = 'LexiconServer'
    sys_version = ''

    # ------------------------------------------------------------------ utils
    def log_message(self, fmt, *args):
        sys.stderr.write("[lexicon] %s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        super().end_headers()

    def _allowed_origins(self):
        host_header = self.headers.get('Host', '')
        origins = {f'http://localhost:{PORT}', f'http://127.0.0.1:{PORT}', f'http://[::1]:{PORT}'}
        if host_header:
            origins.add(f'http://{host_header}')
        return origins

    def _origin_ok(self):
        """Reject cross-site requests. Same-origin fetches send either no Origin
        (GET) or our own origin; Sec-Fetch-Site gives a second signal."""
        origin = self.headers.get('Origin')
        if origin and origin not in self._allowed_origins():
            return False
        fetch_site = self.headers.get('Sec-Fetch-Site')
        if fetch_site and fetch_site not in ('same-origin', 'none'):
            return False
        return True

    def _send_json(self, code, payload):
        body = json_bytes(payload)
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    @staticmethod
    def _proxy_path(raw_path):
        """Map /ollama/api/x or /api/x to /api/x; return None if not a proxy path."""
        path = urllib.parse.urlsplit(raw_path).path
        if path.startswith('/ollama/'):
            path = path[len('/ollama'):]
        if path.startswith('/api/'):
            # Normalise and refuse traversal / odd encodings
            if '..' in path or '%' in path or '//' in path:
                return ''
            return path
        return None

    # --------------------------------------------------------------- methods
    def do_OPTIONS(self):
        # Same-origin app never needs CORS preflight; refuse cross-origin preflights.
        self.send_response(204 if self._origin_ok() else 403)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_HEAD(self):
        if self._proxy_path(self.path) is not None:
            self._send_json(405, {'error': 'Method not allowed'})
            return
        if not self._static_allowed():
            self.send_error(404, 'File not found')
            return
        super().do_HEAD()

    def do_GET(self):
        target = self._proxy_path(self.path)
        if target is not None:
            self._proxy('GET', target)
            return
        if not self._static_allowed():
            self.send_error(404, 'File not found')
            return
        super().do_GET()

    def do_POST(self):
        target = self._proxy_path(self.path)
        if target is not None:
            self._proxy('POST', target)
            return
        self.send_error(404, 'File not found')

    def do_PUT(self):
        self._send_json(405, {'error': 'Method not allowed'})

    def do_DELETE(self):
        self._send_json(405, {'error': 'Method not allowed'})

    def _static_allowed(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if '..' in path or '\x00' in path:
            return False
        # Hidden files/dirs (.git, .env, ...) are never served
        if any(part.startswith('.') for part in path.split('/') if part):
            return False
        if path in STATIC_ALLOW_FILES:
            return True
        return path.startswith(STATIC_ALLOW_PREFIXES)

    # ----------------------------------------------------------------- proxy
    def _proxy(self, method, target_path):
        if not target_path or target_path not in PROXY_ALLOW.get(method, set()):
            self._send_json(403, {'error': f'Endpoint not allowed by Lexicon proxy: {method} {target_path or self.path}'})
            return
        if not self._origin_ok():
            self._send_json(403, {'error': 'Cross-origin requests to the Lexicon proxy are not allowed.'})
            return

        post_data = None
        if method == 'POST':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
            except ValueError:
                self._send_json(400, {'error': 'Invalid Content-Length'})
                return
            if content_length > MAX_BODY_BYTES:
                self._send_json(413, {'error': 'Request body too large'})
                return
            post_data = self.rfile.read(content_length) if content_length > 0 else b''

        req_headers = {'Accept': self.headers.get('Accept', 'application/json')}
        if post_data is not None:
            req_headers['Content-Type'] = self.headers.get('Content-Type', 'application/json')

        target_url = OLLAMA_TARGET + target_path
        req = urllib.request.Request(target_url, data=post_data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
                self.send_response(resp.status)
                content_type = resp.headers.get('Content-Type', 'application/json')
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', 'no-store')
                streamed = 'ndjson' in content_type or resp.headers.get('Transfer-Encoding', '').lower() == 'chunked'
                if streamed:
                    # Stream through without buffering (connection closes at the end)
                    self.send_header('Connection', 'close')
                    self.end_headers()
                    while True:
                        chunk = resp.read(8192)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    self.close_connection = True
                else:
                    resp_data = resp.read()
                    self.send_header('Content-Length', str(len(resp_data)))
                    self.end_headers()
                    self.wfile.write(resp_data)
        except urllib.error.HTTPError as e:
            err_data = e.read() or json_bytes({'error': f'Ollama HTTP {e.code}'})
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json') if e.headers else 'application/json')
            self.send_header('Content-Length', str(len(err_data)))
            self.end_headers()
            self.wfile.write(err_data)
        except urllib.error.URLError as e:
            reason = e.reason
            if isinstance(reason, (socket.timeout, TimeoutError)):
                self._send_json(504, {'error': f'Ollama request timed out after {int(OLLAMA_TIMEOUT)}s'})
            elif isinstance(reason, ConnectionRefusedError):
                self._send_json(502, {'error': f'Ollama connection refused at {OLLAMA_TARGET}. Is "ollama serve" running?'})
            else:
                self._send_json(502, {'error': f'Failed to connect to local Ollama at {OLLAMA_TARGET}: {reason}'})
        except (socket.timeout, TimeoutError):
            self._send_json(504, {'error': f'Ollama request timed out after {int(OLLAMA_TIMEOUT)}s'})
        except (BrokenPipeError, ConnectionResetError):
            pass  # client went away (e.g. user aborted the generation)
        except Exception as e:  # pragma: no cover - defensive
            try:
                self._send_json(500, {'error': f'Internal proxy error: {e}'})
            except Exception:
                pass


LexiconHTTPHandler.extensions_map = dict(LexiconHTTPHandler.extensions_map)
LexiconHTTPHandler.extensions_map.update({
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
})


def main():
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    if HOST not in ('127.0.0.1', 'localhost', '::1'):
        print(f"WARNING: binding to {HOST} exposes Lexicon (and the Ollama proxy) to your network.", file=sys.stderr)
    try:
        httpd = ReusableThreadingServer((HOST, PORT), LexiconHTTPHandler)
    except OSError as e:
        print(f"ERROR: could not bind {HOST}:{PORT}: {e}", file=sys.stderr)
        sys.exit(1)
    with httpd:
        print(f"Lexicon server listening on http://localhost:{PORT}", flush=True)
        print(f"Ollama proxy active on http://localhost:{PORT}/ollama -> {OLLAMA_TARGET}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
