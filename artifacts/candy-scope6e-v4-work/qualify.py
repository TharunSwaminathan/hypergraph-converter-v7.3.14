"""V4 immutable-product qualification; all new persistent evidence under artifacts."""
import hashlib,json,os,pathlib,subprocess,sys,tempfile,time,types,zipfile,shutil,re
from datetime import datetime,timezone
r=pathlib.Path.cwd();o=r/'artifacts/candy-scope6e-v4-work';head='d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2';branch='candy-integration-scope6e-integrated-qualification-v4'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1',GIT_NO_REPLACE_OBJECTS='1')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=r,env=env).decode('utf8').strip()
def save(name,v):
    with (o/name).open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def read(name):return json.loads((o/name).read_text(encoding='utf8'))
def identity():
    assert git('branch','--show-current')==branch and git('rev-parse','HEAD')==git('rev-parse','refs/remotes/origin/main')==head
    assert not git('diff','--name-only') and not git('diff','--cached','--name-only')
def start():
    identity();tracked=[p for p in git('ls-files','-z').split('\0') if p]
    idx=pathlib.Path(git('rev-parse','--git-path','index'));idx=idx if idx.is_absolute() else r/idx
    expected=[
      ('candy-runtime/.local/cuda_incremental-scope6d-tranche1-f3fa7dc3-qualified-build.json','065ba1a42fcf8b641104f67c26661364ca4aa293d2489cd4a8146a97e03b312f'),
      ('candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/src/main.cu','ce425e455649fb1e2fec632cd608834dd6f8d7b31969c81673a8d1304908ee2b'),
      ('candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/Makefile','7460a217f6d29f5c4c8eaf9079babfcc8e7ef2f79ba7a2890ca3442f6a24cc8b'),
      ('candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/build/candy-hypergraph-motif-cuda-incremental','58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff')]
    evidence=[('native','aff7a38f36b3755d3e8337ad39accf1e116490e644e90fe2f3646ea577268d87'),('memcheck','2dd22c7d0032208627631917782004f6bd6aa6eea22288a66cd2d8115284786d'),('racecheck','302d35ccbfa9a308c8b0151c65ad104ada578c45afdf29eccdd93bd6d9830cb0'),('initcheck','c16ca1dfe609165e247bca6fe73db5e745ead82218d5b4f6c7d9ba3bca5069d2'),('synccheck','049caef3c980c39fceafb447de07477abb1015ca4ac4c0e6047d16413707be49')]
    for kind,digest in evidence:
        p='artifacts/candy-scope6d-tranche1-cuda-incremental-'+kind+'-qualification.json';expected.append((p,digest))
        v=json.loads((r/p).read_bytes());assert v['candidateCommit']=='f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0' and v['binarySha256']=='58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff'
    for p,digest in expected:assert h(r/p)==digest,p
    save('before.json',dict(capturedAt=datetime.now(timezone.utc).isoformat(),head=head,branch=branch,refs=git('show-ref'),indexSha256=h(idx),
      trackedSha256={p:h(r/p) for p in tracked},nineRecoveredFiles=dict(expected),
      priorArtifactSha256={p.relative_to(r).as_posix():h(p) for p in (r/'artifacts').rglob('*') if p.is_file() and not p.is_relative_to(o) and p.relative_to(r).as_posix()!='artifacts/deterministic-nlu-integrated-routing-report.json'},
      excludedGeneratedTelemetry='artifacts/deterministic-nlu-integrated-routing-report.json',
      staticPrerequisitePaths=[dict(path='candy-runtime/.local/cuda_static-qualified-build.json',exists=(r/'candy-runtime/.local/cuda_static-qualified-build.json').exists()),dict(path='candy-runtime/native/hypergraph-motif-cuda/build/candy-hypergraph-motif-cuda',exists=(r/'candy-runtime/native/hypergraph-motif-cuda/build/candy-hypergraph-motif-cuda').exists())]))
    print('V4 identity and nine recovered-file hash gates PASS; immutable-state snapshot saved.',flush=True)
