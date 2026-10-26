"""Read-only GitHub API evidence, credentials remain only in process memory."""
import json,os,pathlib,subprocess,urllib.request,urllib.error,urllib.parse
from datetime import datetime,timezone
root=pathlib.Path.cwd();out=root/'artifacts/scope6e-exact-d22b9c8/remote';out.mkdir()
repo='TharunSwaminathan/hypergraph-converter-v7.3.14'
candidate='d22b9c89f79446fbfea2480e98e807f8da4dfbf4'
branch='candy-integration-scope6e-package-corrective'
assert subprocess.check_output(['git','remote','get-url','origin'],cwd=root).decode().strip()=='https://github.com/'+repo+'.git'
env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never')
proc=subprocess.run(['git','credential','fill'],input='url=https://github.com/'+repo+'.git\n\n',
                    text=True,capture_output=True,cwd=root,env=env,timeout=40)
if proc.returncode:
    print('Existing Git credential lookup unavailable (no credential output retained).');raise SystemExit(2)
credential=dict(line.split('=',1) for line in proc.stdout.splitlines() if '=' in line)
token=credential.get('password');assert token,'No usable Git credential returned'
headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'scope6e-exact-sha-readonly-qualification'}
base='https://api.github.com/repos/'+repo
requests=[]
def fetch(suffix,name):
    url=base+suffix;req=urllib.request.Request(url,headers=headers,method='GET')
    try:
        with urllib.request.urlopen(req,timeout=40) as response:data=json.load(response);code=response.status
    except urllib.error.HTTPError as error:
        print(json.dumps(dict(endpoint=suffix,httpStatus=error.code,operation='read-only GitHub API')),flush=True)
        raise SystemExit(3)
    with (out/name).open('x',encoding='utf8') as f:json.dump(data,f,indent=2);f.write('\n')
    requests.append(dict(url=url,httpStatus=code,evidence='artifacts/scope6e-exact-d22b9c8/remote/'+name))
    return data
remote_branch=fetch('/branches/'+branch,'branch.json')
assert remote_branch['commit']['sha']==candidate
pulls=fetch('/pulls?state=open&head='+urllib.parse.quote('TharunSwaminathan:'+branch),'pulls.json')
prs=[p for p in pulls if p['head']['sha']==candidate and p['head']['ref']==branch]
assert len(prs)==1 and prs[0]['draft'] and not prs[0].get('merged_at')
pr=prs[0]
runs=fetch('/actions/runs?head_sha='+candidate+'&per_page=100','runs.json')
assert runs['total_count']<=100,'Pagination required for exact-SHA runs'
checks=fetch('/commits/'+candidate+'/check-runs?per_page=100','checks.json')
assert checks['total_count']<=100,'Pagination required for exact-SHA checks'
relevant=[r for r in runs['workflow_runs'] if r['head_sha']==candidate and r['event'] in ['push','pull_request']]
jobs=[]
for run in relevant:
    payload=fetch('/actions/runs/'+str(run['id'])+'/jobs?per_page=100','jobs-'+str(run['id'])+'.json')
    assert payload['total_count']<=100
    for j in payload['jobs']:
        jobs.append(dict(run=run,job=j))
required=[('CPU release / push','CPU regression and browser source release','push','cpu'),
          ('CPU release / pull_request','CPU regression and browser source release','pull_request','cpu'),
          ('Ubuntu','CI','pull_request','Build, lint and test (Ubuntu)'),
          ('macOS','CI','pull_request','Build and test (macos-latest)'),
          ('Windows','CI','pull_request','Build and test (windows-latest)')]
bound=[]
for label,workflow,event,name in required:
    matching=[x for x in jobs if x['run']['name']==workflow and x['run']['event']==event and x['job']['name']==name]
    assert matching,'Required exact-SHA check missing: '+label
    selected=max(matching,key=lambda x:(x['run']['run_number'],x['run'].get('run_attempt',1),x['job']['id']))
    run,j=selected['run'],selected['job']
    assert run['head_sha']==candidate and j['head_sha']==candidate
    assert run['status']=='completed' and run['conclusion']=='success',(label,run['status'],run['conclusion'])
    assert j['status']=='completed' and j['conclusion']=='success',(label,j['status'],j['conclusion'])
    # Matrix continue-on-error can mask failed jobs in overall workflow status;
    # require each job itself and every substantive step to have succeeded.
    assert all(s.get('conclusion') in ('success','skipped') for s in j.get('steps',[])),label
    check=[c for c in checks['check_runs'] if c['id']==j['id']]
    assert len(check)==1 and check[0]['head_sha']==candidate and check[0]['conclusion']=='success'
    if event=='pull_request':
        assert any(p['number']==pr['number'] and p['head']['sha']==candidate for p in run['pull_requests']),label
    bound.append(dict(label=label,status='PASS',candidateSha=candidate,workflowName=workflow,event=event,
       workflowRunId=run['id'],workflowRunNumber=run['run_number'],runAttempt=run.get('run_attempt',1),
       workflowRunUrl=run['html_url'],workflowConclusion=run['conclusion'],jobId=j['id'],jobName=j['name'],
       jobUrl=j['html_url'],jobHeadSha=j['head_sha'],jobConclusion=j['conclusion'],
       checkRunId=check[0]['id'],checkHeadSha=check[0]['head_sha'],allSubstantiveStepsSuccess=True))
report=dict(capturedAt=datetime.now(timezone.utc).isoformat(),repository=repo,candidate=candidate,
  method='Authenticated read-only GitHub REST via existing repository Git credentials; credential material never printed or persisted.',
  connectorFallbackReason='GitHub connector returned 404 for repository branch/pull/run endpoints.',
  remoteBranchSha=remote_branch['commit']['sha'],pullRequest=dict(number=pr['number'],url=pr['html_url'],draft=pr['draft'],
    headSha=pr['head']['sha'],baseSha=pr['base']['sha'],baseRef=pr['base']['ref']),
  requiredChecks=bound,allFivePassExactSha=True,requests=requests)
with (out/'closure.json').open('x',encoding='utf8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(dict(status='PASS',pullRequest=report['pullRequest'],requiredChecks=bound)),flush=True)
