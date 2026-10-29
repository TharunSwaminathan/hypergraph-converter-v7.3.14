"""Record the explicitly requested pre-commit gates; no staging or release actions."""
import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import time

ROOT = pathlib.Path('C:\\Users\\tharu\\OneDrive\\Documents\\Candi\\hypergraph-converter-v7.3.15-final-qualification\\artifacts\\x15\\hypergraph-converter-studio-v7.3.15')
PREFIX = "candy-v7.3.15-final-release-extracted-"
ARTIFACTS = pathlib.Path('C:\\Users\\tharu\\OneDrive\\Documents\\Candi\\hypergraph-converter-v7.3.15-final-qualification\\artifacts')
ENV = dict(os.environ, GIT_OPTIONAL_LOCKS="0", GIT_NO_REPLACE_OBJECTS="1")
GATES = [
    ("ci", "npm.cmd ci"),
    ("test", "npm.cmd test"),
    ("lint", "npm.cmd run lint"),
    ("build", "npm.cmd run build"),
    ("build-github", "npm.cmd run build:github"),
    ("audit", "npm.cmd audit --omit=dev"),
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


results = []
summary = ARTIFACTS / "candy-v7.3.15-final-release-extracted-gates.json"
if summary.exists():
    raise SystemExit("Refusing to overwrite previous validation evidence")
for name, command in GATES:
    log = ARTIFACTS / (PREFIX + name + ".txt")
    started = now()
    timer = time.monotonic()
    print("GATE_START " + name + " " + command, flush=True)
    with log.open("xb") as stream:
        stream.write(("COMMAND: " + command + "\nSTARTED_UTC: " + started + "\n").encode())
        stream.flush()
        child = subprocess.Popen(
            ["cmd.exe", "/d", "/s", "/c", command],
            cwd=ROOT, env=ENV, stdout=stream, stderr=subprocess.STDOUT,
        )
        code = child.wait()
        finished = now()
        duration = round(time.monotonic() - timer, 3)
        stream.write(("\nEXIT_CODE: " + str(code) + "\nFINISHED_UTC: " + finished + "\n").encode())
    results.append({
        "gate": name, "command": command, "cwd": str(ROOT),
        "startedAtUtc": started, "finishedAtUtc": finished,
        "seconds": duration, "exitCode": code,
        "status": "PASS" if code == 0 else "FAIL",
        "log": log.relative_to(ROOT).as_posix(),
        "logSha256": hashlib.sha256(log.read_bytes()).hexdigest(),
    })
    summary.write_text(json.dumps({
        "schema": "candy.v7.3.15-final-release-extracted-gates/1",
        "phase": "EXACT RELEASE ARCHIVE: fresh Git-free extracted product gates",
        "baseline": "335c320a052eab48d3f0c2d309805d10a5918189",
        "gates": results,
        "complete": len(results) == len(GATES),
        "allPassed": len(results) == len(GATES) and all(x["exitCode"] == 0 for x in results),
    }, indent=2) + "\n", encoding="utf-8")
    print("GATE_FINISH " + name + " exit=" + str(code) + " seconds=" + str(duration), flush=True)
    if code != 0:
        raise SystemExit(code)
print("ALL_FRESH_GIT_FREE_EXTRACTED_GATES_PASSED", flush=True)
