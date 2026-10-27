import datetime,hashlib,json,os,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
WORK=pathlib.Path(__file__).resolve().parent
HEAD='d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2'
BRANCH='candy-integration-scope6e-integrated-qualification-v5'
ENV=dict(os.environ,GIT_OPTIONAL_LOCKS='0',GIT_NO_REPLACE_OBJECTS='1')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def g(*a):return subprocess.check_output(['git','-C',str(ROOT),*a],env=ENV)
def load(p):return json.loads(p.read_bytes())
def save(name,obj):
 with (ROOT/'artifacts'/name).open('x',encoding='utf-8',newline='\n') as f:json.dump(obj,f,indent=2);f.write('\n')
def update_new_report(name,obj):
 # Only reports authored by this active V5 attempt are finalized here.
 assert name.startswith('candy-scope6e-v5-')
 with (ROOT/'artifacts'/name).open('w',encoding='utf-8',newline='\n') as f:json.dump(obj,f,indent=2);f.write('\n')

before=load(WORK/'before.json');discovery=load(WORK/'ordinary-production-discovery.json')
repository=load(ROOT/'artifacts/candy-scope6e-v5-product-gates.json');package=load(ROOT/'artifacts/candy-scope6e-v5-package.json')
extracted=load(ROOT/'artifacts/candy-scope6e-v5-extracted.json');runtime=load(WORK/'extracted-runtime.json');repro=load(WORK/'extracted-metadata-route-repro.json')
assert discovery['status']==repository['status']==package['status']==extracted['status']=='PASS'
assert runtime['status']=='NON-PASS' and repro['status']=='REPRODUCED_PRODUCT_CONTRACT_MISMATCH'
assert [x['httpStatus'] for x in repro['requests']]==[404,200] and runtime['cleanShutdown'] and repro['cleanShutdown']
assert g('rev-parse','HEAD').decode().strip()==g('rev-parse','origin/main').decode().strip()==HEAD
assert g('branch','--show-current').decode().strip()==BRANCH
assert not g('diff','--name-only') and not g('diff','--cached','--name-only')
refs=g('for-each-ref','--format=%(refname) %(objectname) %(*objectname)').decode();assert refs==before['refs']
assert h(pathlib.Path(before['index']['path']))==before['index']['sha256']
changed=[];mtime_changes=[]
for rel,entry in before['priorFiles'].items():
 p=ROOT/rel
 if not p.exists() or h(p)!=entry['sha256']:changed.append(rel)
 elif p.stat().st_mtime_ns!=entry['mtimeNs']:mtime_changes.append(rel)
assert not changed,changed
generic_test_telemetry={'artifacts/deterministic-nlu-compiler-quality-report.json','artifacts/deterministic-nlu-quality-report.json'}
assert set(mtime_changes)<=generic_test_telemetry,mtime_changes
native=[]
for entry in before['nativeFiles']:
 p=pathlib.Path(entry['path']);assert h(p)==entry['sha256'] and p.stat().st_size==entry['bytes'] and p.stat().st_mtime_ns==entry['mtimeNs']
 native.append(dict(path=str(p),bytes=p.stat().st_size,sha256=h(p),mtimeNs=p.stat().st_mtime_ns))
untracked={p for p in g('ls-files','--others','--exclude-standard','-z').decode().split('\0') if p}
new=sorted(untracked-set(before['priorUntracked']))
assert all(p.startswith('artifacts/candy-scope6e-v5-') or p=='artifacts/deterministic-nlu-integrated-routing-report.json' for p in new),new

failure=dict(gate=7,id='EXTRACTED_RUNTIME_ARTIFACT_METADATA_ROUTE_MISMATCH',
 title='Git-free extracted Runtime ordinary artifact-metadata client/server contract',
 expected='Fresh authenticated upload followed by committed client.getArtifactMetadata(id) returns that artifact metadata.',
 actual='Fresh upload succeeds; committed client metadata lookup returns HTTP404 ALGORITHM_FAILURE / Unknown runtime route.',
 client=dict(path='src/candy/client.js',line=80,blob=g('rev-parse','HEAD:src/candy/client.js').decode().strip(),behavior='encodeURIComponent(id) encodes sha256: as sha256%3A'),
 server=dict(path='candy-runtime/src/server.js',line=14,blob=g('rev-parse','HEAD:candy-runtime/src/server.js').decode().strip(),behavior='ARTIFACT_ROUTE matches literal sha256: against raw request.url; encoded form never reaches metadata lookup'),
 encodedRequest=repro['requests'][0],literalRequest=repro['requests'][1],
 exactArtifactPresent=True,authenticationFailure=False,qualificationInfrastructureFailure=False,
 productCorrectnessIssue=True,securitySeverity='No security severity assigned; observed product API contract failure.',
 materialObservation='Production artifact-presence reuse calls the same client metadata helper. Its 404 handling may cause reupload instead of a successful metadata/cache validation; later integrated browser/soak behavior was not executed.',
 diagnosticEvidence='artifacts/candy-scope6e-v5-work/extracted-metadata-route-repro.json',noCorrectiveStarted=True)
