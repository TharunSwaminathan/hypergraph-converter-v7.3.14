#!/usr/bin/env bash
# Safe example only. Review/edit before running commands on your machine.
set -u

FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-}"
if [ -z "${FRONTEND_ORIGIN}" ]; then
  echo "Set FRONTEND_ORIGIN to the exact Dashboard URL printed by run-with-ollama.sh."
  echo "Example: FRONTEND_ORIGIN=http://127.0.0.1:5173 bash configure-ollama-origins.example.sh"
  exit 1
fi
ORIGINS="${OLLAMA_ORIGINS_EXAMPLE:-https://hypergraphproject.github.io,${FRONTEND_ORIGIN}}"

cat <<EOF
This is an example for configuring Ollama origins.
It does not edit your service automatically.

Allow these origins:
${ORIGINS}

The local origin above must match the launcher's actual port exactly.

Linux/WSL systemd Ollama:
  sudo systemctl edit ollama

Paste this override:

[Service]
Environment="OLLAMA_ORIGINS=${ORIGINS}"

Then run:
  sudo systemctl daemon-reload
  sudo systemctl restart ollama

macOS (Ollama menu-bar app):
  launchctl setenv OLLAMA_ORIGINS "${ORIGINS}"

Then quit Ollama from its menu-bar icon and open it again.
(If you run "ollama serve" yourself in a terminal instead of the app:
  OLLAMA_ORIGINS="${ORIGINS}" ollama serve )

Windows Ollama:
  Set the OLLAMA_ORIGINS user environment variable to:
  ${ORIGINS}

Then fully quit/restart Ollama.
EOF
