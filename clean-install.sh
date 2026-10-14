#!/usr/bin/env bash
# Clean reinstall for macOS / Linux (counterpart of clean-install.bat).
# Unlike the .bat file this keeps package-lock.json and uses `npm ci`, so the lockfile
# (which carries the native binaries for macOS, Linux and Windows) is never regenerated
# for only the current platform.
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit 1

for required_command in node npm; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "${required_command} was not found. Install Node.js 20.19+ or 22.12+ (https://nodejs.org, or: brew install node), reopen this terminal, and try again."
    exit 1
  fi
done
node scripts/check-node-version.mjs || exit 1

echo "Cleaning dependencies..."
rm -rf node_modules
npm cache verify || echo "(npm cache verify reported a problem; continuing)"
npm ci --registry=https://registry.npmjs.org/ || { echo; echo "npm ci failed."; exit 1; }
npm run build || { echo; echo "The production build failed."; exit 1; }
echo
echo "Clean install and build complete."
