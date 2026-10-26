"""Read-only product review; only additive evidence and disposable fixtures."""
import hashlib,importlib.util,json,os,pathlib,shutil,subprocess,tempfile,time,zipfile
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/candy-scope6e-v2-package-input-boundary-work'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(root,*a):return subprocess.check_output(['git',*a],cwd=root,env=env).decode().strip()
def save(name,data):
    with (o/name).open('x',encoding='utf8') as f:json.dump(data,f,indent=2);f.write('\n')
def load(p,n):
    s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
b=read=json.loads((o/'before.json').read_text());base=b['head']
assert base=='d22b9c89f79446fbfea2480e98e807f8da4dfbf4' and git(old,'rev-parse','HEAD')==base
assert not git(r,'diff','--cached','--name-only')
expected=['docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md','docs/PORTABLE_LOCAL_INSTALL_POLICY.md',
 'scripts/package-portable-source.py','scripts/qualify-scope6a-package.py','scripts/verify-portable-archive.py',
 'tests/candy-rc2-package.test.mjs','tests/candy-scope6e-package.test.mjs','tests/zip-permissions-v7-3-11.test.mjs',
 'tests/candy-scope6e-package-input.test.mjs']
assert sorted(git(r,'diff','--name-only').splitlines()+[expected[-1]])==sorted(expected)
engineering=json.loads((r/'artifacts/candy-scope6e-v2-package-input-work/gates.json').read_text())
assert engineering['allPass'] and all(h(r/p)==sha for p,sha in engineering['sourceSha256'].items())
for row in engineering['results']:assert row['exitCode']==0 and h(r/row['path'])==row['sha256']
old_status=git(old,'status','--short');old_index=pathlib.Path(git(old,'rev-parse','--git-path','index'))
if not old_index.is_absolute():old_index=old/old_index
old_index_hash=h(old_index)
old_paths=[p for p in git(old,'ls-files','-z').split('\0') if p]
old_scripts=[p for p in git(old,'ls-files','--others','--exclude-standard','-z').split('\0') if p.startswith('scripts/')]
assert len(old_scripts)==22
old_inputs={p:h(old/p) for p in old_paths+old_scripts}
old_installs={str(p):h(p) for p in (old/'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3').rglob('*') if p.is_file()}
pack=load(r/'scripts/package-portable-source.py','boundary_pack');verify=load(r/'scripts/verify-portable-archive.py','boundary_verify')
cases=[]
with tempfile.TemporaryDirectory(prefix='c6e-boundary-') as tmp:
    tmp=pathlib.Path(tmp)
    for label,source in [('clean',r),('populated',old)]:
        archive=tmp/(label+'.zip');pack.create_zip(source,archive,revision=base,project_name='product')
        report,manifest=verify.verify(archive,'product',source_root=source,revision=base)
        assert report['ok'] and report['verificationLevel']=='commit-bound' and report['sourceCommit']==base
        with zipfile.ZipFile(archive) as z:
            infos=z.infolist();names=set(z.namelist())
            assert all('product/'+p not in names for p in old_scripts)
            assert not any(n.startswith('product/artifacts/') or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-' in n for n in names)
            required=['candy-runtime/src/artifacts/artifactStore.js']+[
              'candy-runtime/native/'+d+'/'+n for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for n in ['Makefile','src/main.cu']]
            assert all('product/'+p in names for p in required)
            binaries=[n.removeprefix('product/') for n in names if n.endswith(('.png','.ico','.woff','.woff2'))]
            for rel in binaries:
                blob=subprocess.check_output(['git','cat-file','blob',base+':'+rel],cwd=r,env=env)
                assert z.read('product/'+rel)==blob
        target=o/(label+'.zip');shutil.copyfile(archive,target);save(label+'-manifest.json',manifest)
        cases.append(dict(label=label,source=str(source),path=target.relative_to(r).as_posix(),sha256=h(target),bytes=target.stat().st_size,
          entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),
          verifier=report,all22ScriptsAbsent=True,localInstallAndRootArtifactsAbsent=True,nativeAndArtifactStoreIncluded=True,
          binaryMembersComparedToRawGitBlobs=len(binaries)))
    assert (o/'clean.zip').read_bytes()==(o/'populated.zip').read_bytes()
    for k in ['sha256','bytes','entries','files','directories']:assert cases[0][k]==cases[1][k]
save('real-witness-review.json',dict(recordedAt=datetime.now(timezone.utc).isoformat(),candidateImplementation='Current uncommitted corrective',
 sourceCommit=base,identicalBytes=True,cases=cases,oldScripts=old_scripts,rawGitBinaryBytesPreservedByIndependentCommittedFixture=True,
 note='Default release binds committed baseline blobs; current corrective code is exercised externally. Uncommitted draft remains separately inventoried and needs future exact-SHA qualification.'))
print(json.dumps(dict(realWitnesses='PASS',identity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']})),flush=True)
tests=['tests/candy-scope6e-package-input.test.mjs','tests/candy-scope6e-package.test.mjs',
       'tests/candy-rc2-package.test.mjs','tests/zip-permissions-v7-3-11.test.mjs']
results=[]
for idx,p in enumerate(tests):
    start=time.monotonic();log=o/('focused-%d.log'%idx)
    with log.open('x',encoding='utf8') as f:proc=subprocess.run(['node',p],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT)
    row=dict(command=['node',p],exitCode=proc.returncode,seconds=round(time.monotonic()-start,3),log=log.relative_to(r).as_posix(),sha256=h(log))
    results.append(row);print(json.dumps(row),flush=True)
    assert proc.returncode==0,log.read_text(errors='replace')[-1500:]
save('focused-tests.json',results)
assert all(h(r/p)==sha for p,sha in b['trackedSha256'].items())
assert all(h(r/p)==sha for p,sha in b['priorArtifactSha256'].items())
assert all(h(old/p)==sha for p,sha in old_inputs.items()) and all(h(pathlib.Path(p))==sha for p,sha in old_installs.items())
assert git(old,'status','--short')==old_status and h(old_index)==old_index_hash
assert git(r,'show-ref')==b['refs'] and h(pathlib.Path(git(r,'rev-parse','--git-path','index')))==b['indexSha256']
assert not git(r,'diff','--cached','--name-only')
save('preservation.json',dict(allCurrentTrackedBytesUnchanged=True,allPriorArtifactBytesUnchanged=len(b['priorArtifactSha256']),
 oldTrackedAndScriptFilesUnchanged=len(old_inputs),oldInstallFilesUnchanged=len(old_installs),oldStatusAndIndexUnchanged=True,
 refsAndPrimaryIndexUnchanged=True,noProductEditsDuringReview=True,nothingStaged=True))
print('Boundary review reproduction, focused regressions and preservation PASS.',flush=True)