def gates(root,label):
    identity();results=[];commands=[['npm.cmd','ci'],['npm.cmd','test'],['npm.cmd','run','lint'],['npm.cmd','run','build'],['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev']]
    if label=='repository':commands.append(['git','diff','--check'])
    for i,cmd in enumerate(commands):
        log=o/(label+'-%d.log'%i);started=datetime.now(timezone.utc).isoformat();t=time.monotonic();print(label+' RUN '+' '.join(cmd),flush=True)
        with log.open('x',encoding='utf8') as f:p=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
        content=log.read_text(encoding='utf8',errors='replace');row=dict(command=cmd,exitCode=p.returncode,startedAt=started,seconds=round(time.monotonic()-t,3),log=log.relative_to(r).as_posix(),sha256=h(log))
        if cmd==['npm.cmd','test']:
            m=re.search(r'Node test suite passed: (\d+)/(\d+) files',content)
            row.update(discovered=len(list((root/'tests').glob('*.test.mjs'))),passed=int(m[1]) if m else None,total=int(m[2]) if m else None)
            row['allDiscoveredPassed']=bool(m and row['passed']==row['total']==row['discovered'])
            if not row['allDiscoveredPassed']:row['exitCode']=p.returncode or 1
        if cmd==['npm.cmd','audit','--omit=dev']:
            row['productionVulnerabilities']=0 if 'found 0 vulnerabilities' in content else None
            if row['productionVulnerabilities']!=0:row['exitCode']=p.returncode or 1
        results.append(row);print(json.dumps(row),flush=True)
        if row['exitCode']:
            save(label+'-gates.json',dict(status='NON-PASS',baseline=head,root=str(root),results=results));raise SystemExit(1)
    save(label+'-gates.json',dict(status='PASS',baseline=head,root=str(root),results=results))
def module(rel,name):
    raw=subprocess.check_output(['git','cat-file','blob',head+':'+rel],cwd=r,env=env);m=types.ModuleType(name);m.__file__=str(r/rel);exec(compile(raw,m.__file__,'exec'),m.__dict__);return m
def packages():
    identity();pack=module('scripts/package-portable-source.py','v4_pack');verify=module('scripts/verify-portable-archive.py','v4_verify');cases=[]
    source_old=r.parent/'hypergraph-converter-v7.3.14'
    old_scripts=[p for p in subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=source_old,env=env).decode().strip().split('\0') if p.startswith('scripts/')];assert len(old_scripts)==22
    with tempfile.TemporaryDirectory(prefix='candy-scope6e-v4-package-') as temp:
        temp=pathlib.Path(temp);clean=temp/'committed-clean'/'product'
        for p,data in pack.git_source_entries(r,head).items():
            t=clean/p.relative_to(r);t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(data)
        for label,root,mode in [('clean',clean,'snapshot'),('populated-recovery',r,'git'),('historical-populated',source_old,'git')]:
            archive=temp/(label+'.zip');pack.create_zip(root,archive,source_mode=mode,revision=head,project_name='product')
            report,manifest=verify.verify(archive,'product',source_root=r,revision=head)
            assert report['ok'] and report['sourceCommit']==head and report['verificationLevel']=='commit-bound'
            with zipfile.ZipFile(archive) as z:
                infos=z.infolist();names=set(z.namelist())
                bad=[n for n in names if n.startswith('product/artifacts/') or '/.local/' in n or '/node_modules/' in n or '/dist/' in n or '/coverage/' in n or '/.git/' in n or 'hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/' in n];assert not bad
                assert all('product/'+p not in names for p in old_scripts)
                for p in ['candy-runtime/src/artifacts/artifactStore.js','candy-runtime/native/hypergraph-motif-cuda/src/main.cu','candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu']:assert 'product/'+p in names
            target=o/(label+'.zip');shutil.copyfile(archive,target);save(label+'-manifest.json',manifest)
            cases.append(dict(case=label,source=str(root),sourceMode=mode,sha256=h(target),bytes=target.stat().st_size,entries=len(infos),files=sum(not i.is_dir() for i in infos),directories=sum(i.is_dir() for i in infos),verification=report,privateStateExcluded=True,all22HistoricalScriptsExcluded=True))
        assert (o/'clean.zip').read_bytes()==(o/'populated-recovery.zip').read_bytes()==(o/'historical-populated.zip').read_bytes()
    save('package.json',dict(status='PASS',baseline=head,identicalBytes=True,cases=cases,all22HistoricalScripts=old_scripts,
      committedCleanMethod='Explicit helper-compatible clean snapshot built only from raw committed blobs; both populated roots use unchanged Git-backed producer. Independent verification is commit-bound for all three.',
      historicalV1V2PackageBlockersClosed=True,recoveredNineFilePrivateStatePresentBeforePackaging=True))
    print(json.dumps(dict(package='PASS',identity={k:cases[0][k] for k in ['sha256','bytes','entries','files','directories']})),flush=True)
    extracted=pathlib.Path(tempfile.mkdtemp(prefix='candy-scope6e-v4-extracted-'))
    with zipfile.ZipFile(o/'clean.zip') as z:z.extractall(extracted)
    extracted=extracted/'product';assert not (extracted/'.git').exists() and not (extracted/'artifacts').exists()
    assert subprocess.run(['git','rev-parse','--show-toplevel'],cwd=extracted,env=env,capture_output=True).returncode!=0
    save('extraction.json',dict(root=str(extracted),baseline=head,archiveSha256=cases[0]['sha256'],gitMetadataAbsent=True,outsideRepositories=True))
    gates(extracted,'extracted')
def repository():gates(r,'repository')
if __name__=='__main__':globals()[sys.argv[1]]()
