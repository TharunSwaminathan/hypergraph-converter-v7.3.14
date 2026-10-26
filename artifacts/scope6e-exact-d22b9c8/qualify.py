"""Exact immutable-commit qualification; all outputs are additive evidence."""
import hashlib, importlib.util, json, os, pathlib, re, shutil, stat, subprocess, sys, tempfile, time, zipfile
from datetime import datetime, timezone
root=pathlib.Path.cwd();out=root/'artifacts/scope6e-exact-d22b9c8/qualification'
out.mkdir()
candidate='d22b9c89f79446fbfea2480e98e807f8da4dfbf4'
baseline='c294ed0cea093bb8933d06e6e23177a7f1409952'
branch='candy-integration-scope6e-package-corrective'
paths=['docs/PORTABLE_LOCAL_INSTALL_POLICY.md','scripts/package-portable-source.py',
       'scripts/verify-portable-archive.py','tests/candy-scope6e-package.test.mjs']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
now=lambda:datetime.now(timezone.utc).isoformat()
def git(*a):return subprocess.check_output(['git',*a],cwd=root).decode('utf8').strip()
def save(name,data):
    with (out/name).open('x',encoding='utf8') as f:json.dump(data,f,indent=2);f.write('\n')
assert git('branch','--show-current')==branch and git('rev-parse','HEAD')==candidate
assert git('rev-parse','origin/'+branch)==candidate
assert not git('diff','HEAD','--name-only') and not git('diff','--cached','--name-only')
assert git('diff','--name-only',baseline,candidate).splitlines()==paths
untracked=git('ls-files','--others','--exclude-standard').splitlines()
assert all(p.startswith('artifacts/') for p in untracked)
nums=[line.split('\t') for line in git('diff','--numstat',baseline,candidate).splitlines()]
assert sum(int(x[0]) for x in nums)==334 and sum(int(x[1]) for x in nums)==4
tracked=[p for p in git('ls-files','-z').split('\0') if p]
state=dict(capturedAt=now(),branch=branch,head=candidate,baseline=baseline,
    originTracking=git('rev-parse','origin/'+branch),refs=git('show-ref'),
    indexSha256=sha(pathlib.Path(git('rev-parse','--git-path','index'))),
    trackedSha256={p:sha(root/p) for p in tracked},
    priorArtifactSha256={p.relative_to(root).as_posix():sha(p) for p in (root/'artifacts').rglob('*')
                       if p.is_file() and out not in p.parents},
    status=git('status','--short'),deltaNameStatus=git('diff','--name-status',baseline,candidate),
    deltaNumstat=nums,deltaStat=git('diff','--stat',baseline,candidate),
    parent=git('rev-parse',candidate+'^'),tree=git('rev-parse',candidate+'^{tree}'))
save('prechange.json',state)
workspace=pathlib.Path(tempfile.mkdtemp(prefix='c6e-exact-'))
source=workspace/'gates'/'product';source.mkdir(parents=True)
source_zip=out/'exact-commit-source.zip'
subprocess.run(['git','archive','--format=zip','--output='+str(source_zip),candidate],cwd=root,check=True)
with zipfile.ZipFile(source_zip) as z:
    for n in z.namelist():assert (source/n).resolve().is_relative_to(source.resolve())
    z.extractall(source)
commit_files={}
for entry in git('ls-tree','-r',candidate).splitlines():
    meta,p=entry.split('\t',1);mode,kind,oid=meta.split()
    if kind!='blob':continue
    f=source/p
    assert f.is_file(),p
    # Git archive applies this checkout's committed EOL attributes and local
    # autocrlf policy. Verify canonical Git content, retaining actual export
    # SHA256 values separately; a CRLF export is not an unrelated overlay.
    assert subprocess.check_output(['git','hash-object','--path='+p,str(f)],cwd=root).decode().strip()==oid,p
    commit_files[p]=dict(gitBlob=oid,sha256=sha(f),bytes=f.stat().st_size)
for p in paths:
    assert git('hash-object','--path='+p,p)==commit_files[p]['gitBlob']
