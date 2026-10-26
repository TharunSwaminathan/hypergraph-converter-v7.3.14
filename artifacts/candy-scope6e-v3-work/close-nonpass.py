"""Preserve executed V3 results and close truthfully without product changes."""
import hashlib,json,os,pathlib,subprocess
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/candy-scope6e-v3-work'
sha='e84f06cdaa750803a06007ade63124b6bce693c8';branch='candy-integration-scope6e-integrated-qualification-v3'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0');verdict='NON-PASS — CANDY SCOPE 6E INTEGRATED QUALIFICATION BLOCKED'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf8'))
def save(p,v):
    with p.open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def text(p,s):
    with p.open('x',encoding='utf8') as f:f.write(s+'\n')
def git(root,*a):return subprocess.check_output(['git',*a],cwd=root,env=env).decode('utf8').strip()
def index(root):
    p=pathlib.Path(git(root,'rev-parse','--git-path','index'));return p if p.is_absolute() else root/p
b=read(r/'artifacts/candy-scope6e-v3-initial-inventory.json')
assert git(r,'rev-parse','HEAD')==sha and git(r,'branch','--show-current')==branch
assert not git(r,'diff','--name-only') and not git(r,'diff','--cached','--name-only')
assert git(r,'show-ref')==b['refs'] and h(index(r))==b['indexSha256']
for p,digest in b['trackedSha256'].items():assert h(r/p)==digest,p
for p,digest in b['priorArtifactSha256'].items():assert h(r/p)==digest,p
for field in ['trackedAnd22ScriptsSha256','priorArtifactSha256','installationSha256']:
    for p,digest in b['older'][field].items():assert h(old/p)==digest,p
assert git(old,'status','--short')==b['older']['status'] and h(index(old))==b['older']['indexSha256']
assert git(old,'rev-parse','HEAD')==b['older']['head']
pres=dict(status='PASS',primaryTrackedUnchanged=len(b['trackedSha256']),priorPrimaryArtifactsUnchanged=len(b['priorArtifactSha256']),
 priorPopulatedArtifactsUnchanged=len(b['older']['priorArtifactSha256']),populatedTrackedAnd22ScriptsUnchanged=len(b['older']['trackedAnd22ScriptsSha256']),
 populatedInstallationFilesUnchanged=len(b['older']['installationSha256']),bothIndexesUnchanged=True,allRefsUnchanged=True,
 noProductSourceNativePolicyOrTestEdits=True,populatedWitnessNotCleanedResetStashedOrModified=True,
 noStageCommitPushTagMergeMainChange=True,automatedCodexSecurityInvoked=False)
save(o/'preservation.json',pres)
repo=read(r/'artifacts/candy-scope6e-v3-test-results.json');ext=read(r/'artifacts/candy-scope6e-v3-extracted-package.json')
repro=read(r/'artifacts/candy-scope6e-v3-package-reproduction.json');follow=read(o/'extracted-followup.json')
runtime=read(o/'extracted-runtime.json');native=read(o/'native-preparation-blocker.json');ci=read(r/'artifacts/candy-scope6e-v3-remote-ci.json')
assert repo['status']=='PASS' and ext['status']=='NON-PASS' and repro['status']=='PASS' and runtime['status']=='PASS'
assert all(x['exitCode']==0 for x in repo['results']+follow['remainingGates'])
assert follow['explicitSnapshotDiagnostic']['exitCode']==0
for row in repo['results']+ext['results']+follow['remainingGates']:assert h(r/row['log'])==row['sha256']
failurelog=o/'extract-gate-1.log';failed=failurelog.read_text(encoding='utf8',errors='replace')
assert 'Passed before failure: 47/287' in failed and 'candy-scope6a-release.test.mjs' in failed and 'Committed source requires usable Git metadata' in failed
recorded=datetime.now(timezone.utc).isoformat()
blockers=[dict(id='V3-EXTRACTED-SUITE-GITFREE-CALLER',classification='Committed Git-free test/caller compatibility regression',
 location='tests/candy-scope6a-release.test.mjs:32',command='npm.cmd test in extracted portable package',
 discovered=287,passedBeforeFailure=47,exitCode=1,
 cause='The committed test invokes scripts/qualify-scope6a-package.py without explicit snapshot mode in a .git-free extracted package. The helper defaults to authoritative Git mode and correctly refuses missing metadata.',
 expected='Unmodified extracted-package full suite must pass. Intentional Git-free qualification must explicitly choose snapshot mode.',
 evidence=failurelog.relative_to(r).as_posix(),diagnostic='Same helper succeeds with --source-mode snapshot; no product/test edits, fallback or suite retry.',
 fixImplemented=False),
 dict(id='V3-NATIVE-PERSISTED-EVIDENCE-MISSING',classification='Local native qualification prerequisite unavailable',
 cause='The exact incremental local record references five evidence files absent at the populated witness expected paths. Native binary, source and record are present; required evidence bytes were not available for ordinary production binding.',
 missing=[f['path'] for f in native['files'] if not f['exists']],
 bypassed=False,genuineCudaJobsSubmitted=0,fixImplemented=False)]
