#!/usr/bin/env bash
# macOS Finder double-click launcher: build and start the production preview
# First run on a downloaded copy: right-click -> Open (Gatekeeper), or run
#   xattr -dr com.apple.quarantine <this folder>
cd -- "$(dirname -- "$0")" || exit 1
bash "./run-preview.sh"
status=$?
echo
echo "Finished (exit code ${status}). You can close this window."
read -r -p "Press Enter to close..." _ || true
exit "${status}"
