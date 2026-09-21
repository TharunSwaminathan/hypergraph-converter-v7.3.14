#!/bin/bash
# Fixed Runtime-owned WSL supervisor. All arguments are server-owned fixed paths.
# setsid makes this shell the process-group leader before native execution.
set -eu
printf 'CANDY_PROCESS_GROUP:%s\n' "$$"
IFS= read -r authorization
[ "$authorization" = 'CANDY_EXECUTE' ]
exec "$1" --request "$2"