save('candy-scope6e-v5-work/first-failed-gate.json',failure)

preflight=load(ROOT/'artifacts/candy-scope6e-v5-preflight.json');preflight['ordinaryDiscovery']='PASS';preflight['productionDiscovery']=discovery
update_new_report('candy-scope6e-v5-preflight.json',preflight)
extracted.update(status='NON-PASS',productGatesStatus='PASS',runtimeValidation='NON-PASS',runtimeReport=runtime,
 runtimeReproduction=repro,firstFailedGate=failure)
update_new_report('candy-scope6e-v5-extracted.json',extracted)
for filename,section in [('native-static',8),('native-incremental',9),('runtime',10),('browser',11),('soak',12)]:
 save('candy-scope6e-v5-'+filename+'.json',dict(status='NOT_RUN',baseline=HEAD,section=section,
  reason='Stopped after the first failed hard gate: section7 extracted Runtime artifact-metadata contract.',
  reusedPreviousQualificationAsFreshEvidence=False,nativeJobsAttempted=0,
  note='Fresh full-suite committed Scope6B/6C regressions passed, but the dedicated later live phase was not run.' if section in [10,11] else None))

security='''# V5 security / provenance review status

V5 substantive integrated product-security qualification: NOT COMPLETED.

The V5 attempt stopped at the section 7 extracted Runtime artifact-metadata
client/server contract failure. The remaining native, live Runtime, browser,
and integrated soak gates were not run. Do not convert the accepted tooling
exception into a waiver of this product failure or claim integrated security PASS.

Codex Security automated completion seal: UNAVAILABLE / NOT COMPLETED.
No Codex Security scan, completion, or sealing was invoked in this attempt.
The previously accepted security-infrastructure exception remains unchanged.

Focused source review examined the committed portable producer and independent
verifier, motifQualification.js, qualificationJson.js, sessionAuth.js,
server.js, nativeProcessRunner.js/nativeSupervisor.sh, JobManager,
ArtifactStore/OwnedRoot, motifWorkflow.js, motifResultRegistry.js, and
useCandyRuntime.js. These observations are not a completed V5 security gate:

- Packaging uses a pinned committed inventory; independent verification rejects
  root evidence, local installs/builds, traversal, Windows raw-component aliases,
  symlinks/special members, unsafe modes, and known secret/credential filenames.
  Fresh clean/populated equality and committed malformed-archive regressions passed.
- The STATIC and INCREMENTAL records must match the production schema, fixed
  commit/tag and local source/build/executable/evidence/environment identities.
  The incremental whole-record hash is pinned. STATIC remains a trusted local
  operator record, not cryptographic executable attestation. JSON alone cannot
  provide the missing executable, source/build/evidence/tag/live environment.
- Qualification JSON caching reuses parsing only; files/hashes/tags/environment
  remain fresh checks. No availability injection was supplied.
- Extracted Runtime reports both CUDA motif backends unavailable without the
  excluded private installations; no local qualification state was injected.
- The Runtime binds loopback and uses per-session bearer authentication.
  Browser result authority is scoped to session, graph, pending transition,
  request/job and content digest; pairing storage is only a hint. Fresh full-suite
  controlled regressions passed, but dedicated V5 live restart/stale-authority
  and browser/soak confirmation was not completed.

The reproduced metadata route defect is recorded as a product API correctness
blocker. No exploit or security severity is inferred from the observed 404.
No unresolved Critical/High finding count is certified by this unfinished gate.
'''
with (ROOT/'artifacts/candy-scope6e-v5-security-review.md').open('x',encoding='utf-8',newline='\n') as f:f.write(security)