save(o/'blockers.json',dict(candidate=sha,status='NON-PASS',blockers=blockers))
archive=repro['cases'][0]
save(r/'artifacts/candy-scope6e-v3-package.json',dict(candidate=sha,status='PASS',identicalRealWitnessBytes=True,
 archive={k:archive[k] for k in ['sha256','bytes','entries','files','directories']},
 historicalNativeInstall937vs941Closed=True,historicalUntracked939vs961Closed=True,
 all22HistoricalScriptsExcluded=True,observedCheckoutEolDifferences=archive['sharedCheckoutEolOnlyDifferences'],
 rawCommittedBlobAuthority=True,independentCommitBoundVerification=True,
 archiveBinaryMembersObserved=len(archive['binaryBlobsIndependentlyCompared']),
 binaryProof='The committed synthetic input-policy regression passed in the clean repository, including all byte values, NUL and CRLF; no actual binary archive member was identified.',
 reproduction='artifacts/candy-scope6e-v3-package-reproduction.json'))
save(r/'artifacts/candy-scope6e-v3-browser-qualification.json',dict(candidate=sha,status='NOT COMPLETED',
 studioStartedFresh=True,studioUrl='http://127.0.0.1:5173',studioStartup='PASS',studioStopped=True,
 browserSessionReused=False,integratedBrowserFlowExecuted=False,capturedBrowserEvidence=[],
 scope6BInteractiveAndB5Qualified=False,reason='Extracted-package full-suite blocker and unavailable ordinary incremental native qualification prerequisites prevented final integrated progression.',
 preciseHeapTelemetryClaimed=False,generatedParserTrusted=False))
save(r/'artifacts/candy-scope6e-v3-runtime-qualification.json',dict(candidate=sha,status='PARTIAL / NOT INTEGRATED QUALIFIED',
 extractedRuntime=runtime,repositoryScope6CRegressions='PASS in fresh 287/287 suite; injected fixture coverage is not genuine GPU execution.',
 abruptIntegratedNativeRecovery='NOT RUN',sustainedNativeRuntimeRetention='NOT RUN',persistentNativeWorkerProtocol='OUT OF SCOPE / NOT INTRODUCED'))
save(r/'artifacts/candy-scope6e-v3-native-qualification.json',dict(candidate=sha,status='BLOCKED',
 environmentObservation=dict(device='NVIDIA GeForce RTX 5060',memoryMiB=8151,computeCapability='12.0',
 command='wsl.exe -d Ubuntu --exec /usr/lib/wsl/lib/nvidia-smi --query-gpu=index,name,memory.total,compute_cap --format=csv,noheader,nounits --id=0'),
 qualificationPrerequisite=native,STATIC='NOT QUALIFIED IN V3',INCREMENTAL='NOT QUALIFIED IN V3',
 nativeJobsExecuted=0,mocksOrCpuSubstitutesUsed=False,sourceModified=False,
 partialPreparation='Two additive deployment attempts retained; initial static source/Makefile raw Git bytes differed from independently qualified CRLF bytes but normalized to the same Git blobs. Fresh qualified-byte deployment then stopped at missing evidence; no source or record was changed.',
 candidateVectorOptimization='Qualified source/binary hashes were checked during preparation; no live execution or performance confirmation claimed.'))