save('exact-source.json',dict(candidate=candidate,workspace=str(workspace),sourceRoot=str(source),
    sourceArchiveSha256=sha(source_zip),method='git archive exact candidate, no overlays; every exported file canonicalized with committed Git attributes and verified against git ls-tree',
    exportEolPolicy='Git archive uses committed attributes and local core.autocrlf; canonical Git blobs and exported raw SHA256 values are recorded separately.',
    allExtractedBlobsMatch=True,files=commit_files,productPaths={p:commit_files[p] for p in paths}))
env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
commands=[['npm.cmd','ci'],['npm.cmd','test'],['npm.cmd','run','lint'],['npm.cmd','run','build'],
          ['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev'],
          ['node','tests/candy-scope6e-package.test.mjs']]
results=[]
for idx,command in enumerate(commands):
    log=out/('%02d-%s.log'%(idx+1,re.sub(r'[^A-Za-z0-9_.=-]','-','-'.join(command))))
    print('RUN '+' '.join(command)+' [exact commit export]',flush=True);start=time.monotonic()
    with log.open('x',encoding='utf8') as f:proc=subprocess.run(command,cwd=source,env=env,stdout=f,stderr=subprocess.STDOUT)
    content=log.read_text(encoding='utf8',errors='replace')
    row=dict(command=command,exitCode=proc.returncode,seconds=round(time.monotonic()-start,3),
             cwd=str(source),candidate=candidate,log=log.relative_to(root).as_posix(),sha256=sha(log),tail=content[-2200:])
    if command==['npm.cmd','test']:
        m=re.search(r'Node test suite passed: (\d+)/(\d+) files',content)
        row['discovered']=len(list((source/'tests').glob('*.test.mjs')));row['passed']=int(m[1]) if m else None
        assert m and int(m[1])==int(m[2])==row['discovered']>=286,content[-4000:]
        assert 'Scope 6E synthetic clean/populated byte identity' in content
    if command==['npm.cmd','audit','--omit=dev'] and proc.returncode==0:assert 'found 0 vulnerabilities' in content
    results.append(row);save('gate-%02d.json'%(idx+1),row)
    print(json.dumps({k:v for k,v in row.items() if k not in ['tail','cwd']}),flush=True)
    if proc.returncode:
        save('gates.json',dict(candidate=candidate,allPass=False,results=results));raise SystemExit(proc.returncode)
diff=subprocess.run(['git','diff','--check'],cwd=root,capture_output=True,text=True)
assert diff.returncode==0 and not diff.stdout and not diff.stderr
results.append(dict(command=['git','diff','--check'],exitCode=0,cwd=str(root),candidate=candidate))
for p,row in commit_files.items():assert sha(source/p)==row['sha256'],'Tracked export bytes changed: '+p
save('gates.json',dict(capturedAt=now(),candidate=candidate,allPass=True,exactExportBlobsUnchanged=True,results=results))
def load(p,name):
    spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
pack=load(source/'scripts/package-portable-source.py','exact_pack')
verify=load(source/'scripts/verify-portable-archive.py','exact_verify')
clean=workspace/'clean'/'product';populated=workspace/'populated'/'product'
clean.mkdir(parents=True)
with zipfile.ZipFile(source_zip) as z:z.extractall(clean)
shutil.copytree(clean,populated)
prefix='candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-'
marker=b'SYNTHETIC_EXACT_COMMIT_QUALIFICATION_STATE_NOT_A_SECRET'
excluded=[]
for qualifier in ['', 'f3fa7dc3','0123456789abcdef','future-install_2']:
    excluded += [prefix+qualifier+'/'+n for n in ['Makefile','src/main.cu','qualification.json','bin/extensionless-native','build/native-binary']]
excluded += ['CANDY-RUNTIME/NATIVE/HYPERGRAPH-MOTIF-CUDA-INCREMENTAL-SCOPE6D-TRANCHE1-CASE/src/main.cu',
    'artifacts/qualification.json','artifacts/diagnostic-worktree/src/probe.js','candy-runtime/.local/cuda_incremental-qualified-build.json',
    'candy-runtime/native/hypergraph-motif-cuda/build/native-binary','candy-runtime/native/hypergraph-motif-cuda-incremental/build/native-binary',
    'node_modules/private.js','dist/private.js','coverage/report.json','.git/private','.env.local','pairing-token.txt',
    'credentials.json','session-secret.json','.secrets/session.json','.cache/private','.pytest_cache/private','.vite/private','tool.exe','lib.so']
for rel in excluded:
    f=populated/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(marker)
