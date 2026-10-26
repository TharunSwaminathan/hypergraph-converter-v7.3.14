"""First V3 hard gate; no product writes and no populated-witness mutation."""
import hashlib,json,os,pathlib,shutil,subprocess,tempfile,types,zipfile
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/candy-scope6e-v3-work'
sha='e84f06cdaa750803a06007ade63124b6bce693c8';branch='candy-integration-scope6e-integrated-qualification-v3'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(root,*args):return subprocess.check_output(['git',*args],cwd=root,env=env).decode('utf8').strip()
def save(path,data):
    with path.open('x',encoding='utf8') as f:json.dump(data,f,indent=2);f.write('\n')
def files(root):return [p for p in git(root,'ls-files','-z').split('\0') if p]
def index(root):
    p=pathlib.Path(git(root,'rev-parse','--git-path','index'));return p if p.is_absolute() else root/p
def artifacts(root):
    return {p.relative_to(root).as_posix():h(p) for p in (root/'artifacts').rglob('*') if p.is_file() and not p.is_relative_to(o)}
assert git(r,'branch','--show-current')==branch and git(r,'rev-parse','HEAD')==sha
assert git(r,'rev-parse','refs/remotes/origin/'+branch)==sha
assert git(r,'rev-parse','candy-integration-scope6e-v2-package-input-qualified^{commit}')==sha
assert not git(r,'diff','--name-only') and not git(r,'diff','--cached','--name-only')
untracked=[p for p in git(r,'ls-files','--others','--exclude-standard','-z').split('\0') if p]
assert all(p.startswith('artifacts/candy-scope6e-v3-work/') for p in untracked),untracked
assert not any((r/'candy-runtime/native').glob('hypergraph-motif-cuda-incremental-scope6d-tranche1-*'))
assert not (r/'candy-runtime/.local').exists()
scripts=[p for p in git(old,'ls-files','--others','--exclude-standard','-z').split('\0') if p.startswith('scripts/')]
assert len(scripts)==22
install=old/'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3'
local=[p for p in install.rglob('*') if p.is_file()]+[p for p in (old/'candy-runtime/.local').rglob('*') if p.is_file()]
save(r/'artifacts/candy-scope6e-v3-initial-inventory.json',dict(capturedAt=datetime.now(timezone.utc).isoformat(),branch=branch,head=sha,
  originTrackingSha=git(r,'rev-parse','refs/remotes/origin/'+branch),refs=git(r,'show-ref'),indexSha256=h(index(r)),
  initialTrackedChanges=[],initialStagedChanges=[],inheritedUntrackedContamination=False,untracked=untracked,
  trackedSha256={p:h(r/p) for p in files(r)},priorArtifactSha256=artifacts(r),
  older=dict(path=str(old),head=git(old,'rev-parse','HEAD'),branch=git(old,'branch','--show-current'),status=git(old,'status','--short'),
    indexSha256=h(index(old)),trackedAnd22ScriptsSha256={p:h(old/p) for p in files(old)+scripts},
    priorArtifactSha256=artifacts(old),installationSha256={p.relative_to(old).as_posix():h(p) for p in local},untrackedScripts=scripts)))
def load(rel,name):
    raw=subprocess.check_output(['git','cat-file','blob',sha+':'+rel],cwd=r,env=env)
    m=types.ModuleType(name);m.__file__=str(r/rel);exec(compile(raw,m.__file__,'exec'),m.__dict__);return m
pack=load('scripts/package-portable-source.py','v3_pack');verify=load('scripts/verify-portable-archive.py','v3_verify')
cases=[]
with tempfile.TemporaryDirectory(prefix='candy-v3-packages-') as temp:
    for label,source in [('clean',r),('populated',old)]:
        archive=pathlib.Path(temp)/(label+'.zip');pack.create_zip(source,archive,revision=sha,project_name='product')
        report,manifest=verify.verify(archive,'product',source_root=source,revision=sha)
        assert report['ok'] and report['verificationLevel']=='commit-bound' and report['sourceCommit']==sha
        with zipfile.ZipFile(archive) as z:
            infos=z.infolist();names=set(z.namelist())
            assert all('product/'+p not in names for p in scripts)
            assert not any(n.startswith('product/artifacts/') or '/.local/' in n or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-' in n for n in names)
            required=['candy-runtime/src/artifacts/artifactStore.js']+['candy-runtime/native/'+d+'/'+p
              for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for p in ['Makefile','src/main.cu']]
            assert all('product/'+p in names for p in required)
            binary=[];eol=[];different=[]
            for info in infos:
                if info.is_dir():continue
                rel=info.filename.removeprefix('product/');data=z.read(info)
                if (r/rel).is_file() and (old/rel).is_file():
                    a=(r/rel).read_bytes();b=(old/rel).read_bytes()
                    if a!=b:
                        different.append(rel)
                        if a.replace(b'\r\n',b'\n')==b.replace(b'\r\n',b'\n'):eol.append(rel)
                if pathlib.PurePosixPath(rel).suffix.lower() in {'.png','.ico','.woff','.woff2'} or b'\0' in data:
                    raw=subprocess.check_output(['git','cat-file','blob',sha+':'+rel],cwd=r,env=env)
                    assert raw==data
                    binary.append(dict(path=rel,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
            target=o/(label+'.zip');shutil.copyfile(archive,target)
            save(o/(label+'-manifest.json'),manifest)
            cases.append(dict(label=label,source=str(source),sourceCommit=sha,sourceWorktreeHead=git(source,'rev-parse','HEAD'),
              path=target.relative_to(r).as_posix(),sha256=h(target),bytes=target.stat().st_size,entries=len(infos),
              files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),verifier=report,
              binaryBlobsIndependentlyCompared=binary,sharedCheckoutByteDifferences=len(different),sharedCheckoutEolOnlyDifferences=len(eol),
              eolDifferentPaths=eol,all22ScriptsAbsent=True,localInstallationAndRootArtifactsExcluded=True,requiredCanonicalInputs=required))
identical=(o/'clean.zip').read_bytes()==(o/'populated.zip').read_bytes()
save(r/'artifacts/candy-scope6e-v3-package-reproduction.json',dict(capturedAt=datetime.now(timezone.utc).isoformat(),candidate=sha,
  status='PASS' if identical else 'NON-PASS',identicalBytes=identical,implementation='Exact committed producer/verifier blobs, default Git source mode, explicit SHA and product root.',
  historicalNativeInstall937vs941Reproduces=not identical,historicalUntracked939vs961Reproduces=not identical,
  historical22Scripts=scripts,cases=cases,checkoutAuthority='Raw committed blobs; checkout bytes are observations only. Dirty/EOL/binary mutations receive fresh committed regression coverage in the next gate.'))
print(json.dumps(dict(firstHardGate='PASS' if identical else 'NON-PASS',identity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']},checkoutEolDifferences=cases[0]['sharedCheckoutEolOnlyDifferences'],binaryMembers=len(cases[0]['binaryBlobsIndependentlyCompared']))),flush=True)
if not identical:raise SystemExit(1)
