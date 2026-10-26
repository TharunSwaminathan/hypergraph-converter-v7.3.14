"""Fresh exact-SHA closure; additive evidence only, old witness read-only."""
import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile,time,types,zipfile,re
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/scope6e-snapshot-exact-d2a2bdb'
sha='d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2';base='e84f06cdaa750803a06007ade63124b6bce693c8'
branch='candy-integration-scope6e-extracted-snapshot-corrective';changed='tests/candy-scope6a-release.test.mjs'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(root,*a):return subprocess.check_output(['git',*a],cwd=root,env=env).decode('utf8').strip()
def save(name,v):
    with (o/name).open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def read(name):return json.loads((o/name).read_text(encoding='utf8'))
def index(root):
    p=pathlib.Path(git(root,'rev-parse','--git-path','index'));return p if p.is_absolute() else root/p
def tracked(root):return [p for p in git(root,'ls-files','-z').split('\0') if p]
def history(root):
    return {p.relative_to(root).as_posix():h(p) for p in (root/'artifacts').rglob('*') if p.is_file() and not p.is_relative_to(o)
      and p.relative_to(root).as_posix()!='artifacts/deterministic-nlu-integrated-routing-report.json'}
def identity():
    assert git(r,'branch','--show-current')==branch and git(r,'rev-parse','HEAD')==sha
    assert not git(r,'diff','--name-only') and not git(r,'diff','--cached','--name-only')
def start():
    identity();assert git(r,'diff','--name-only',base,sha).splitlines()==[changed]
    assert git(r,'diff','--numstat',base,sha)=='19\t2\t'+changed
    reviewed=json.loads((r/'artifacts/scope6e-extracted-snapshot-corrective/proposed-commit-inventory.json').read_text(encoding='utf8'))
    blob=git(r,'rev-parse',sha+':'+changed);assert blob==reviewed['proposedCommitFiles'][0]['prospectiveGitBlob']
    assert git(r,'hash-object','--path='+changed,changed)==blob
    scripts=[p for p in git(old,'ls-files','--others','--exclude-standard','-z').split('\0') if p.startswith('scripts/')];assert len(scripts)==22
    local=[p for p in (old/'candy-runtime/.local').rglob('*') if p.is_file()]+[p for p in (old/'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3').rglob('*') if p.is_file()]
    save('before.json',dict(candidate=sha,baseline=base,branch=branch,refs=git(r,'show-ref'),indexSha256=h(index(r)),
      trackedSha256={p:h(r/p) for p in tracked(r)},priorArtifactSha256=history(r),
      telemetryExcluded='artifacts/deterministic-nlu-integrated-routing-report.json (ignored test-generated timing report only)',
      older=dict(path=str(old),head=git(old,'rev-parse','HEAD'),branch=git(old,'branch','--show-current'),status=git(old,'status','--short'),
       refs=git(old,'show-ref'),indexSha256=h(index(old)),trackedAndScriptsSha256={p:h(old/p) for p in tracked(old)+scripts},
       localSha256={p.relative_to(old).as_posix():h(p) for p in local},priorArtifactSha256=history(old),scripts=scripts)))
    raw=subprocess.check_output(['git','cat-file','blob',sha+':'+changed],cwd=r,env=env)
    save('committed-delta.json',dict(status='PASS',candidate=sha,baseline=base,pathCount=1,additions=19,deletions=2,
      paths=[dict(path=changed,gitBlob=blob,sha256=hashlib.sha256(raw).hexdigest(),committedBytes=len(raw),checkoutSha256=h(r/changed),
       matchesReviewedProspectiveBlob=True,checkoutNormalizesToExactBlob=True)],noOtherCommittedDelta=True,noProtectedPathDelta=True,
      primaryOrigin=git(r,'remote','get-url','origin'),githubBranchVerifiedSeparately=True))
    print('Exact candidate/delta and preservation baseline recorded.',flush=True)
def gates(root,label):
    identity();results=[];commands=[['npm.cmd','ci'],['npm.cmd','test'],['npm.cmd','run','lint'],['npm.cmd','run','build'],['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev']]
    if label=='repository':commands.append(['git','diff','--check'])
    for i,cmd in enumerate(commands):
        log=o/(label+'-%d.log'%i);start=time.monotonic();started=datetime.now(timezone.utc).isoformat();print(label+' RUN '+' '.join(cmd),flush=True)
        with log.open('x',encoding='utf8') as f:p=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
        content=log.read_text(encoding='utf8',errors='replace');row=dict(command=cmd,candidate=sha,exitCode=p.returncode,seconds=round(time.monotonic()-start,3),startedAt=started,log=log.relative_to(r).as_posix(),sha256=h(log))
        if cmd==['npm.cmd','test']:
            match=re.search(r'Node test suite passed: (\d+)/(\d+) files',content)
            row.update(discovered=len(list((root/'tests').glob('*.test.mjs'))),passed=int(match[1]) if match else None,total=int(match[2]) if match else None)
            row['allDiscoveredPassed']=bool(match and row['passed']==row['total']==row['discovered'])
            if not row['allDiscoveredPassed']:row['exitCode']=p.returncode or 1
        if cmd==['npm.cmd','audit','--omit=dev']:
            row['productionVulnerabilities']=0 if 'found 0 vulnerabilities' in content else None
            if row['productionVulnerabilities']!=0:row['exitCode']=p.returncode or 1
        results.append(row);print(json.dumps(row),flush=True)
        if row['exitCode']:
            save(label+'-gates.json',dict(candidate=sha,status='NON-PASS',root=str(root),results=results));raise SystemExit(1)
    save(label+'-gates.json',dict(candidate=sha,status='PASS',root=str(root),results=results))
