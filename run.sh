#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/A2_CS4800"
APP_FILE="app_backend.py"
BRANCH="carkeeper_webapp_mongodb"
PY="$APP_DIR/.venv/bin/python"
ENV_FILE="$APP_DIR/.env"

cd "$APP_DIR"

git fetch --all
git reset --hard "origin/$BRANCH"

if [ ! -d ".venv" ]; then
  python3.14 -m venv .venv
fi

"$PY" -m pip install --upgrade pip
"$PY" -m pip install -r requirements.txt

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

pkill -f "$PY $APP_FILE" || true

nohup "$PY" "$APP_FILE" > log.txt 2>&1 &

echo "Started. Tail logs with: tail -n 200 -f $APP_DIR/log.txt"