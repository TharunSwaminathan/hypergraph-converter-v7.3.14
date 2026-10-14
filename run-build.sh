#!/usr/bin/env bash
# Production build for macOS / Linux (counterpart of run-build.bat).
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit 1

for required_command in node npm; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "${required_command} was not found. Install Node.js 20.19+ or 22.12+ (https://nodejs.org, or: brew install node), reopen this terminal, and try again."
    exit 1
  fi
done
node scripts/check-node-version.mjs || exit 1

echo "Installing dependencies and building the production app..."
echo
npm install || { echo; echo "npm install failed."; exit 1; }
npm run build || { echo; echo "The production build failed."; exit 1; }
echo
echo "Build complete. Output is in ./dist"
