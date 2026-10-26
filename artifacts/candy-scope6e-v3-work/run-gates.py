import hashlib,json,os,pathlib,re,subprocess,sys,tempfile,time,zipfile
from datetime import datetime,timezone
r=pathlib.Path.cwd();o=r/'artifacts/candy-scope6e-v3-work';sha='e84f06cdaa750803a06007ade63124b6bce693c8'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
def save(p,data):
    with p.open('x',encoding='utf8') as f:json.dump(data,f,indent=2);f.write('\n')
mode=sys.argv[1];assert mode in ['repo','extract']
first=json.loads((r/'artifacts/candy-scope6e-v3-package-reproduction.json').read_text(encoding='utf8'));assert first['status']=='PASS' and first['identicalBytes']
if mode=='repo':
    root=r
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=r).decode().strip()==sha
else:
    workspace=pathlib.Path(tempfile.mkdtemp(prefix='candy-scope6e-v3-extracted-'))
    archive=r/first['cases'][0]['path'];assert hashlib.sha256(archive.read_bytes()).hexdigest()==first['cases'][0]['sha256']
    with zipfile.ZipFile(archive) as z:z.extractall(workspace)
    root=workspace/'product';assert not (root/'.git').exists() and not (root/'artifacts').exists()
    save(o/'extraction.json',dict(candidate=sha,archiveSha256=first['cases'][0]['sha256'],extractedRoot=str(root),
      outsideEveryRepository=True,gitMetadataAbsent=True,evidenceAbsentAtExtraction=True))
commands=[['npm.cmd','ci'],['npm.cmd','test'],['npm.cmd','run','lint'],['npm.cmd','run','build'],['npm.cmd','run','build:github'],['npm.cmd','audit','--omit=dev']]
if mode=='repo':commands.append(['git','diff','--check'])
results=[];failed=False
for i,cmd in enumerate(commands):
    log=o/(mode+'-gate-%d.log'%i);start=time.monotonic();started=datetime.now(timezone.utc).isoformat()
    print(mode+' RUN '+' '.join(cmd),flush=True)
    with log.open('x',encoding='utf8') as f:p=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
    text=log.read_text(encoding='utf8',errors='replace')
    row=dict(command=cmd,exitCode=p.returncode,seconds=round(time.monotonic()-start,3),startedAt=started,
      log=log.relative_to(r).as_posix(),sha256=hashlib.sha256(log.read_bytes()).hexdigest())
    if cmd==['npm.cmd','test']:
        match=re.search(r'Node test suite passed: (\d+)/(\d+) files',text)
        row.update(discovered=len(list((root/'tests').glob('*.test.mjs'))),passed=int(match[1]) if match else None,total=int(match[2]) if match else None)
        row['testCountMatchesDiscovery']=bool(match and row['passed']==row['total']==row['discovered'])
        if not row['testCountMatchesDiscovery']:failed=True
    if cmd==['npm.cmd','audit','--omit=dev']:
        row['productionVulnerabilities']=0 if 'found 0 vulnerabilities' in text else None
        if row['productionVulnerabilities']!=0:failed=True
    results.append(row);print(json.dumps(row),flush=True)
    if p.returncode:failed=True;break
save(r/('artifacts/candy-scope6e-v3-test-results.json' if mode=='repo' else 'artifacts/candy-scope6e-v3-extracted-package.json'),
 dict(candidate=sha,status='NON-PASS' if failed else 'PASS',mode=mode,root=str(root),results=results,actualDiscoveredTestFiles=len(list((root/'tests').glob('*.test.mjs')))))
if failed:raise SystemExit(1)
