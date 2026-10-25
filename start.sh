#!/usr/bin/env bash
# ==============================================================================
# Lexicon Intelligent Library Manager - Auto Launcher
# Starts the local server (if not already running) and opens your browser.
# ==============================================================================
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

PORT="${PORT:-8000}"
URL="http://localhost:$PORT"
LOG_FILE="${LEXICON_LOG:-${TMPDIR:-/tmp}/lexicon-server-$PORT.log}"

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 is required to run the Lexicon server." >&2
    exit 1
fi

is_lexicon_running() {
    # The server identifies itself in the Server header ("LexiconServer").
    python3 - "$PORT" <<'PY' >/dev/null 2>&1
import sys, urllib.request
try:
    with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/index.html", timeout=1.5) as r:
        sys.exit(0 if "LexiconServer" in (r.headers.get("Server") or "") else 1)
except Exception:
    sys.exit(1)
PY
}

port_in_use() {
    python3 - "$PORT" <<'PY' >/dev/null 2>&1
import socket, sys
s = socket.socket()
s.settimeout(0.5)
sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)
PY
}

if is_lexicon_running; then
    echo "Lexicon server already running on $URL"
elif port_in_use; then
    echo "ERROR: port $PORT is already used by another program." >&2
    echo "       Stop it or start Lexicon on another port:  PORT=8080 ./start.sh" >&2
    exit 1
else
    echo "Starting Lexicon local server with Ollama proxy on $URL (log: $LOG_FILE)..."
    if command -v setsid >/dev/null 2>&1; then
        setsid python3 server.py </dev/null >>"$LOG_FILE" 2>&1 &
    else
        nohup python3 server.py </dev/null >>"$LOG_FILE" 2>&1 &
    fi
    disown 2>/dev/null || true

    # Wait (up to ~10 s) until the server answers
    for _ in $(seq 1 40); do
        if is_lexicon_running; then break; fi
        sleep 0.25
    done
    if ! is_lexicon_running; then
        echo "ERROR: the server did not start. Last log lines:" >&2
        tail -n 20 "$LOG_FILE" >&2 2>/dev/null || true
        exit 1
    fi
fi

echo "Opening $URL in browser..."
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
elif command -v sensible-browser >/dev/null 2>&1; then
    sensible-browser "$URL" >/dev/null 2>&1 &
else
    python3 -m webbrowser "$URL" >/dev/null 2>&1 &
fi

echo "Lexicon is ready!"
