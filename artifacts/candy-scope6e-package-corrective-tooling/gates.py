import hashlib, json, re, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
root = Path.cwd()
out = root / 'artifacts'
logs = out / 'candy-scope6e-package-corrective-logs'
logs.mkdir()
assert not (root / 'node_modules').exists(), 'Fresh dependencies required'
inventory = ['scripts/package-portable-source.py', 'scripts/verify-portable-archive.py',
             'tests/candy-scope6e-package.test.mjs', 'docs/PORTABLE_LOCAL_INSTALL_POLICY.md']
source_hashes = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in inventory}
commands = [['npm.cmd', 'ci'], ['npm.cmd', 'test'], ['npm.cmd', 'run', 'lint'],
            ['npm.cmd', 'run', 'build'], ['npm.cmd', 'run', 'build:github'],
            ['npm.cmd', 'audit', '--omit=dev'], ['git', 'diff', '--check']]
results = []
for index, command in enumerate(commands):
    start = time.monotonic()
    log = logs / ('%02d-%s.log' % (index + 1, '-'.join(command[1:]).replace('--', '').replace(':', '-')))
    with log.open('x', encoding='utf8') as handle:
        result = subprocess.run(command, cwd=root, stdout=handle, stderr=subprocess.STDOUT, text=True)
    output = log.read_text(encoding='utf8')
    record = dict(command=command, exitCode=result.returncode, seconds=round(time.monotonic()-start, 3), log=str(log),
                  sha256=hashlib.sha256(log.read_bytes()).hexdigest(), tail=output[-1800:])
    if command == ['npm.cmd', 'test']:
        record['testFileCount'] = len(list((root / 'tests').glob('*.test.mjs')))
    results.append(record)
    print(json.dumps(record), flush=True)
    if result.returncode:
        break
assert source_hashes == {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in inventory}
report = dict(capturedAt=datetime.now(timezone.utc).isoformat(), freshDependencyState=True,
              sourceSha256=source_hashes, results=results, allPass=len(results)==len(commands) and all(r['exitCode']==0 for r in results))
with (out / 'candy-scope6e-package-corrective-tests.json').open('x', encoding='utf8') as f:
    json.dump(report, f, indent=2); f.write('\n')
raise SystemExit(0 if report['allPass'] else 1)
