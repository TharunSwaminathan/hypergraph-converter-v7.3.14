"""Uncommitted caller correction qualification. No product commits or index writes."""
import hashlib,importlib.util,json,os,pathlib,re,shutil,subprocess,tempfile,time,zipfile
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/scope6e-extracted-snapshot-corrective'
base='e84f06cdaa750803a06007ade63124b6bce693c8';changed='tests/candy-scope6a-release.test.mjs'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(root,*a):return subprocess.check_output(['git',*a],cwd=root,env=env).decode('utf8').strip()
def save(name,v):
    with (o/name).open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def load(rel,name):
    spec=importlib.util.spec_from_file_location(name,r/rel);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def gates(root,label,install):
    results=[];commands=([['npm.cmd','ci']] if install else [])+[['npm.cmd','test'],['npm.cmd','run','lint'],['npm.cmd','run','build'],['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev']]
    if label=='repository':commands.append(['git','diff','--check'])
    for i,cmd in enumerate(commands):
        log=o/(label+'-%d.log'%i);start=time.monotonic();started=datetime.now(timezone.utc).isoformat()
        print(label+' RUN '+' '.join(cmd),flush=True)
        with log.open('x',encoding='utf8') as f:p=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
        text=log.read_text(encoding='utf8',errors='replace');row=dict(command=cmd,exitCode=p.returncode,seconds=round(time.monotonic()-start,3),startedAt=started,log=log.relative_to(r).as_posix(),sha256=h(log))
        if cmd==['npm.cmd','test']:
            match=re.search(r'Node test suite passed: (\d+)/(\d+) files',text)
            row.update(discovered=len(list((root/'tests').glob('*.test.mjs'))),passed=int(match[1]) if match else None,total=int(match[2]) if match else None)
            row['allDiscoveredPassed']=bool(match and row['passed']==row['total']==row['discovered'])
            if not row['allDiscoveredPassed']:row['exitCode']=p.returncode or 1
        if cmd==['npm.cmd','audit','--omit=dev']:
            row['productionVulnerabilities']=0 if 'found 0 vulnerabilities' in text else None
            if row['productionVulnerabilities']!=0:row['exitCode']=p.returncode or 1
        results.append(row);print(json.dumps(row),flush=True)
        if row['exitCode']:
            save(label+'-gates.json',dict(status='NON-PASS',root=str(root),results=results));raise SystemExit(1)
    save(label+'-gates.json',dict(status='PASS',root=str(root),results=results))
assert git(r,'rev-parse','HEAD')==base and git(old,'rev-parse','HEAD')==base
assert git(r,'diff','--name-only').splitlines()==[changed] and not git(r,'diff','--cached','--name-only')
candidateSha=h(r/changed)
save('candidate-input.json',dict(baseline=base,branch=git(r,'branch','--show-current'),path=changed,bytes=(r/changed).stat().st_size,
 sha256=candidateSha,prospectiveGitBlob=git(r,'hash-object','--path='+changed,changed),productChangeCount=1,
 sourceMode='Explicit reviewed one-file candidate overlay; no future commit SHA claimed.'))