verdict='NON-PASS — CANDY SCOPE 6E INTEGRATED QUALIFICATION BLOCKED'
lines=['# CANDY Scope 6E V5 integrated qualification','',verdict,'',
 f'Exact baseline: `{HEAD}`. Branch: `{BRANCH}`. origin/main remains the exact baseline.',
 '', '## First failed hard gate: section 7', '',
 '**A freshly uploaded artifact cannot be queried through the committed client metadata method in the Git-free extracted Runtime.** The normal call `client.getArtifactMetadata(id)` returns HTTP404, classification ALGORITHM_FAILURE, message `Unknown runtime route.`',
 '',
 f'Client `{ROOT/"src/candy/client.js"}:80` applies `encodeURIComponent(id)`, producing `sha256%3A…`. Server `{ROOT/"candy-runtime/src/server.js"}:14` matches the raw request URL with a literal `sha256:` route. Its lookup at lines85–86 is never reached for the encoded path.',
 '', '| Same fresh artifact, authenticated request | HTTP | Result |','|---|---:|---|',
 f'| `{repro["requests"][0]["path"]}` | 404 | Unknown runtime route |',
 f'| `{repro["requests"][1]["path"]}` | 200 | Correct uploaded artifact metadata |',
 '',
 'The literal-path request is a bounded diagnostic control, not a workaround used to pass qualification. No production client/server code was changed. The mismatch is reproduced using the exact extracted committed modules, an ordinary fresh Runtime, and a fresh authenticated upload. It is a product API contract defect, not the Codex Security infrastructure exception, missing native installation state, stale authentication, or an absent artifact.',
 '', '## Gates completed and boundaries', '',
 '| Gate | Result | Evidence / limit |','|---|---|---|',
 '| Exact branch, HEAD, origin/main | PASS | d2a2bdb baseline, no tracked/staged changes |',
 '| Both qualified native installations | PASS | All18 record/source/Makefile/binary/evidence files exact, protected tags exact |',
 '| Ordinary production capability discovery | PASS | Both CUDA_STATIC and CUDA_INCREMENTAL AVAILABLE; no injected discovery/runner/environment |',
 '| Fresh repository product gates | PASS | ci; 287/287 tests; lint; both builds; audit0 production vulnerabilities; diff check |',
 '| Clean/populated portable archives | PASS | Exact byte identity, independent commit-bound verification, private-state exclusions, fresh committed Windows alias regression |',
 '| Git-free extracted product gates | PASS | ci; 287/287 tests; lint; both builds; audit0 production vulnerabilities |',
 '| Extracted health/authenticated capabilities | PASS | Fresh ordinary Runtime and client |',
 '| Extracted CUDA truthfulness | PASS | Both motif CUDA backends UNAVAILABLE with private state excluded |',
 '| Extracted CPU reference function | PASS in bounded diagnostic | Committed first taxonomy witness gives exact30-bin vector [1,0,…,0] |',
 '| Extracted normal artifact metadata | NON-PASS | Client encoded-path404 versus literal-path200 for same uploaded artifact |',
 '| Genuine V5 STATIC validation | NOT RUN | Stopped after section7 failure |',
 '| Genuine V5 INCREMENTAL validation | NOT RUN | Stopped after section7 failure |',
 '| Dedicated live Scope6C Runtime regression | NOT RUN | Fresh committed full-suite regressions passed; not substituted for the dedicated live stage |',
 '| Production browser Scope6B regression | NOT RUN | Browser inventory inspected only; no product page or instrumentation build used |',
 '| Integrated dual-backend soak | NOT RUN | Zero V5 native jobs attempted |',
 '| Substantive integrated security/provenance | NOT COMPLETED | Focused source observations retained; no full V5 security PASS |',
 '| Final preservation | PASS | Historical evidence, all18 native files, refs/index/source/build bytes and mtimes preserved |',
 '', '## Package identity', '',
 f'SHA256 `{package["cases"][0]["sha256"]}`; {package["cases"][0]["bytes"]:,} bytes; {package["cases"][0]["entries"]} entries, {package["cases"][0]["files"]} files, {package["cases"][0]["directories"]} directories. Clean and fully populated archives are byte-identical. Root artifacts, .git, dependencies/build outputs, both private installations, qualification tooling and known secret/credential patterns are excluded. Production Runtime artifact-store source remains included. The unchanged independent verifier binds membership/content to the exact commit.',
 '', '## Extracted gate session interruption', '',
 'The identical V5 request was resubmitted while the extracted gate tool session was active. The extracted suite persisted its complete287/287 PASS log. The runner had advanced through ci, tests, lint and the two builds to audit, proving prior zero exits under its sequential fail-stop logic, but its final in-memory timing/summary was not saved. Original logs were preserved, including incomplete/NUL-padded build output. The two short builds and production audit were freshly rerun with new logs, exact exit codes and timings. For the earlier ci/test/lint commands, recovered elapsed approximations are explicitly marked in extracted.json; the test runner itself reports196.4seconds. No missing measurement is presented as an exact monotonic timing.',
 '', '## Additional material observation', '',
 '`src/candy/artifactPresence.js` probes previously uploaded artifact IDs using the same committed metadata helper. Its existing404 handling may discard a reuse entry and reupload, masking the route mismatch as an eviction/miss. Later live browser reuse/retention behavior was not exercised in V5, so no broader impact or security severity is claimed. Full repository and extracted tests passed despite this live HTTP contract defect.',
 '', '## Security-infrastructure exception and limits', '',
 'Codex Security automated completion seal remains **UNAVAILABLE / NOT COMPLETED**. No scan, completion or sealing was invoked. The previously accepted infrastructure exception does not waive this product gate. Substantive integrated product-security qualification was not completed in this blocked attempt and is not claimed as PASS.',
 '',
 'No10k/100k-edge native CUDA,1M-incidence native CUDA, persistent-worker support or public-CI GPU qualification is claimed. The current qualified admission envelope remains unchanged. Persistent native workers remain deferred.',
 '', '## Preservation', '',
 f'All {len(before["priorFiles"]):,} pre-existing tracked/prior-artifact file entries retain exact content hashes. All18 native identity files retain exact hashes, sizes and mtimes. V1–V4 NON-PASS evidence, Scope4B1/6D and corrective evidence were not rewritten, including their mtimes. The complete local-ref inventory and raw index hash are unchanged; HEAD, branch, origin/main, protected tags and historical evidence branches are unchanged. The preflight inventory explicitly excludes the generic deterministic-NLU routing telemetry regenerated by the committed full test suite. Two additional generic telemetry files, deterministic-nlu-quality-report.json and deterministic-nlu-compiler-quality-report.json, were rewritten by tests/deterministic-nlu-quality-metrics.test.mjs with identical bytes but updated mtimes; these metadata differences are retained in the final inventory and are not represented as untouched. No historical Scope qualification evidence changed.',
 '',
 'Both extracted Runtime instances used for the check and bounded diagnosis shut down cleanly. No browser/build/Runtime service was left running by V5. No native job, native rebuild, native qualification or sanitizer run was performed in this V5 attempt. Prepared later-stage evidence drivers were not executed. No source, policy, Runtime architecture, native installation or historical evidence was corrected. Nothing was staged, committed, pushed, tagged or merged. No automatic corrective has started.',
 '', '## Evidence', '',
 '- `artifacts/candy-scope6e-v5-preflight.json`',
 '- `artifacts/candy-scope6e-v5-product-gates.json`',
 '- `artifacts/candy-scope6e-v5-package.json`',
 '- `artifacts/candy-scope6e-v5-extracted.json`',
 '- `artifacts/candy-scope6e-v5-work/extracted-runtime.json`',
 '- `artifacts/candy-scope6e-v5-work/extracted-metadata-route-repro.json`',
 '- `artifacts/candy-scope6e-v5-work/first-failed-gate.json`',
 '- `artifacts/candy-scope6e-v5-native-static.json`, `native-incremental.json`, `runtime.json`, `browser.json`, `soak.json`: NOT_RUN records',
 '- `artifacts/candy-scope6e-v5-security-review.md`',
 '- `artifacts/candy-scope6e-v5-final-inventory.json`',
 '']
