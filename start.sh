#!/usr/bin/env bash
# ==============================================================================
# Lexicon Intelligent Library Manager - Auto Launcher
# Starts local server (if not running) and opens your browser automatically
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT="${PORT:-8000}"

START_SERVER=0
RUNNING_PID=$(lsof -ti :$PORT 2>/dev/null | head -n 1)
if [ -n "$RUNNING_PID" ]; then
    PROC_CWD=$(readlink -f "/proc/$RUNNING_PID/cwd" 2>/dev/null)
    if [ "$PROC_CWD" = "$DIR" ]; then
        echo "Lexicon server already running for $DIR on http://localhost:$PORT (PID $RUNNING_PID)"
    else
        echo "Found different server (PID $RUNNING_PID at $PROC_CWD) on port $PORT. Restarting with current version..."
        kill -9 "$RUNNING_PID" 2>/dev/null || true
        sleep 0.5
        START_SERVER=1
    fi
else
    START_SERVER=1
fi

if [ "$START_SERVER" -eq 1 ]; then
    echo "Starting Lexicon local server with Ollama proxy on http://localhost:$PORT..."
    if command -v setsid >/dev/null 2>&1; then
        setsid -f python3 server.py >/dev/null 2>&1
    else
        nohup python3 server.py </dev/null >/dev/null 2>&1 &
        disown
    fi
    sleep 0.5
fi

# Open in default web browser
URL="http://localhost:$PORT"
echo "Opening $URL in browser..."

if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
elif command -v sensible-browser >/dev/null 2>&1; then
    sensible-browser "$URL" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome "$URL" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
    firefox "$URL" >/dev/null 2>&1 &
else
    python3 -m webbrowser "$URL" >/dev/null 2>&1 &
fi

echo "Lexicon is ready!"
