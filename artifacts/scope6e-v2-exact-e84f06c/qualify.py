"""Exact-SHA qualification: additive evidence and disposable fixtures only."""
import hashlib, importlib.util, json, os, pathlib, re, shutil, subprocess, sys, tempfile, time, zipfile
from datetime import datetime, timezone
root=pathlib.Path.cwd(); older=root.parent/'hypergraph-converter-v7.3.14'
out=root/'artifacts/scope6e-v2-exact-e84f06c'
candidate='e84f06cdaa750803a06007ade63124b6bce693c8'
baseline='d22b9c89f79446fbfea2480e98e807f8da4dfbf4'
branch='candy-integration-scope6e-v2-package-input-corrective'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git(r,*args): return subprocess.check_output(['git',*args],cwd=r,env=env).decode('utf8').strip()
def save(name,data):
    with (out/name).open('x',encoding='utf8') as f: json.dump(data,f,indent=2); f.write('\n')
def read(name): return json.loads((out/name).read_text(encoding='utf8'))
def index(r):
    p=pathlib.Path(git(r,'rev-parse','--git-path','index'));return p if p.is_absolute() else r/p
def tracked(r): return [p for p in git(r,'ls-files','-z').split('\0') if p]
def prior(r):
    # This ignored test-generated timing report is telemetry, not qualification history.
    return {p.relative_to(r).as_posix():digest(p) for p in (r/'artifacts').rglob('*') if p.is_file()
      and not p.is_relative_to(out) and p.relative_to(r).as_posix()!='artifacts/deterministic-nlu-integrated-routing-report.json'}
def identity():
    assert git(root,'branch','--show-current')==branch
    assert git(root,'rev-parse','HEAD')==candidate
    assert git(root,'rev-parse','refs/remotes/origin/'+branch)==candidate
    assert not git(root,'diff','--name-only') and not git(root,'diff','--cached','--name-only')
    assert git(older,'rev-parse','HEAD')==baseline
def start():
    identity()
    expected=['scripts/package-portable-source.py','scripts/verify-portable-archive.py',
      'scripts/qualify-scope6a-package.py','docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md',
      'docs/PORTABLE_LOCAL_INSTALL_POLICY.md','tests/candy-rc2-package.test.mjs',
      'tests/candy-scope6e-package.test.mjs','tests/zip-permissions-v7-3-11.test.mjs',
      'tests/candy-scope6e-package-input.test.mjs']
    changed=git(root,'diff','--name-only',baseline,candidate).splitlines()
    assert sorted(changed)==sorted(expected)
    review=json.loads((root/'artifacts/candy-scope6e-v2-package-input-proposed-commit-inventory.json').read_text(encoding='utf8'))
    reviewed={r['path']:r for r in review['classifications'] if r['path'] in expected}
    rows=[]
    for line in git(root,'diff','--numstat',baseline,candidate).splitlines():
        add,remove,p=line.split('\t');blob=git(root,'rev-parse',candidate+':'+p)
        assert blob==reviewed[p]['prospectiveGitBlob'],p
        assert git(root,'hash-object','--path='+p,p)==blob,p
        raw=subprocess.check_output(['git','cat-file','blob',candidate+':'+p],cwd=root,env=env)
        rows.append(dict(path=p,additions=int(add),deletions=int(remove),gitBlob=blob,
          committedBytes=len(raw),committedSha256=hashlib.sha256(raw).hexdigest(),
          checkoutSha256=digest(root/p),matchesReviewedProspectiveBlob=True,checkoutNormalizesToExactBlob=True))
    assert sum(r['additions'] for r in rows)==415 and sum(r['deletions'] for r in rows)==55
    save('committed-delta.json',dict(capturedAt=datetime.now(timezone.utc).isoformat(),baseline=baseline,
      candidate=candidate,paths=rows,pathCount=len(rows),additions=415,deletions=55,
      noEvidenceCommitted=True,noProtectedPathDelta=True,status='PASS'))
    scripts=[p for p in git(older,'ls-files','--others','--exclude-standard','-z').split('\0') if p.startswith('scripts/')]
    assert len(scripts)==22
    installs={p.relative_to(older).as_posix():digest(p) for p in
      (older/'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3').rglob('*') if p.is_file()}
    assert installs
    save('before.json',dict(capturedAt=datetime.now(timezone.utc).isoformat(),branch=branch,head=candidate,
      refs=git(root,'show-ref'),indexSha256=digest(index(root)),trackedSha256={p:digest(root/p) for p in tracked(root)},
      priorArtifactSha256=prior(root),olderHead=git(older,'rev-parse','HEAD'),olderStatus=git(older,'status','--short'),
      olderIndexSha256=digest(index(older)),olderTrackedAndScriptsSha256={p:digest(older/p) for p in tracked(older)+scripts},
      olderPriorArtifactSha256=prior(older),olderInstallationSha256=installs,olderUntrackedScripts=scripts,
      telemetryExcludedFromHistory='artifacts/deterministic-nlu-integrated-routing-report.json (ignored generated timing report)'))
    print('Exact identity/delta and preservation baseline recorded.',flush=True)