required=['candy-runtime/src/artifacts/artifactStore.js','tests/candy-scope6e-package.test.mjs']+[
    'candy-runtime/native/'+d+'/'+n for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for n in ['Makefile','src/main.cu']]
witnesses=out/'witnesses';witnesses.mkdir();cases=[];members=[]
for label,tree in [('committed-clean',clean),('committed-populated',populated)]:
    archive=witnesses/(label+'.zip');counts=pack.create_zip(tree,archive);report,manifest=verify.verify(archive,'product')
    assert report['ok'] and report['issueCount']==0
    with zipfile.ZipFile(archive) as z:
        infos=z.infolist();names=set(z.namelist())
        assert all('product/'+p in names for p in required)
        assert all('product/'+p not in names for p in excluded)
        assert not any(n.casefold().startswith('product/artifacts/') for n in names)
        assert not any(marker in z.read(i) for i in infos if not i.is_dir())
        content={i.filename:hashlib.sha256(z.read(i)).hexdigest() for i in infos if not i.is_dir()}
        assert all(content['product/'+p]==commit_files[p]['sha256'] for p in paths)
    members.append(content)
    cases.append(dict(candidate=candidate,path=archive.relative_to(root).as_posix(),sha256=sha(archive),bytes=archive.stat().st_size,
         entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),producerCounts=counts,verifier=report))
    save(label+'-manifest.json',manifest)
assert (witnesses/'committed-clean.zip').read_bytes()==(witnesses/'committed-populated.zip').read_bytes()
assert members[0]==members[1]
for k in ['sha256','bytes','entries','files','directories']:assert cases[0][k]==cases[1][k]
save('package.json',dict(capturedAt=now(),candidate=candidate,baseline=baseline,method='git archive exact candidate, no overlays; same-name clean/populated product roots; synthetic local state only in populated copy',
   identicalBytes=True,allCountsIdentical=True,cases=cases,excludedSyntheticPaths=excluded,requiredProductionPaths=required,
   sourceMembersMatchExactCommit=True,committedProductIdentity={p:commit_files[p] for p in paths},status='PASS'))
# Reuse the previously qualified adversarial corpus, binding its loader and
# witnesses to the immutable export and entirely new output destinations.
program=(root/'artifacts/candy-scope6e-package-alias-closure/adversarial-matrix.py').read_text()
program=program.replace("out=root/'artifacts/candy-scope6e-package-alias-closure'",'out=pathlib.Path('+repr(str(out))+')')
program=program.replace("base=out/'witnesses/candidate-clean.zip'","base=out/'witnesses/committed-clean.zip'")
program=program.replace("archive=str(target.relative_to(root)).replace('\\\\','/')","archive=str(target)")
with (out/'adversarial-matrix.log').open('x',encoding='utf8') as f:
    proc=subprocess.run([sys.executable,'-B','-c',program],cwd=source,env=env,stdout=f,stderr=subprocess.STDOUT)
assert proc.returncode==0,(out/'adversarial-matrix.log').read_text(errors='replace')[-3000:]
matrix=json.loads((out/'adversarial-matrix.json').read_text())
assert matrix['rejected']==31 and matrix['accepted']==6 and matrix['actualWindowsExtractionProofs']==16
for p,h in matrix['sourceSha256'].items():assert h==commit_files[p]['sha256']
assert all(sha(root/p)==h for p,h in state['trackedSha256'].items())
assert all(sha(root/p)==h for p,h in state['priorArtifactSha256'].items())
assert git('show-ref')==state['refs'] and sha(pathlib.Path(git('rev-parse','--git-path','index')))==state['indexSha256']
assert git('rev-parse','HEAD')==candidate and not git('diff','HEAD','--name-only') and not git('diff','--cached','--name-only')
save('preservation.json',dict(candidate=candidate,allTrackedFileBytesUnchanged=len(state['trackedSha256']),priorArtifactFilesUnchanged=len(state['priorArtifactSha256']),
   refsUnchanged=True,indexUnchanged=True,noProductModifications=True,noStageCommitPushTag=True,exactExportBlobsUnchanged=True))
print(json.dumps(dict(status='PASS',candidate=candidate,tests=286,package=cases[0],adversarialRejected=matrix['rejected'],controlsAccepted=matrix['accepted'])),flush=True)