with (ROOT/'artifacts/candy-scope6e-v5-integrated-qualification-report.md').open('x',encoding='utf-8',newline='\n') as f:f.write('\n'.join(lines))
inventory=dict(schemaVersion='candy.scope6e-v5-final-inventory/1',recordedAtUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
 verdict=verdict,baseline=HEAD,branch=BRANCH,originMain=HEAD,firstFailedGate=failure,
 trackedChanges=[],stagedChanges=[],refsUnchanged=True,refs=refs,indexSha256=h(pathlib.Path(before['index']['path'])),
 priorFileCount=len(before['priorFiles']),priorFilesChanged=changed,priorMtimesChanged=mtime_changes,
 eighteenNativeFiles=native,nativeInstallationsUnchanged=True,nativeBinaryRebuilds=0,nativeQualificationRuns=0,sanitizerRuns=0,
 nativeJobsAttempted=0,browserProductInteractions=0,laterGatesNotRun=[8,9,10,11,12],
 historicalEvidencePreserved=True,automatedSecuritySeal='UNAVAILABLE / NOT COMPLETED',codexSecurityInvoked=False,
 substantiveIntegratedSecurityStatus='NOT_COMPLETED',newUntrackedPathsBeforeFinalization=new,
 currentNewEvidenceFiles=[dict(path=str(p),bytes=p.stat().st_size,sha256=h(p)) for p in (ROOT/'artifacts').glob('candy-scope6e-v5-*') if p.is_file()],
 generatedTelemetryException=before['generatedTelemetryException'],servicesStartedByV5CleanlyStopped=True,
 committed=False,staged=False,pushed=False,tagged=False,merged=False,productCorrectiveStarted=False)
save('candy-scope6e-v5-final-inventory.json',inventory)
print(json.dumps(dict(verdict=verdict,firstFailedGate=7,productIssue=failure['id'],preservedPriorFiles=len(before['priorFiles']),nativeFiles=18,trackedChanges=0,stagedChanges=0,nativeJobs=0,correctiveStarted=False)))