gates(r,'repository',True)
assert h(r/changed)==candidateSha
pack=load('scripts/package-portable-source.py','snapshot_pack');verify=load('scripts/verify-portable-archive.py','snapshot_verify')
before=json.loads((o/'before.json').read_text(encoding='utf8'));scripts=before['old']['scripts'];cases=[];drafts=[]
workspace=pathlib.Path(tempfile.mkdtemp(prefix='candy-snapshot-corrective-'))
for label,source in [('clean',r),('populated',old)]:
    archive=workspace/(label+'-committed.zip');pack.create_zip(source,archive,revision=base,project_name='product')
    report,manifest=verify.verify(archive,'product',source_root=source,revision=base)
    assert report['ok'] and report['verificationLevel']=='commit-bound' and report['sourceCommit']==base
    with zipfile.ZipFile(archive) as z:
        infos=z.infolist();names=set(z.namelist());assert all('product/'+p not in names for p in scripts)
        assert not any(n.startswith('product/artifacts/') or '/.local/' in n or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-' in n for n in names)
        required=['candy-runtime/src/artifacts/artifactStore.js']+['candy-runtime/native/'+d+'/'+p for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for p in ['Makefile','src/main.cu']]
        assert all('product/'+p in names for p in required)
        snapshot=workspace/label;z.extractall(snapshot)
    target=o/(label+'-committed.zip');shutil.copyfile(archive,target);save(label+'-committed-manifest.json',manifest)
    cases.append(dict(label=label,source=str(source),sourceCommit=base,path=target.relative_to(r).as_posix(),sha256=h(target),bytes=target.stat().st_size,
      entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),verifier=report,
      all22HistoricalScriptsAbsent=True,localInstallAndRootArtifactsAbsent=True,nativeAndArtifactStoreIncluded=True))
    # A committed release must omit the uncommitted correction. Construct the
    # separately reviewed draft explicitly from trusted baseline blobs plus
    # exactly one externally recorded test overlay; never change default policy.
    snapshot=snapshot/'product';shutil.copyfile(r/changed,snapshot/changed)
    draft=workspace/(label+'-reviewed-candidate.zip');pack.create_zip(snapshot,draft,source_mode='snapshot',project_name='product')
    structural,_=verify.verify(draft,'product');assert structural['ok'] and structural['verificationLevel']=='structural-only' and structural['sourceCommit'] is None
    baseline_check,_=verify.verify(draft,'product',source_root=source,revision=base)
    assert not baseline_check['ok'] and baseline_check['issues']['sourceInventory']==['product/'+changed]
    assert baseline_check['issueCount']==1
    with zipfile.ZipFile(draft) as z:
        assert z.read('product/'+changed)==(r/changed).read_bytes();draftinfos=z.infolist()
    target=o/(label+'-reviewed-candidate.zip');shutil.copyfile(draft,target)
    drafts.append(dict(label=label,path=target.relative_to(r).as_posix(),sha256=h(target),bytes=target.stat().st_size,
      entries=len(draftinfos),files=sum(not i.is_dir() for i in draftinfos),directories=sum(i.is_dir() for i in draftinfos),
      sourceMode='explicit snapshot of approved committed inventory plus one reviewed test overlay',structural=structural,
      baselineCommitBoundRejection=baseline_check,overlay=dict(path=changed,sha256=candidateSha)))
assert (o/'clean-committed.zip').read_bytes()==(o/'populated-committed.zip').read_bytes()
assert (o/'clean-reviewed-candidate.zip').read_bytes()==(o/'populated-reviewed-candidate.zip').read_bytes()
save('package-reproduction.json',dict(status='PASS',baseline=base,realWitnessesIdenticalBytes=True,cases=cases,
  reviewedCandidateProjectionsIdenticalBytes=True,drafts=drafts,oldReadOnly=True,
  qualificationLimit='Uncommitted caller correction is excluded by default Git production. Explicit draft snapshot is validation evidence, not a commit-bound release. A future candidate commit still requires exact-SHA qualification.'))
print(json.dumps(dict(realWitnesses='PASS',reviewedCandidateProjections='PASS',committedIdentity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']},candidateIdentity={k:drafts[0][k] for k in ['sha256','bytes','entries','files','directories']})),flush=True)
extracted=pathlib.Path(tempfile.mkdtemp(prefix='candy-snapshot-corrective-extracted-'))
with zipfile.ZipFile(o/'clean-reviewed-candidate.zip') as z:z.extractall(extracted)
extracted=extracted/'product';assert not (extracted/'.git').exists() and not (extracted/'artifacts').exists()
assert h(extracted/changed)==candidateSha
discovery=subprocess.run(['git','rev-parse','--show-toplevel'],cwd=extracted,env=env,capture_output=True)
assert discovery.returncode!=0,'Extracted fixture must be outside every repository'
save('extracted-input.json',dict(root=str(extracted),archiveSha256=drafts[0]['sha256'],candidateTestSha256=candidateSha,
  gitMetadataAbsent=True,outsideEveryRepository=True,evidenceAbsentAtExtraction=True,sourceMode='explicit reviewed snapshot'))
gates(extracted,'extracted',True)
assert h(r/changed)==candidateSha and h(extracted/changed)==candidateSha
print('All repository and corrected Git-free extracted gates PASS.',flush=True)