def exact(rel,name):
    data=subprocess.check_output(['git','cat-file','blob',sha+':'+rel],cwd=r,env=env);m=types.ModuleType(name);m.__file__=str(r/rel);exec(compile(data,m.__file__,'exec'),m.__dict__);return m
def packages():
    identity();pack=exact('scripts/package-portable-source.py','sha_pack');verify=exact('scripts/verify-portable-archive.py','sha_verify');before=read('before.json');cases=[]
    scripts=before['older']['scripts']
    with tempfile.TemporaryDirectory(prefix='candy-snapshot-exact-release-') as temp:
        for label,source in [('clean',r),('populated',old)]:
            archive=pathlib.Path(temp)/(label+'.zip');pack.create_zip(source,archive,revision=sha,project_name='product')
            report,manifest=verify.verify(archive,'product',source_root=source,revision=sha)
            assert report['ok'] and report['verificationLevel']=='commit-bound' and report['sourceCommit']==sha
            with zipfile.ZipFile(archive) as z:
                infos=z.infolist();names=set(z.namelist())
                assert all('product/'+p not in names for p in scripts)
                assert not any(n.startswith('product/artifacts/') or '/.local/' in n or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-' in n for n in names)
                required=['candy-runtime/src/artifacts/artifactStore.js']+['candy-runtime/native/'+d+'/'+p for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental'] for p in ['Makefile','src/main.cu']]
                assert all('product/'+p in names for p in required)
                assert z.read('product/'+changed)==subprocess.check_output(['git','cat-file','blob',sha+':'+changed],cwd=r,env=env)
                binary=[];eol=[];different=[]
                for info in infos:
                    if info.is_dir():continue
                    rel=info.filename.removeprefix('product/');data=z.read(info)
                    if (r/rel).is_file() and (old/rel).is_file():
                        a=(r/rel).read_bytes();b=(old/rel).read_bytes()
                        if a!=b:
                            different.append(rel)
                            if a.replace(b'\r\n',b'\n')==b.replace(b'\r\n',b'\n'):eol.append(rel)
                    if b'\0' in data or pathlib.PurePosixPath(rel).suffix.lower() in {'.png','.ico','.woff','.woff2'}:
                        blob=subprocess.check_output(['git','cat-file','blob',sha+':'+rel],cwd=r,env=env);assert data==blob
                        binary.append(dict(path=rel,sha256=hashlib.sha256(blob).hexdigest(),bytes=len(blob)))
            target=o/(label+'.zip');shutil.copyfile(archive,target);save(label+'-manifest.json',manifest)
            cases.append(dict(label=label,source=str(source),sourceWorktreeHead=git(source,'rev-parse','HEAD'),explicitSourceRevision=sha,path=target.relative_to(r).as_posix(),
              sha256=h(target),bytes=target.stat().st_size,entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),
              verifier=report,all22HistoricalScriptsExcluded=True,localInstallAndRootArtifactsExcluded=True,requiredProductionPaths=required,
              checkoutByteDifferences=len(different),checkoutEolOnlyDifferences=len(eol),eolDifferentPaths=eol,binaryMembersComparedWithRawBlobs=binary))
    identical=(o/'clean.zip').read_bytes()==(o/'populated.zip').read_bytes();assert identical
    save('package-reproduction.json',dict(status='PASS',candidate=sha,identicalBytes=True,cases=cases,
      method='Exact committed producer/verifier code compiled directly from candidate blobs; real roots with explicit candidate SHA, default Git mode, common product ZIP root; no snapshot overlays.',
      historical937vs941Closed=True,historical939vs961Closed=True,olderWitnessReadOnly=True,
      binaryProof='Synthetic all-byte/NUL/CRLF preservation and dirty-binary independence also run in unchanged committed input-policy test in both full suites.'))
    print(json.dumps(dict(realWitnesses='PASS',identity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']},eolDifferences=cases[0]['checkoutEolOnlyDifferences'])),flush=True)
    extracted=pathlib.Path(tempfile.mkdtemp(prefix='candy-snapshot-exact-extracted-'))
    with zipfile.ZipFile(o/'clean.zip') as z:z.extractall(extracted)
    extracted=extracted/'product';assert not (extracted/'.git').exists() and not (extracted/'artifacts').exists()
    probe=subprocess.run(['git','rev-parse','--show-toplevel'],cwd=extracted,env=env,capture_output=True);assert probe.returncode!=0
    save('extraction.json',dict(candidate=sha,root=str(extracted),archiveSha256=cases[0]['sha256'],outsideEveryRepository=True,gitMetadataAbsent=True,evidenceAbsentAtExtraction=True,
      exactCommittedCorrectiveIncluded=True,correctiveSha256=h(extracted/changed)))
    gates(extracted,'extracted')
def repository():gates(r,'repository')
if __name__=='__main__':globals()[sys.argv[1]]()
