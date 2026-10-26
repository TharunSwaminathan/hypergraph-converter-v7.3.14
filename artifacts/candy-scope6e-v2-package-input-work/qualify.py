import hashlib,importlib.util,json,os,pathlib,shutil,stat,subprocess,tempfile,time,zipfile
from datetime import datetime,timezone
root=pathlib.Path.cwd();older=root.parent/'hypergraph-converter-v7.3.14';out=root/'artifacts/candy-scope6e-v2-package-input-work'
env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_OPTIONAL_LOCKS='0')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def git(r,*a):return subprocess.check_output(['git',*a],cwd=r,env=env).decode().strip()
def save(path,value):
    with path.open('x',encoding='utf8') as f:json.dump(value,f,indent=2);f.write('\n')
def load(path,name):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
base='d22b9c89f79446fbfea2480e98e807f8da4dfbf4'
assert git(root,'rev-parse','HEAD')==git(older,'rev-parse','HEAD')==base
old_status=git(older,'status','--short');old_refs=git(older,'show-ref')
old_index=pathlib.Path(git(older,'rev-parse','--git-path','index'))
if not old_index.is_absolute():old_index=older/old_index
old_index_sha=sha(old_index)
old_untracked=git(older,'ls-files','--others','--exclude-standard','-z').split('\0')
scripts=[p for p in old_untracked if p.startswith('scripts/')]
assert len(scripts)==22
old_script_hashes={p:sha(older/p) for p in scripts}
pack=load(root/'scripts/package-portable-source.py','input_pack');verify=load(root/'scripts/verify-portable-archive.py','input_verify')
old_tracked=[p for p in git(older,'ls-files','-z').split('\0') if p]
old_tracked_sha={p:sha(older/p) for p in old_tracked}
old_install=older/'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3'
old_install_sha={str(p):sha(p) for p in old_install.rglob('*') if p.is_file()}
cases=[]
release_output=pathlib.Path(tempfile.mkdtemp(prefix='c6e-input-release-'))
for name,source in [('clean',root),('populated',older)]:
    archive=out/(name+'.zip')
    temporary_archive=release_output/(name+'.zip')
    pack.create_zip(source,temporary_archive,revision=base,project_name='product')
    shutil.copyfile(temporary_archive,archive)
    report,manifest=verify.verify(archive,'product',source_root=source,revision=base)
    assert report['ok'] and report['verificationLevel']=='commit-bound'
    with zipfile.ZipFile(archive) as z:
        infos=z.infolist();names=set(z.namelist())
        assert all('product/'+p not in names for p in scripts)
        assert not any(n.startswith('product/artifacts/') or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-' in n for n in names)
        for rel in ['candy-runtime/src/artifacts/artifactStore.js']+[
            'candy-runtime/native/'+d+'/'+n for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for n in ['Makefile','src/main.cu']]:
            assert 'product/'+rel in names
    save(out/(name+'-manifest.json'),manifest)
    cases.append(dict(source=str(source),path=archive.relative_to(root).as_posix(),sha256=sha(archive),bytes=archive.stat().st_size,
                      entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),verifier=report))
assert (out/'clean.zip').read_bytes()==(out/'populated.zip').read_bytes(),'Real witness identity failed'
# Independent commit-bound verification rejects newly named script/file injection.
injected=[]
for idx,name in enumerate(['product/scripts/new-untracked-diagnostic.mjs','product/src/arbitrary-injection.txt']):
    archive=out/('injected-%d.zip'%idx);shutil.copyfile(out/'clean.zip',archive)
    with zipfile.ZipFile(archive,'a') as z:
        i=zipfile.ZipInfo(name);i.create_system=3;i.external_attr=(stat.S_IFREG|0o644)<<16;z.writestr(i,b'INJECTED')
    report,_=verify.verify(archive,'product',source_root=root,revision=base)
    assert not report['ok'] and name in report['issues']['sourceInventory']
    injected.append(dict(path=archive.relative_to(root).as_posix(),sha256=sha(archive),report=report))
repro=dict(capturedAt=datetime.now(timezone.utc).isoformat(),status='PASS',sourceCommit=base,
    method='Corrected producer invoked directly against actual clean and actual read-only populated Git worktrees, with the same product root name; raw committed blobs, no snapshots or exclusions added for the 22 filenames.',
    identicalBytes=True,cases=cases,all22UntrackedScriptsAbsent=scripts,allUntrackedFilesExcludedByCommitInventory=True,
    checkoutEolCannotChangeBlobBytes=True,injectedArchivesRejected=injected,
    implementationSha256={p:sha(root/p) for p in ['scripts/package-portable-source.py','scripts/verify-portable-archive.py']},
    note='Source HEAD remains the committed baseline. Uncommitted corrective implementation is exercised externally and separately packaged as an explicit reviewed candidate snapshot; the default release does not silently include these edits.')
