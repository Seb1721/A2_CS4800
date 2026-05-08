#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/app}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-carkeeper_webapp_next.js}"

cd "$APP_DIR"

if [ ! -d ".git" ]; then
  echo "Expected $APP_DIR to be a git checkout."
  exit 1
fi

if [ ! -f ".env.production" ] && [ ! -f ".env.local" ]; then
  echo "Missing .env.production or .env.local in $APP_DIR."
  echo "Create one on the EC2 instance with MONGODB_URI, MONGODB_DB_NAME, AUTH_SECRET, and NEXT_PUBLIC_GA_ID."
  exit 1
fi

git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"

npm ci
npm test
npm run build

if pm2 describe carkeeper >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save