def run_gate(command,logname):
    identity();log=out/logname;began=datetime.now(timezone.utc).isoformat();start=time.monotonic()
    print('RUN '+' '.join(command),flush=True)
    with log.open('x',encoding='utf8') as f:p=subprocess.run(command,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
    text=log.read_text(encoding='utf8',errors='replace')
    row=dict(command=command,candidate=candidate,startedAt=began,exitCode=p.returncode,
      seconds=round(time.monotonic()-start,3),log=log.relative_to(root).as_posix(),sha256=digest(log))
    if command==['npm.cmd','test']:
        match=re.search(r'Node test suite passed: (\d+)/(\d+) files',text)
        row.update(discovered=len(list((root/'tests').glob('*.test.mjs'))),passed=int(match[1]) if match else None,
          total=int(match[2]) if match else None)
        assert match and row['passed']==row['total']==row['discovered'],text[-3000:]
    if command==['npm.cmd','audit','--omit=dev']:
        row['productionVulnerabilities']=0 if 'found 0 vulnerabilities' in text else None
        assert row['productionVulnerabilities']==0,text[-3000:]
    print(json.dumps(row),flush=True)
    return row
def gates():
    results=[]
    for i,cmd in enumerate([['npm.cmd','ci'],['npm.cmd','test'],['npm.cmd','run','lint'],
      ['npm.cmd','run','build'],['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev'],['git','diff','--check']]):
        row=run_gate(cmd,'gate-%02d.log'%i);results.append(row)
        if row['exitCode']:
            save('product-gates.json',dict(candidate=candidate,status='NON-PASS',results=results));raise SystemExit(row['exitCode'])
    save('product-gates.json',dict(candidate=candidate,status='PASS',freshDependencyInstall=True,results=results))
def load_exact(rel,name):
    raw=subprocess.check_output(['git','cat-file','blob',candidate+':'+rel],cwd=root,env=env)
    import types
    m=types.ModuleType(name);m.__file__=str(root/rel);exec(compile(raw,m.__file__,'exec'),m.__dict__);return m
def witness():
    identity();before=read('before.json')
    pack=load_exact('scripts/package-portable-source.py','exact_pack');verify=load_exact('scripts/verify-portable-archive.py','exact_verify')
    cases=[];scripts=before['olderUntrackedScripts']
    with tempfile.TemporaryDirectory(prefix='c6e-e84-release-') as temp:
        for name,source in [('clean',root),('populated',older)]:
            archive=pathlib.Path(temp)/(name+'.zip')
            pack.create_zip(source,archive,revision=candidate,project_name='product')
            report,manifest=verify.verify(archive,'product',source_root=source,revision=candidate)
            assert report['ok'] and report['verificationLevel']=='commit-bound' and report['sourceCommit']==candidate
            with zipfile.ZipFile(archive) as z:
                infos=z.infolist();names=set(z.namelist())
                assert all('product/'+p not in names for p in scripts)
                assert not any(n.startswith('product/artifacts/') or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-' in n for n in names)
                assert not any('/.local/' in n or '/.codex/' in n or '/.git/' in n for n in names)
                required=['candy-runtime/src/artifacts/artifactStore.js','tests/candy-scope6e-package-input.test.mjs']+[
                  'candy-runtime/native/'+d+'/'+n for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for n in ['Makefile','src/main.cu']]
                assert all('product/'+p in names for p in required)
                # Independently compare every archived file, including all changed files,
                # to raw immutable Git blobs, rather than checkout representations.
                compared=[]
                for info in infos:
                    if info.is_dir():continue
                    rel=info.filename.removeprefix('product/')
                    blob=subprocess.check_output(['git','cat-file','blob',candidate+':'+rel],cwd=root,env=env)
                    assert z.read(info)==blob,rel
                    compared.append(dict(path=rel,bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest()))
            target=out/(name+'.zip');shutil.copyfile(archive,target)
            save(name+'-manifest.json',manifest);save(name+'-raw-blob-comparison.json',compared)
            cases.append(dict(label=name,source=str(source),sourceWorktreeHead=git(source,'rev-parse','HEAD'),
              explicitSourceRevision=candidate,path=target.relative_to(root).as_posix(),sha256=digest(target),bytes=target.stat().st_size,
              entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),
              verifier=report,rawGitBlobsIndependentlyCompared=len(compared),
              all22UntrackedScriptsAbsent=True,localInstallationAndRootArtifactsAbsent=True,requiredProductionPathsPresent=required))
    assert (out/'clean.zip').read_bytes()==(out/'populated.zip').read_bytes()
    save('package-reproduction.json',dict(capturedAt=datetime.now(timezone.utc).isoformat(),candidate=candidate,status='PASS',
      implementation='Producer and verifier compiled directly from exact candidate Git blobs; no overlays or precommit results reused.',
      sourceMode='git',identicalBytes=True,all22Scripts=scripts,cases=cases,
      populatedWorktreePolicy='Read-only baseline worktree; shared object database permits explicit candidate revision without checkout/ref changes.'))
    print(json.dumps(dict(witnesses='PASS',identity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']})),flush=True)
    results=[]
    for i,p in enumerate(['tests/candy-scope6e-package-input.test.mjs','tests/candy-scope6e-package.test.mjs',
      'tests/candy-rc2-package.test.mjs','tests/zip-permissions-v7-3-11.test.mjs']):
        row=run_gate(['node',p],'focused-%d.log'%i);results.append(row);assert row['exitCode']==0
    save('focused-regressions.json',dict(candidate=candidate,status='PASS',results=results))
def preserve():
    identity();b=read('before.json')
    assert all(digest(root/p)==sha for p,sha in b['trackedSha256'].items())
    assert all(digest(root/p)==sha for p,sha in b['priorArtifactSha256'].items())
    assert all(digest(older/p)==sha for p,sha in b['olderTrackedAndScriptsSha256'].items())
    assert all(digest(older/p)==sha for p,sha in b['olderPriorArtifactSha256'].items())
    assert all(digest(older/p)==sha for p,sha in b['olderInstallationSha256'].items())
    assert git(older,'status','--short')==b['olderStatus'] and digest(index(older))==b['olderIndexSha256']
    assert git(root,'show-ref')==b['refs'] and digest(index(root))==b['indexSha256']
    save('preservation.json',dict(status='PASS',candidate=candidate,allTrackedBytesUnchanged=len(b['trackedSha256']),
      allPriorPrimaryArtifactsUnchanged=len(b['priorArtifactSha256']),allPriorPopulatedArtifactsUnchanged=len(b['olderPriorArtifactSha256']),
      allPopulatedTrackedAnd22ScriptsUnchanged=len(b['olderTrackedAndScriptsSha256']),
      allLocalInstallFilesUnchanged=len(b['olderInstallationSha256']),bothIndexesAndAllRefsUnchanged=True,
      noStagingCommitPushTagMergeMainChange=True,populatedWitnessReadOnly=True,trackedAndStagedChanges=[],
      integratedQualificationResumed=False,automatedCodexSecurityInvoked=False))
    print('Historical evidence, both worktrees, indexes, refs and installation preservation PASS.',flush=True)
if __name__=='__main__':globals()[sys.argv[1]]()
