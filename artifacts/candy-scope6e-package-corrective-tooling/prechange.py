"""Verify preserved original witnesses before any corrective source changes."""
import hashlib
import importlib.util
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

root = Path.cwd()
baseline = 'c294ed0cea093bb8933d06e6e23177a7f1409952'
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == baseline
assert not subprocess.check_output(['git', 'diff', 'HEAD', '--name-only'], text=True).strip()
old = root.parent / 'hypergraph-converter-v7.3.14-scope6e' / 'artifacts'
spec = importlib.util.spec_from_file_location('prechange_verifier', root / 'scripts/verify-portable-archive.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
expected = [
    ('committed-clean', '03a9ba540b59a3dd69f2881b833dd00d1ef2cf7bc735fba16af722b89ef64ce2', 1723688, 937, 881, 56),
    ('committed-populated', 'bf6c0eb69ccb95d24f55992b6a818813b20795b54c67abc0f92a6b328e1a0380', 1733075, 941, 883, 58),
]
cases, contents = [], []
for name, sha, size, entries, files, dirs in expected:
    path = old / 'candy-scope6e-package' / (name + '.zip')
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == sha and len(data) == size
    report, _ = verifier.verify(path, 'product')
    assert report['ok'] and report['issueCount'] == 0
    with zipfile.ZipFile(path) as zf:
        infos = zf.infolist()
        assert (len(infos), sum(not i.is_dir() for i in infos), sum(i.is_dir() for i in infos)) == (entries, files, dirs)
        contents.append({i.filename: hashlib.sha256(zf.read(i)).hexdigest() for i in infos if not i.is_dir()})
    cases.append(dict(path=str(path), sha256=sha, bytes=size, entries=entries, files=files, directories=dirs, verifier=report))
prefix = 'product/candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/'
added = sorted(contents[1].keys() - contents[0].keys())
assert added == [prefix + 'Makefile', prefix + 'src/main.cu']
assert not (contents[0].keys() - contents[1].keys())
assert all(contents[0][k] == contents[1][k] for k in contents[0])
tracked = subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')
state = dict(capturedAt=datetime.now(timezone.utc).isoformat(), baseline=baseline,
    branch=subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip(),
    refs=subprocess.check_output(['git', 'show-ref'], text=True),
    trackedSha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in tracked if p},
    historicalEvidenceSha256={str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in old.rglob('*') if p.is_file()},
    originalBlockerVerified=True, method='Read-only exact saved archive SHA/size/count/member verification with unchanged baseline verifier; no historical files rewritten.',
    cases=cases, membersAdded=added, originalVerdict='NON-PASS — SCOPE 6E INTEGRATED QUALIFICATION BLOCKED')
out = root / 'artifacts/candy-scope6e-package-corrective-prechange.json'
with out.open('x', encoding='utf8') as f:
    json.dump(state, f, indent=2); f.write('\n')
print(json.dumps(dict(originalBlockerVerified=True, cases=cases, membersAdded=added)))
