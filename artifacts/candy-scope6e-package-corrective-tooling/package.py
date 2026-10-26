"""Qualify a baseline git archive plus exact, explicit uncommitted overlays."""
import hashlib, importlib.util, json, shutil, stat, subprocess, tempfile, zipfile
from datetime import datetime, timezone
from pathlib import Path
root = Path.cwd()
baseline = 'c294ed0cea093bb8933d06e6e23177a7f1409952'
inventory = ['scripts/package-portable-source.py', 'scripts/verify-portable-archive.py',
             'tests/candy-scope6e-package.test.mjs', 'docs/PORTABLE_LOCAL_INSTALL_POLICY.md']
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
out = root / 'artifacts'
retained = out / 'candy-scope6e-package-corrective-witnesses'
retained.mkdir()
workspace = Path(tempfile.mkdtemp(prefix='candy-scope6e-corrective-'))
clean = workspace / 'clean' / 'product'
populated = workspace / 'populated' / 'product'
clean.mkdir(parents=True)
source_archive = workspace / 'baseline.zip'
subprocess.run(['git', 'archive', '--format=zip', f'--output={source_archive}', baseline], check=True)
with zipfile.ZipFile(source_archive) as zf:
    for name in zf.namelist():
        assert (clean / name).resolve().is_relative_to(clean.resolve())
    zf.extractall(clean)
overlays = []
for rel in inventory:
    target = clean / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / rel, target)
    overlays.append(dict(path=rel, sha256=sha(target), bytes=target.stat().st_size))
shutil.copytree(clean, populated)
prefix = 'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-'
marker = b'SCOPE6E_CORRECTIVE_SYNTHETIC_LOCAL_STATE_NOT_A_SECRET'
excluded = []
for qualifier in ['f3fa7dc3', '0123456789abcdef', 'future-install_2', '']:
    excluded += [prefix + qualifier + '/' + name for name in
                 ['Makefile', 'src/main.cu', 'build/native-binary', 'qualification.json', 'bin/extensionless-native']]
excluded += ['CANDY-RUNTIME/NATIVE/HYPERGRAPH-MOTIF-CUDA-INCREMENTAL-SCOPE6D-TRANCHE1-CASE/src/main.cu',
             'artifacts/qualification.json', 'artifacts/diagnostic-worktree/src/probe.js',
             'candy-runtime/.local/cuda_incremental-qualified-build.json',
             'candy-runtime/native/hypergraph-motif-cuda/build/native-binary',
             'candy-runtime/native/hypergraph-motif-cuda-incremental/build/native-binary',
             'node_modules/private.js', 'dist/private.js', 'coverage/report.json', '.git/private',
             '.env.local', 'pairing-token.txt', 'credentials.json', '.secrets/session.json',
             '.cache/private', '.pytest_cache/private', '.vite/private', 'tool.exe', 'lib.so']
for rel in excluded:
    path = populated / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(marker)
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
pack = load(clean / 'scripts/package-portable-source.py', 'candidate_pack')
verify = load(clean / 'scripts/verify-portable-archive.py', 'candidate_verify')
required = ['candy-runtime/src/artifacts/artifactStore.js'] + [
    'candy-runtime/native/' + directory + '/' + name
    for directory in ['hypergraph-motif-cuda', 'hypergraph-motif-cuda-incremental']
    for name in ['Makefile', 'src/main.cu']]
cases, contents = [], []
for name, candidate in [('candidate-clean', clean), ('candidate-populated', populated)]:
    archive = retained / (name + '.zip')
    counts = pack.create_zip(candidate, archive)
    report, manifest = verify.verify(archive, 'product')
    assert report['ok'] and report['issueCount'] == 0, report
    with zipfile.ZipFile(archive) as zf:
        infos = zf.infolist()
        names = set(zf.namelist())
        assert all('product/' + rel in names for rel in required)
        assert all('product/' + rel not in names for rel in excluded)
        assert all(marker not in zf.read(i) for i in infos if not i.is_dir())
        contents.append({i.filename: hashlib.sha256(zf.read(i)).hexdigest() for i in infos if not i.is_dir()})
    cases.append(dict(path=str(archive), sha256=sha(archive), bytes=archive.stat().st_size,
        entries=len(infos), files=sum(not i.is_dir() for i in infos), directories=sum(i.is_dir() for i in infos),
        producerCounts=counts, verifier=report))
    with (retained / (name + '-manifest.json')).open('x', encoding='utf8') as f:
        json.dump(manifest, f, indent=2); f.write('\n')
assert cases[0]['sha256'] == cases[1]['sha256']
assert Path(cases[0]['path']).read_bytes() == Path(cases[1]['path']).read_bytes()
assert contents[0] == contents[1]
original = root.parent / 'hypergraph-converter-v7.3.14-scope6e/artifacts/candy-scope6e-package/committed-clean.zip'
with zipfile.ZipFile(original) as zf:
    old_contents = {i.filename: hashlib.sha256(zf.read(i)).hexdigest() for i in zf.infolist() if not i.is_dir()}
removed = sorted(old_contents.keys() - contents[0].keys())
added = sorted(contents[0].keys() - old_contents.keys())
changed = sorted(k for k in old_contents.keys() & contents[0].keys() if old_contents[k] != contents[0][k])
assert not removed
assert added == sorted('product/' + p for p in inventory[2:])
assert changed == sorted('product/' + p for p in inventory[:2])
injected = retained / 'deliberately-contaminated.zip'
shutil.copyfile(cases[0]['path'], injected)
injected_names = ['product/' + prefix + 'unseen-future/' + name for name in ['Makefile', 'src/main.cu']]
with zipfile.ZipFile(injected, 'a') as zf:
    for name in injected_names:
        info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        zf.writestr(info, marker)
rejection, _ = verify.verify(injected, 'product')
assert not rejection['ok'] and rejection['issues']['forbiddenMembers'] == sorted(injected_names)
assert rejection['issueCount'] == 2
report = dict(capturedAt=datetime.now(timezone.utc).isoformat(), baseline=baseline,
    candidateIdentity='Uncommitted exact four-file overlay on baseline git archive; no candidate commit created.',
    method='git archive exact baseline; overlay explicit candidate files byte-for-byte; copy to equal-named product roots; add synthetic local state only to populated copy; invoke candidate snapshot producer and independent verifier.',
    workspace=str(workspace), overlays=overlays, cases=cases, identicalBytes=True,
    excludedSyntheticPaths=excluded, requiredProductionPaths=required,
    comparedWithOriginalClean=dict(added=added, removed=removed, changed=changed),
    independentContamination=dict(path=str(injected), verifier=rejection), status='PASS')
for suffix, value in [('package', report), ('repro', dict(
    capturedAt=report['capturedAt'], originalBlockerVerified=True,
    originalEvidence='candy-scope6e-package-corrective-prechange.json',
    exactCandidateOverlays=overlays, identicalBytes=True,
    candidateCases=cases, independentContaminationRejected=True,
    productFilesRemoved=removed, status='PASS'))]:
    with (out / ('candy-scope6e-package-corrective-' + suffix + '.json')).open('x', encoding='utf8') as f:
        json.dump(value, f, indent=2); f.write('\n')
print(json.dumps(dict(status='PASS', cases=cases, overlays=overlays, rejection=rejection)))
