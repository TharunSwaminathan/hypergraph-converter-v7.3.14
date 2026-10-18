#!/bin/bash
# Fixed Runtime-owned WSL supervisor. All arguments are server-owned fixed paths.
# setsid makes this shell the process-group leader before native execution.
set -eu
printf 'CANDY_PROCESS_GROUP:%s\n' "$$"
IFS= read -r authorization
[ "$authorization" = 'CANDY_EXECUTE' ]
# EOF on the private parent pipe means abrupt Runtime death. Kill only our own
# setsid process group, including the one-shot child and this watcher.
{ IFS= read -r unexpected || :; kill -KILL -- "-$$"; } <&0 &
watcher=$!
"$1" --request "$2" </dev/null &
native=$!
set +e
wait "$native"
status=$?
kill "$watcher" 2>/dev/null
wait "$watcher" 2>/dev/null
exit "$status"