save(root/'artifacts/candy-scope6e-v2-package-input-reproduction.json',repro)
print(json.dumps(dict(realWitnessGate='PASS',identity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']})),flush=True)
# Preserve a bounded candidate snapshot containing the intended uncommitted fix,
# with explicit external inventory rather than claiming a future commit exists.
work=pathlib.Path(tempfile.mkdtemp(prefix='c6e-input-candidate-'));snapshot=work/'product';snapshot.mkdir()
entries=pack.git_source_entries(root,base)
for path,data in entries.items():
    target=snapshot/path.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
changed=git(root,'diff','--name-only').splitlines()
new=['tests/candy-scope6e-package-input.test.mjs']
inventory=[]
for p in changed+new:
    assert p.startswith(('scripts/','tests/','docs/')),p
    target=snapshot/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/p,target)
    inventory.append(dict(path=p,sha256=sha(root/p),bytes=(root/p).stat().st_size))
pack.create_zip(snapshot,out/'reviewed-candidate.zip',source_mode='snapshot',project_name='product')
report,_=verify.verify(out/'reviewed-candidate.zip','product');assert report['ok'] and report['verificationLevel']=='structural-only'
with zipfile.ZipFile(out/'reviewed-candidate.zip') as z:
    for row in inventory:assert hashlib.sha256(z.read('product/'+row['path'])).hexdigest()==row['sha256']
save(out/'reviewed-candidate.json',dict(baseline=base,sourceMode='explicit reviewed snapshot',commitCreated=False,
      futureExactShaQualificationRequired=True,path=(out/'reviewed-candidate.zip').relative_to(root).as_posix(),sha256=sha(out/'reviewed-candidate.zip'),
      candidateOverlays=inventory,allOverlayMembersMatch=True,structuralReport=report))
commands=[]
if not (root/'node_modules').exists():commands.append(['npm.cmd','ci'])
commands += [['npm.cmd','test'],['npm.cmd','run','lint'],['npm.cmd','run','build'],['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev'],['git','diff','--check']]
results=[]
for idx,command in enumerate(commands):
    log=out/('gate-%02d.log'%idx);start=time.monotonic();print('RUN '+' '.join(command),flush=True)
    with log.open('x',encoding='utf8') as f:p=subprocess.run(command,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
    text=log.read_text(encoding='utf8',errors='replace')
    row=dict(command=command,exitCode=p.returncode,seconds=round(time.monotonic()-start,3),path=log.relative_to(root).as_posix(),sha256=sha(log),tail=text[-1800:])
    if command==['npm.cmd','test']:
        import re
        match=re.search(r'Node test suite passed: (\d+)/(\d+) files',text)
        row['discovered']=len(list((root/'tests').glob('*.test.mjs')));row['passed']=int(match[1]) if match else None
        assert match and int(match[1])==int(match[2])==row['discovered'],text[-3000:]
    if command==['npm.cmd','audit','--omit=dev'] and p.returncode==0:assert 'found 0 vulnerabilities' in text
    results.append(row);print(json.dumps({k:v for k,v in row.items() if k!='tail'}),flush=True)
    if p.returncode:
        save(out/'gates.json',dict(allPass=False,results=results));raise SystemExit(p.returncode)
save(out/'gates.json',dict(allPass=True,results=results,sourceSha256={r['path']:r['sha256'] for r in inventory}))
assert all(sha(root/r['path'])==r['sha256'] for r in inventory)
assert all(sha(older/p)==h for p,h in old_script_hashes.items())
assert all(sha(older/p)==h for p,h in old_tracked_sha.items())
assert all(sha(pathlib.Path(p))==h for p,h in old_install_sha.items())
assert git(older,'status','--short')==old_status and git(older,'show-ref')==old_refs and sha(old_index)==old_index_sha
save(out/'older-preservation.json',dict(oldScriptsUnchanged=len(old_script_hashes),oldTrackedFilesUnchanged=len(old_tracked_sha),oldInstallFilesUnchanged=len(old_install_sha),oldGitStatusRefsIndexUnchanged=True))
print('ALL REQUIRED PRODUCT GATES PASS; older populated witness unchanged.',flush=True)
