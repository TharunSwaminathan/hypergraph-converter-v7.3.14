import datetime,hashlib,json,os,pathlib,stat,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];WORK=pathlib.Path(__file__).resolve().parent
SHA='51e8a46ad527760b838bd92e78e19404d07acf40';OLD='9d79d9f9027b338096d7cf62d67c2a22e9cab247';TAG_OBJECT='af3911c505a510ae7b0a90bcfcbd5db47d0921a4'
BRANCH='release-v7.3.14-final-qualification';QUAL='candy-integration-scope6e-final-integrated-qualified';PREFIX='candy-v7.3.14-final-release-'
ENV=dict(os.environ,GIT_OPTIONAL_LOCKS='0',GIT_NO_REPLACE_OBJECTS='1',GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never',PYTHONDONTWRITEBYTECODE='1')
def g(*args):return subprocess.check_output(['git','-C',str(ROOT),*args],env=ENV)
def info(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and not s.st_file_attributes&stat.FILE_ATTRIBUTE_REPARSE_POINT,str(p)
 return dict(path=str(p),bytes=s.st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),mtimeNs=s.st_mtime_ns)
def save(path,data):
 with path.open('x',encoding='utf-8',newline='\n') as f:json.dump(data,f,indent=2);f.write('\n')
def rootfile(suffix,data):save(ROOT/'artifacts'/(PREFIX+suffix),data)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert g('branch','--show-current').decode().strip()==BRANCH
identities={ref:g('rev-parse',ref).decode().strip() for ref in ['HEAD','main','origin/main',QUAL+'^{commit}']};assert all(v==SHA for v in identities.values())
assert not g('diff','--name-only') and not g('diff','--cached','--name-only') and not g('diff','--name-only','main',SHA)
tree=g('rev-parse',SHA+'^{tree}').decode().strip();oldtree=g('rev-parse',OLD+'^{tree}').decode().strip();assert tree!=oldtree
assert g('rev-parse','refs/tags/v7.3.14').decode().strip()==TAG_OBJECT
assert g('rev-parse','refs/tags/v7.3.14^{commit}').decode().strip()==OLD and OLD!=SHA
api=json.loads((WORK/'github-stable-tag.json').read_bytes());assert api['tagObject']==TAG_OBJECT and api['target']['sha']==OLD
remote=g('ls-remote','--exit-code','origin','refs/heads/main','refs/tags/'+QUAL,'refs/tags/v7.3.14','refs/tags/v7.3.14^{}').decode()
remote_refs={line.split('\t',1)[1]:line.split('\t',1)[0] for line in remote.splitlines()}
assert remote_refs['refs/heads/main']==remote_refs['refs/tags/'+QUAL]==SHA
assert remote_refs['refs/tags/v7.3.14']==TAG_OBJECT and remote_refs['refs/tags/v7.3.14^{}']==OLD
save(WORK/'remote-refs.json',dict(recordedAtUtc=now,command=['git','ls-remote','--exit-code','origin','refs/heads/main','refs/tags/'+QUAL,'refs/tags/v7.3.14','refs/tags/v7.3.14^{}'],refs=remote_refs,stdout=remote,readOnly=True))
paths=[p for p in g('ls-files','-z').decode().split('\0') if p];prior={str(ROOT/p):info(ROOT/p) for p in paths}
for p in (ROOT/'artifacts').rglob('*'):
 if p.is_file() and not p.is_relative_to(WORK):prior[str(p)]=info(p)
historical={}
for repo in ROOT.parent.glob('hypergraph-converter-v7.3.14*'):
 if repo==ROOT or not repo.is_dir():continue
 for top in (repo/'artifacts').glob('candy-scope6e*'):
  for p in ([top] if top.is_file() else top.rglob('*')):
   if p.is_file():historical[str(p)]=info(p)
refs=g('for-each-ref','--format=%(refname) %(objectname) %(*objectname)').decode();idx=pathlib.Path(g('rev-parse','--path-format=absolute','--git-path','index').decode().strip());index=info(idx)
save(WORK/'before.json',dict(recordedAtUtc=now,baseline=SHA,tree=tree,refs=refs,index=index,priorFiles=prior,historicalExternalFiles=historical))
changed=[p for p in g('diff','--name-only','-z',OLD,SHA).decode().split('\0') if p];assert changed
failure=dict(gate='Pre-release version identity / stable-tag provenance',classification='RELEASE_VERSION_IDENTITY_CONFLICT',releaseVersion='v7.3.14',candidate=SHA,candidateTree=tree,existingTagObject=TAG_OBJECT,existingTagCommit=OLD,existingTagTree=oldtree,localAndRemoteAgree=True,changedCommittedPaths=len(changed),reason='The requested final stable tag already exists locally and on origin and identifies different committed product bytes. Assigning that name to this candidate would replace published version provenance, rather than create a new unoccupied release identity.',productDefectEstablished=False,repairPerformed=False)
rootfile('preflight.json',dict(status='NON-PASS',recordedAtUtc=now,repository=str(ROOT),branch=BRANCH,candidate=SHA,tree=tree,identityChecks=dict(status='PASS',refs=identities,trackedChanges=[],stagedChanges=[],productDeltaFromMain=[],dependencyManifestDeltaFromMain=[],nativeDeltaFromMain=[]),firstReleaseBlocker=failure))
rootfile('first-blocker.json',failure)
notrun=dict(status='NOT_RUN',reason='Stopped at the existing stable-version tag identity conflict; no later release gates were executed.',candidate=SHA,recordedAtUtc=now)
for suffix in ['product-gates.json','package.json','extracted.json','browser.json','runtime.json','native.json','documentation-review.json']:
 rootfile(suffix,dict(**notrun,gate=suffix.removesuffix('.json')))
seal='UNAVAILABLE / NOT COMPLETED under the previously accepted infrastructure exception'
manifest=dict(status='NON-PASS',releaseVersion='v7.3.14',releaseCandidateSha=SHA,treeSha=tree,finalScope6eTag=dict(name=QUAL,commit=SHA),firstReleaseBlocker=failure,
 finalArchive=dict(status='NOT_CREATED',filename=None,sha256=None,bytes=None,entries=None,files=None,directories=None,sourceCommit=None,verificationLevel=None),
 repositoryTests=dict(status='NOT_RUN',discoveredTestFiles=None,passed=None,failed=None,elapsedSeconds=None,exitStatus=None),productionAudit=dict(status='NOT_RUN',vulnerabilities=None),extractedTests=notrun,browser=notrun,runtime=notrun,portableCudaFailClosed=notrun,localQualifiedCudaSanity=notrun,securityReview=dict(status='NOT_RUN',unresolvedCritical=None,unresolvedHigh=None,automatedCompletionSeal=seal),
 githubCi=dict(status='NOT_QUALIFIED_IN_THIS_RUN',note='An initial read-only workflow inventory was fetched before the stable tag collision was confirmed; no final CI pass is asserted.'),githubPages=dict(status='NOT_ASSESSED',reason=notrun['reason']),previousScope6eQualification='Preserved PASS for exact candidate; this release-version collision does not relabel prior integrated results.',stableReleaseTagChanged=False)
rootfile('manifest.json',manifest)
security=f'''# Final release security review status

NOT RUN. Release candidate `{SHA}`; tree `{tree}`.

Qualification stopped at the first release-version identity/provenance blocker: existing local and remote `v7.3.14` peel to `{OLD}`, rather than the requested candidate. No new product-security defect is established by that conflict. No final release security PASS, production audit result, archive result, or unresolved-finding count is inferred from earlier qualification.

Codex Security automated completion seal: **{seal}**. Codex Security was not invoked. The exception is not the cause of this release blocker and waives no product finding. Earlier substantive security and Scope 6E PASS/NON-PASS evidence remain unchanged.
'''
with (ROOT/'artifacts'/(PREFIX+'security-review.md')).open('x',encoding='utf-8',newline='\n') as f:f.write(security)
for path,record in prior.items():assert info(pathlib.Path(path))==record,path
for path,record in historical.items():assert info(pathlib.Path(path))==record,path
assert info(idx)==index and g('for-each-ref','--format=%(refname) %(objectname) %(*objectname)').decode()==refs
assert not g('diff','--name-only') and not g('diff','--cached','--name-only') and not g('diff','--check')
assert g('rev-parse','HEAD').decode().strip()==SHA
untracked=[p for p in g('ls-files','--others','--exclude-standard','-z').decode().split('\0') if p];assert all(p.startswith('artifacts/') for p in untracked)
verdict='NON-PASS — v7.3.14 FINAL RELEASE QUALIFICATION BLOCKED'
report=f'''# CANDY / Hypergraph Converter Studio v7.3.14 final release qualification

{verdict}

Recorded UTC: {now}. Repository `{ROOT}`. Branch `{BRANCH}`.

## First release-blocking defect: existing stable-version identity conflict

The requested stable tag **`v7.3.14` already exists both locally and on origin and identifies different product bytes**:

| Identity | Existing stable release | Requested frozen candidate |
|---|---|---|
| Annotated tag object | `{TAG_OBJECT}` | No new tag created |
| Product commit | `{OLD}` | `{SHA}` |
| Tree SHA | `{oldtree}` | `{tree}` |

There are {len(changed)} differing committed paths between the existing tagged product and the requested candidate. The existing tag's commit subject is `{g('log','-1','--format=%s',OLD).decode().strip()}`. GitHub's tag-ref and annotated-tag APIs independently agree with local Git and read-only `git ls-remote` about the existing object and peeled commit.

This blocks the requested readiness to assign the final stable version name: that operation would replace existing published version provenance rather than create a new unoccupied release identity. The current run authorizes qualification only; no tag, release, source, history or version policy was altered. This is a release-provenance conflict, not a newly established product-code or security defect. No repair or retagging was attempted.

## Correct preflight identities and stopped gates

The requested branch, HEAD, main, origin/main and final Scope 6E qualification tag all correctly identify `{SHA}`. There are zero tracked/staged changes, no product delta from main, no dependency-manifest delta from main and no native delta from main. Candidate tree SHA is `{tree}`. The final integrated qualification tag was not moved.

Fresh repository tests, npm install/audit, package generation and alias matrix, fresh extraction, Runtime/application/browser smoke, portable native boundary, local native execution sanity, final release security review, Pages deployment verification and documentation qualification are **NOT RUN** after the first blocker. No release ZIP or new archive provenance was generated. No prior 288/288, audit, browser or CUDA result is reused as a fresh release result. An initial read-only GitHub workflow inventory preceded confirmation of the blocker; it is not presented as completed final-release CI qualification.

Earlier Scope 6E integrated PASS for the exact candidate remains valid historical evidence; it does not resolve the distinct stable-version collision. Historical NON-PASS outcomes and accepted exception records remain unchanged.

## Preservation

All {len(paths)} tracked files, all {len(prior)} pre-existing local tracked/evidence entries and {len(historical)} external historical Scope 6E evidence files retain exact bytes, sizes and mtimes. The raw index and complete local refs inventory are unchanged, including existing `v7.3.14`, main and every qualification tag. No source, native installation, dependency manifest, historical evidence or branch was changed. This run started no Runtime, Studio, browser, native job, native build, requalification or sanitizer process. Only additive untracked reports/helpers under `artifacts/{PREFIX}*` were created.

Nothing was staged, committed, amended, pushed, tagged, merged or released. No GitHub Release or next implementation scope was created. No historical branch was deleted.

Codex Security automated completion seal remains **{seal}**. It was not invoked or represented as passed. This exception is unrelated to the stable-tag collision.

## Evidence

- `{PREFIX}preflight.json` and `{PREFIX}first-blocker.json`: exact identities and first blocker.
- `{PREFIX}manifest.json`: explicit blocked provenance, with later results NOT RUN and archive fields null.
- `{PREFIX}inventory.json`: preservation, new path inventory and evidence hashes.
- `{PREFIX}work/github-stable-tag.json`, `remote-refs.json`, `before.json`: independent tag evidence and preservation snapshot.
- Suggested package/extracted/browser/Runtime/native/product/security/doc reports are truthful NOT_RUN records, not passing substitutes.
'''
with (ROOT/'artifacts'/(PREFIX+'qualification.md')).open('x',encoding='utf-8',newline='\n') as f:f.write(report)
inventory=dict(status='PASS',qualificationVerdict=verdict,candidate=SHA,tree=tree,firstReleaseBlocker=failure,trackedFilesPreserved=len(paths),priorLocalEntriesPreserved=len(prior),historicalExternalFilesPreserved=len(historical),allBytesSizesMtimesUnchanged=True,indexUnchanged=True,allLocalRefsUnchanged=True,trackedChanges=[],stagedChanges=[],nativeFilesModified=0,productFilesModified=0,servicesStarted=0,nativeJobs=0,nativeBuilds=0,sanitizerRuns=0,nativeRequalificationRuns=0,codexSecurityInvoked=False,stableReleaseTagCreatedOrMoved=False,githubReleaseCreated=False,nextScopeStarted=False,
 newUntrackedPaths=[p for p in g('ls-files','--others','--exclude-standard','-z').decode().split('\0') if p],rootEvidence=[info(p) for p in sorted((ROOT/'artifacts').glob(PREFIX+'*')) if p.is_file()],workEvidence=[info(p) for p in sorted(WORK.iterdir()) if p.is_file()])
rootfile('inventory.json',inventory)
print(json.dumps(dict(verdict=verdict,firstBlocker=failure['classification'],existingStableCommit=OLD,candidate=SHA,candidateTree=tree,productTests='NOT_RUN',archive='NOT_CREATED',preservation='PASS',trackedChanges=0,stagedChanges=0)))