save(r/'artifacts/candy-scope6e-v3-soak.json',dict(candidate=sha,status='NOT RUN / BLOCKED',
 totalSubmittedJobs=0,completedJobs=0,STATIC=0,INCREMENTAL=0,retainedTerminalJobs=None,retainedArtifacts=None,
 cleanupExpiryBehavior='NOT MEASURED FOR INTEGRATED NATIVE RUN',restart='Extracted CPU/browser-source Runtime auth restart PASS only',
 reconnect='Extracted authenticated discovery PASS only',staleAuthority='Extracted stale token rejected (401); integrated native job/result recovery not run',
 reason='Final integrated prerequisites failed; no native retention or scale claim.',claimsBeyondNativeAdmission=False))
security='''# Scope 6E V3 security status and limits

Candidate: `e84f06cdaa750803a06007ade63124b6bce693c8`.

Package adversarial regressions: **PASS in the fresh clean-repository full suite**. `candy-scope6e-package-input.test.mjs` confirms committed source authority, arbitrary untracked/dirty/EOL exclusion, exact synthetic binary blobs, independent commit membership/content checks, no-Git fail-closed behavior, explicit snapshots and structural-only labeling. `candy-scope6e-package.test.mjs` confirms local native-install/root artifacts exclusion, canonical production acceptance, trailing-dot/space, mixed/backslash, traversal and absolute path rejection, controls/illegal characters, symlink/special/mode/duplicate/case/CRC guards and the actual Windows extraction guard. These are real executions of the committed tests, recorded in `candy-scope6e-v3-work/repo-gate-1.log`; they do not substitute for live GPU or browser integration.

Focused review of the executed package/authentication boundary found no unresolved Critical/High security finding. The producer pins a commit before enumerating its raw tree/blobs, validates raw paths/types and blob identity, sanitizes Git overrides and does not silently walk a filesystem. The independent verifier derives expected paths and hashes from external trusted Git metadata and labels structural-only results. The extracted Runtime restricts binding to loopback, authenticates protected routes and does not advertise missing CUDA qualification. Fresh health/auth/discovery/restart checks confirmed 401 for absent/stale credentials, new session/credentials and clean shutdown. Ordinary native binding requires exact source/binary/record/evidence/tag/environment identity; missing persisted evidence was not bypassed.

The new extracted-suite failure is a non-security caller/compatibility defect: a legacy test omits explicit snapshot mode. The fail-closed producer behavior is correct. This report does not reclassify either historical package NON-PASS or the security-infrastructure failure as successful.

**Full integrated substantive product security qualification is NOT COMPLETED**, because integrated browser/native/soak execution could not be qualified. No unresolved Critical/High security issue was identified in the bounded review, but this is not a completed integrated security PASS. The requested final substantive-product-security PASS wording is therefore not asserted.

**Automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED.** The explicitly accepted historical checkpoint-lifecycle/completion-ordering infrastructure exception remains unchanged and does not waive any product finding. No Codex Security tool, scan, completion or sealing was invoked. Missing native qualification evidence is a separate local prerequisite; it is not covered by that exception.
'''
text(r/'artifacts/candy-scope6e-v3-security-review.md',security)
report=f'''# Scope 6E V3 final integrated qualification

{verdict}

Recorded: {recorded}. Branch: `{branch}`. HEAD and origin branch: `{sha}`. Package-input qualified tag resolves to the same SHA. The production/native Scope 6D tags resolve to the requested `c294ed0cea093bb8933d06e6e23177a7f1409952` and `f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0` anchors.

## Exact blocking findings

1. **The unmodified extracted-package `npm.cmd test` fails.** It discovers 287 files and passes 47 before failing at `tests/candy-scope6a-release.test.mjs:32`. That caller invokes `qualify-scope6a-package.py` without `--source-mode snapshot` in a package with no `.git`. Its now-correct default Git input policy rejects missing metadata. The same helper succeeds when explicitly invoked in snapshot mode as a separate diagnostic. The failed suite was not retried with edits, hidden Git metadata, environment workarounds or a weakened test. Evidence: `candy-scope6e-v3-work/extract-gate-1.log`, `extracted-followup.json`, `explicit-snapshot-helper.json`, and `blockers.json`.

2. **Ordinary incremental native qualification lacks persisted prerequisite evidence.** The populated witness's exact incremental record references five missing files: native, memcheck, racecheck, initcheck and synccheck qualification JSON. The binary/source/record exist, but production binding also requires those exact evidence bytes. Their absence was recorded; no discovery/runner injection or mock native success was used. Evidence: `candy-scope6e-v3-work/native-preparation-blocker.json`.

No corrective source/test/native/policy edit was authorized or made. This is a final NON-PASS qualification record, not a product fix or a promotion approval.

## Gates that passed

The initial V3 tracked/staged state was clean, with no inherited untracked Scope 6D scripts or install directory. Live origin and local tags/refs matched the requested baseline.

The first hard package gate **passed**: clean and actual populated read-only worktrees produced byte-identical archives from the exact committed implementation/revision and equal `product` root. SHA256 `{archive['sha256']}`; **{archive['bytes']:,} bytes; 940 entries; 884 files; 56 directories**. All 22 historical untracked scripts remain excluded, despite 555 observed shared checkout LF/CRLF differences. Local qualification/install namespaces and root artifacts are absent; legitimate native source and `candy-runtime/src/artifacts/artifactStore.js` are present. Both independent verifier results are commit-bound to the exact SHA. Both historical blocker classes remain closed. Fresh committed synthetic binary/input/alias regressions passed in the repository full suite.

Fresh repository gates **all passed**: npm ci; **287/287 discovered test files**; lint; build; build:github; production audit **0 vulnerabilities**; git diff --check. See `candy-scope6e-v3-test-results.json` and hashed raw logs.

The archive was extracted to a new directory outside every repository: `{ext['root']}`. Its npm ci, lint, build, build:github and production audit **0 vulnerabilities** passed. Its required full test suite failed as detailed above; the extracted package is therefore **NON-PASS**. Later independent diagnostics did not alter or replace the failed result.

Fresh extracted Runtime startup, health (200), absent-credential rejection (401), new authentication, authenticated discovery, clean shutdown, fresh restart/session/credentials, stale-token rejection (401), fresh discovery and final shutdown **passed**. CUDA was truthfully unavailable in this Git/evidence-free portable extraction. No old token, pairing file or session was reused. See `candy-scope6e-v3-work/extracted-runtime.json`.

All five exact-SHA remote checks **PASS**: CPU push, CPU pull_request, Ubuntu, macOS and Windows. The prior exact-SHA CI record is reused only as explicitly permitted, with its source SHA256 and run/job/check identities in `candy-scope6e-v3-remote-ci.json`. No earlier-SHA CI was used.

## Integrated gates not qualified

Scope 6A/6B/6C committed repository regression tests passed, including transport/message/URL cleanup, preview/fingerprint/cache/history, FIFO/admission/retention/recovery fixtures and authentication/session revocation. Fixture coverage is reported separately from real native/browser execution.

A fresh Studio/Vite process started successfully and was stopped after the blockers were confirmed. A production live-runtime deployment was attempted using additive archive copies and existing byte-qualified native installation files. Static source/Makefile checkout representation was confirmed to normalize to the same committed blobs, while exact historical qualification bytes were preserved; no existing source file was edited. The qualified deployment could not finish because the five native evidence files were missing. The fresh service did not start; no credential or previous process was reused. Partial additive deployments remain as attempt evidence.

The B5/browser interactive scalability flow, visible end-to-end DynamicHypergraph Analyze/Apply/Undo/Assistant/parser flow, genuine STATIC/INCREMENTAL CUDA execution, integrated abrupt recovery and native long-session soak were **NOT COMPLETED / NOT QUALIFIED**. **Zero genuine V3 CUDA jobs were submitted.** No GPU result, signed-delta correctness, live candidate-vector optimization, long-session retention, browser screenshot or scale claim is fabricated. Available GPU detection alone is not native qualification.

## Security and preserved limits

Package adversarial regression **PASS** and extracted live authentication/restart **PASS**. Full integrated substantive security qualification remains **NOT COMPLETED**. See `candy-scope6e-v3-security-review.md`. **Automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED** under the unchanged historical accepted infrastructure exception; that exception does not waive product findings or missing native evidence. No Codex Security automation was invoked.

Generated Custom Parser code still requires human review; model-generated behavior is not automatically trusted. Public CPU CI is distinct from GPU qualification. Browser scale remains limited to measured/admitted workloads; no V3 B5 or precise heap telemetry claim is made. Persistent native workers remain outside Scope 6 and no protocol was introduced. No native workload beyond its admission envelope is qualified.

## Preservation and stop

Preservation checks passed: {pres['primaryTrackedUnchanged']} primary tracked files, {pres['priorPrimaryArtifactsUnchanged']} prior primary artifacts, {pres['priorPopulatedArtifactsUnchanged']} prior populated artifacts, {pres['populatedTrackedAnd22ScriptsUnchanged']} populated tracked/script files and {pres['populatedInstallationFilesUnchanged']} populated native/.local files retained exact bytes. Both indexes and all refs are unchanged. Historical 937-vs-941 and 939-vs-961 NON-PASS evidence, corrections, alias/security infrastructure history and prior qualification evidence were not rewritten. Evidence absent before this run was not represented as present.

The fresh Studio was stopped; both extracted Runtime instances closed cleanly. No tag, commit, staging, push, merge or main change occurred. Stop at this NON-PASS report. A separate authorized corrective review and restoration of exact native evidence are required before a fresh integrated attempt can qualify.
'''
text(r/'artifacts/candy-scope6e-v3-integrated-qualification-report.md',report)
paths=[p for p in (r/'artifacts').rglob('*') if p.is_file() and (p.is_relative_to(o) or p.is_relative_to(r/'artifacts/v3') or p.is_relative_to(r/'artifacts/v3run') or p.name.startswith('candy-scope6e-v3-'))]
inventory=[dict(path=p.relative_to(r).as_posix(),bytes=p.stat().st_size,sha256=h(p)) for p in sorted(paths)]
save(r/'artifacts/candy-scope6e-v3-final-inventory.json',dict(recordedAt=recorded,verdict=verdict,candidate=sha,branch=branch,
 blockers=blockers,packageGate='PASS',bothHistoricalPackageBlockersClosed=True,repositoryGates='PASS',tests=dict(discovered=287,passed=287),
 extractedPackage='NON-PASS',extractedRuntimeSmoke='PASS',remoteExactShaCI='PASS',
 integratedBrowser='NOT COMPLETED',genuineCUDA='NOT QUALIFIED',nativeJobsSubmitted=0,integratedSoak='NOT RUN',
 substantiveIntegratedSecurity='NOT COMPLETED',packageAdversarialMatrix='PASS',automatedCodexSecuritySeal='UNAVAILABLE / NOT COMPLETED',
 preservation=pres,sourceChanges=[],staged=False,committed=False,pushed=False,tagged=False,merged=False,mainModified=False,
 evidenceFiles=inventory,selfDigestExcluded=True))
print(json.dumps(dict(verdict=verdict,blockers=[b['id'] for b in blockers],preservation=pres,evidenceFiles=len(inventory)+1)),flush=True)
