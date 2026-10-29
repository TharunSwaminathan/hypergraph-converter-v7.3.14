#!/usr/bin/env bash
# Development server for macOS / Linux (counterpart of run-dev.bat).
# Binds to 127.0.0.1 by default. To reach it from another device on your network:
#   HOST=0.0.0.0 ./run-dev.sh
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
node scripts/launcher-preflight.mjs find-frontend-port 5173 1 >/dev/null || exit 1
echo "Frontend origin: http://${HOST}:5173 (canonical: http://127.0.0.1:5173). No saved data is relocated across origins."
if [ "${HOST}" != "127.0.0.1" ]; then echo "WARNING: Noncanonical origin. Browser persistence is separate; portability is deferred beyond Scope 7A."; fi

echo "Starting Hypergraph Converter Studio in development mode..."
echo
npm install || {
  echo
  echo "npm install failed. Review the error above, check your network/registry access, and retry."
  exit 1
}
exec npm run dev -- --host "${HOST}" --port 5173 --strictPort
