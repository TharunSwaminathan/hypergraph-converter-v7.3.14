#!/usr/bin/env bash
# Production preview for macOS / Linux (counterpart of run-preview.bat).
# Binds to 127.0.0.1 by default; use HOST=0.0.0.0 to expose it on your network.
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit 1
HOST="${HOST:-127.0.0.1}"

for required_command in node npm; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "${required_command} was not found. Install Node.js 20.19+ or 22.12+ (https://nodejs.org, or: brew install node), reopen this terminal, and try again."
    exit 1
  fi
done
node scripts/check-node-version.mjs || exit 1

echo "Building and starting the production preview..."
echo
npm install || { echo; echo "npm install failed."; exit 1; }
npm run build || { echo; echo "The production build failed."; exit 1; }
exec npm run preview -- --host "${HOST}"
