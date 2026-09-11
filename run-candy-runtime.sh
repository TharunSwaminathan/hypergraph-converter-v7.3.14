#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "Starting the authenticated CANDY Runtime Companion on 127.0.0.1..."
npm run candy:runtime
