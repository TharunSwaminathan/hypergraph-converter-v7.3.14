#!/usr/bin/env bash
# Safe example only. Review/edit before running commands on your machine.
set -u

ORIGINS="${OLLAMA_ORIGINS_EXAMPLE:-https://hypergraphproject.github.io,https://YOUR_USERNAME.github.io,http://localhost:5173,http://127.0.0.1:5173}"

cat <<EOF
This is an example for configuring Ollama origins.
It does not edit your service automatically.

Allow these origins:
${ORIGINS}

Linux/WSL systemd Ollama:
  sudo systemctl edit ollama

Paste this override:

[Service]
Environment="OLLAMA_ORIGINS=${ORIGINS}"

Then run:
  sudo systemctl daemon-reload
  sudo systemctl restart ollama

Windows Ollama:
  Set the OLLAMA_ORIGINS user environment variable to:
  ${ORIGINS}

Then fully quit/restart Ollama.
EOF
