"""Additive closure evidence; never modifies product inputs or the Git index."""
import hashlib, json, os, re, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

root = Path.cwd()
out = root / 'artifacts'
run = out / 'candy-scope6e-package-corrective-final-run'
run.mkdir(exist_ok=False)
inventory = ['scripts/package-portable-source.py', 'scripts/verify-portable-archive.py',
             'tests/candy-scope6e-package.test.mjs', 'docs/PORTABLE_LOCAL_INSTALL_POLICY.md']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
now = lambda: datetime.now(timezone.utc).isoformat()
def save(path, value):
    with path.open('x', encoding='utf8') as f:
        json.dump(value, f, indent=2); f.write('\n')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode('utf8')

source_hashes = {p: sha(root / p) for p in inventory}
previous = json.loads((out / 'candy-scope6e-package-corrective-tests.json').read_text())
assert source_hashes == previous['sourceSha256'], 'Current product bytes differ from prior qualified candidate'
old_logs = []
for record in previous['results']:
    path = Path(record['log'])
    old_logs.append(dict(path=str(path), expected=record['sha256'], actual=sha(path)))
assert all(r['expected'] == r['actual'] for r in old_logs)
old_artifacts = {str(p.relative_to(root)).replace('\\', '/'): sha(p)
                 for p in out.rglob('*') if p.is_file() and run not in p.parents}
tracked = git('ls-files', '-z').split('\0')[:-1]
preserved = {p: sha(root / p) for p in tracked if p not in inventory and (root / p).is_file()}
state = dict(capturedAt=now(), sourceSha256=source_hashes, priorLogsVerified=old_logs,
             priorEvidenceSha256=old_artifacts, preservedTrackedFileSha256=preserved,
             refs=git('show-ref'), indexSha256=sha(Path(git('rev-parse','--git-path','index').strip())),
             git={})
commands = [('branch', ['branch','--show-current']), ('head', ['rev-parse','HEAD']),
            ('status', ['status','--short']), ('nameStatus', ['diff','--name-status']),
            ('stat', ['diff','--stat']), ('diffCheck', ['diff','--check']),
            ('staged', ['diff','--cached','--name-status'])]
for name, args in commands:
    state['git'][name] = git(*args)
assert state['git']['head'].strip() == 'c294ed0cea093bb8933d06e6e23177a7f1409952'
assert state['git']['branch'].strip() == 'candy-integration-scope6e-package-corrective'
assert not state['git']['staged']
changed = git('diff', '--name-only').splitlines()
untracked = git('ls-files', '--others', '--exclude-standard').splitlines()
assert sorted(changed) == sorted(inventory[:2])
assert sorted(p for p in untracked if not p.startswith('artifacts/')) == sorted(inventory[2:])
save(run / 'recovered-state.json', state)
print('Recovered state, prior log digests and four candidate hashes verified.', flush=True)

env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
gates = [['npm.cmd','test'], ['npm.cmd','run','lint'], ['npm.cmd','run','build'],
         ['npm.cmd','run','build:github'], ['npm.cmd','audit','--omit=dev'],
         ['git','diff','--check'], ['node','tests/candy-scope6e-package.test.mjs']]
results = []
for index, command in enumerate(gates):
    label = re.sub(r'[^A-Za-z0-9_.=-]', '-', '-'.join(command))
    log = run / ('%02d-%s.log' % (index+1, label))
    start = time.monotonic()
    print('RUN ' + ' '.join(command), flush=True)
    with log.open('x', encoding='utf8') as handle:
        result = subprocess.run(command, cwd=root, env=env, stdout=handle, stderr=subprocess.STDOUT)
    output = log.read_text(encoding='utf8', errors='replace')
    record = dict(command=command, exitCode=result.returncode, seconds=round(time.monotonic()-start,3),
                  log=str(log.relative_to(root)).replace('\\','/'), sha256=sha(log), tail=output[-2200:])
    if command == ['npm.cmd','test']:
        match = re.search(r'Node test suite passed: (\d+)/(\d+) files', output)
        record['discovered'] = len(list((root / 'tests').glob('*.test.mjs')))
        record['passed'] = int(match[1]) if match else None
        assert match and int(match[1]) == int(match[2]) == record['discovered']
    if command == ['npm.cmd','audit','--omit=dev']:
        assert 'found 0 vulnerabilities' in output
    results.append(record)
    save(run / ('gate-%02d.json' % (index+1)), record)
    print(json.dumps({k:v for k,v in record.items() if k != 'tail'}), flush=True)
    if result.returncode:
        save(run / 'gates.json', dict(capturedAt=now(), results=results, allPass=False))
        raise SystemExit(result.returncode)
save(run / 'gates.json', dict(capturedAt=now(), sourceSha256=source_hashes, results=results, allPass=True))

# Reuse the reviewed previous qualification procedure with fresh destinations.
# Its baseline-plus-exact-overlay construction creates no commit or index state.
program = (out / 'candy-scope6e-package-corrective-tooling/package.py').read_text()
program = program.replace("retained = out / 'candy-scope6e-package-corrective-witnesses'",
                          "retained = out / 'candy-scope6e-package-corrective-final-run' / 'witnesses'")
program = program.replace("'candy-scope6e-package-corrective-' + suffix + '.json'",
                          "'candy-scope6e-package-corrective-' + suffix + '-final.json'")
log = run / '08-real-package-regression.log'
with log.open('x', encoding='utf8') as handle:
    result = subprocess.run([sys.executable, '-B', '-c', program], cwd=root, env=env,
                            stdout=handle, stderr=subprocess.STDOUT)
assert result.returncode == 0, log.read_text(errors='replace')[-4000:]
package = json.loads((out / 'candy-scope6e-package-corrective-package-final.json').read_text())
old_package = json.loads((out / 'candy-scope6e-package-corrective-package.json').read_text())
assert package['overlays'] == old_package['overlays']
assert package['cases'][0]['sha256'] == old_package['cases'][0]['sha256']
assert source_hashes == {p: sha(root / p) for p in inventory}
assert all(sha(root / p) == digest for p,digest in preserved.items())
assert all(sha(root / p) == digest for p,digest in old_artifacts.items())
assert git('show-ref') == state['refs']
assert sha(Path(git('rev-parse','--git-path','index').strip())) == state['indexSha256']
save(run / 'preservation.json', dict(capturedAt=now(), productUnchanged=True, refsUnchanged=True,
     indexUnchanged=True, historicalArtifactFilesUnchanged=len(old_artifacts),
     otherTrackedFilesUnchanged=len(preserved), priorPackageReproduced=True,
     sourceSha256=source_hashes, packageLogSha256=sha(log)))
print(json.dumps(dict(status='PASS', tests=results[0]['passed'], packageSha256=package['cases'][0]['sha256'],
                     bytes=package['cases'][0]['bytes'], entries=package['cases'][0]['entries'],
                     identicalBytes=package['identicalBytes'], preservedHistoricalFiles=len(old_artifacts))), flush=True)
