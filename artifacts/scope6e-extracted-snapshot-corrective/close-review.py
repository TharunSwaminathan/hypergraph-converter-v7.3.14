import hashlib,json,os,pathlib,subprocess
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/scope6e-extracted-snapshot-corrective'
base='e84f06cdaa750803a06007ade63124b6bce693c8';p='tests/candy-scope6a-release.test.mjs';branch='candy-integration-scope6e-extracted-snapshot-corrective'
verdict='READY TO CREATE SCOPE 6E EXTRACTED SNAPSHOT CORRECTIVE CANDIDATE COMMIT'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
def h(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name):return json.loads((o/name).read_text(encoding='utf8'))
def save(name,v):
    with (o/name).open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def git(root,*a):return subprocess.check_output(['git',*a],cwd=root,env=env).decode('utf8').strip()
def index(root):
    x=pathlib.Path(git(root,'rev-parse','--git-path','index'));return x if x.is_absolute() else root/x
b=read('before.json');candidate=read('candidate-input.json');repo=read('repository-gates.json');ext=read('extracted-gates.json');repro=read('package-reproduction.json');contract=read('contract-review.json')
assert git(r,'rev-parse','HEAD')==base and git(r,'branch','--show-current')==branch
assert git(r,'diff','--name-only').splitlines()==[p] and not git(r,'diff','--cached','--name-only')
assert git(r,'diff','--numstat')=='19\t2\t'+p
assert h(r/p)==candidate['sha256'] and git(r,'hash-object','--path='+p,p)==candidate['prospectiveGitBlob']
assert repo['status']==ext['status']==repro['status']==contract['status']=='PASS'
tests=[]
for group in [repo,ext]:
    assert all(row['exitCode']==0 and h(r/row['log'])==row['sha256'] for row in group['results'])
    t=next(row for row in group['results'] if row['command']==['npm.cmd','test']);assert t['allDiscoveredPassed'];tests.append(t)
    audit=next(row for row in group['results'] if row['command']==['npm.cmd','audit','--omit=dev']);assert audit['productionVulnerabilities']==0
assert tests[0]['passed']==tests[0]['discovered']==tests[1]['passed']==tests[1]['discovered']
for group in [repro['cases'],repro['drafts']]:
    a,c=group;assert (r/a['path']).read_bytes()==(r/c['path']).read_bytes()
    assert all(h(r/row['path'])==row['sha256'] for row in group)
assert repro['realWitnessesIdenticalBytes'] and repro['reviewedCandidateProjectionsIdenticalBytes']
for f,digest in b['trackedSha256'].items():
    if f!=p:assert h(r/f)==digest,f
for field in ['trackedAnd22ScriptsSha256','localSha256','artifactSha256']:
    for f,digest in b['old'][field].items():assert h(old/f)==digest,f
assert git(r,'show-ref')==b['primaryRefs'] and h(index(r))==b['primaryIndexSha256']
assert git(old,'show-ref')==b['old']['refs'] and h(index(old))==b['old']['indexSha256']
assert git(old,'status','--short')==b['old']['status'] and git(old,'branch','--show-current')==b['old']['branch'] and git(old,'rev-parse','HEAD')==b['old']['head']
pres=dict(status='PASS',primaryTrackedExceptApprovedTestUnchanged=len(b['trackedSha256'])-1,
 originalTrackedAnd22UntrackedScriptsUnchanged=len(b['old']['trackedAnd22ScriptsSha256']),
 originalLocalInstallationFilesUnchanged=len(b['old']['localSha256']),originalPriorArtifactsUnchanged=len(b['old']['artifactSha256']),
 originalIndexRefsStatusBranchHeadUnchanged=True,cloneIndexAndRefsUnchanged=True,
 originalPopulatedWitnessReadOnly=True,oldHistoryPreserved=True,sourcePolicyNativeRuntimeApplicationAndManifestChanges=False,
 staged=False,committed=False,pushed=False,tagged=False,merged=False,mainModified=False,
 missingNativeEvidenceFabricatedOrReconstructed=False,integratedQualificationResumed=False,codexSecurityAutomationInvoked=False)
save('preservation.json',pres)
patch=subprocess.check_output(['git','diff','--binary','--',p],cwd=r,env=env)
with (o/'candidate.patch').open('xb') as f:f.write(patch)
recorded=datetime.now(timezone.utc).isoformat();count=tests[0]['passed']
inventory=dict(recordedAt=recorded,verdict=verdict,baseline=base,branch=branch,workingRepository=str(r),readOnlyOriginalRepository=str(old),
 productPathCount=1,additions=19,deletions=2,proposedCommitFiles=[dict(path=p,status='modified tracked',
   classification='Narrow self-test caller and related regression assertions',reason='Explicit snapshot opt-in for intentionally Git-free self-test; retain default Git authority and assert verification level/source identity plus no-Git fail-closed behavior.',
   bytes=(r/p).stat().st_size,sha256=h(r/p),prospectiveGitBlob=candidate['prospectiveGitBlob'],additions=19,deletions=2)],
 evidenceExcludedFromProposedCommit='All artifacts/**, candidate.patch, reports, ZIPs, logs and helper scripts are validation evidence only; none staged.',
 noProtectedPathDelta=True,noProductionPolicyChange=True,allPriorAssertionsPreserved=True,
 repositoryTests=dict(passed=count,discovered=count),extractedTests=dict(passed=tests[1]['passed'],discovered=tests[1]['discovered']),
 repositoryGates='PASS',extractedGates='PASS',bothProductionAudits=0,realBaselineArchivesByteIdentical=True,
 reviewedCandidateSnapshotsByteIdentical=True,futureExactShaQualificationRequired=True,candidateCommitCreated=False,
 focusedSecurityReview='PASS',unresolvedCriticalHigh=0,automatedCodexSecuritySeal='UNAVAILABLE / NOT COMPLETED',preservation=pres,
 patch=dict(path=(o/'candidate.patch').relative_to(r).as_posix(),bytes=len(patch),sha256=hashlib.sha256(patch).hexdigest()))
save('proposed-commit-inventory.json',inventory)
controls=[
 dict(requirement='Git-backed helper invocation without snapshot arguments remains commit-authoritative',result='PASS',evidence='repository full suite executes the modified caller with no snapshot args; all three helper reports must be commit-bound and match HEAD.'),
 dict(requirement='Git-free helper default fails closed',result='PASS',evidence='Both repository and extracted self-tests invoke the helper against newly extracted no-Git output with no opt-in; require exit 1, metadata error and absent success report.'),
 dict(requirement='Git-free extracted self-test explicitly requests snapshot and passes',result='PASS',evidence='Full extracted suite passes from new no-Git directory; modified caller explicitly passes --source-mode snapshot.'),
 dict(requirement='Snapshot cannot masquerade as commit-bound qualification',result='PASS',evidence='Caller requires structural-only/null sourceCommit for every snapshot helper case; independent baseline commit-bound verification rejects precisely the reviewed candidate changed test.'),
 dict(requirement='Existing package-input contamination/path/alias regressions pass',result='PASS',evidence='Unmodified candy-scope6e-package-input and candy-scope6e-package tests pass in both full suites; fresh real Git witnesses exclude all 22 scripts/local-install/root evidence and retain canonical production paths.')]
save('regression-matrix.json',dict(status='PASS',baseline=base,controls=controls,productPathsChanged=[p]))
save('security-review.json',dict(status='PASS',baseline=base,reviewedProductPaths=[p],unresolvedCritical=0,unresolvedHigh=0,
 method='Focused manual semantic review and fresh committed-policy regression executions; caller-only uncommitted correction.',
 review='security-review.md',reviewSha256=h(o/'security-review.md'),codexSecurityAutomationInvoked=False,
 automatedCodexSecuritySeal='UNAVAILABLE / NOT COMPLETED',historicalExceptionRewritten=False,missingNativeEvidenceTouched=False))
committed=repro['cases'][0];draft=repro['drafts'][0]
lines=['# Extracted snapshot self-test corrective — candidate review','',verdict,'',
 f'Recorded: {recorded}. Branch `{branch}` at baseline `{base}`. The candidate remains uncommitted.',
 '',f'Working clone: `{r}`. The original populated repository `{old}` remains read-only. A separate local clone was necessary because the instructions name that same original repository both as the corrective repository and as a read-only witness. The requested branch is checked out in the clone; no original branch, index, ref, source or historical state was changed.',
 '','## Contract and correction','',
 '`diagnosis.md` traces both contracts and the helper. The helper correctly defaults to pinned Git inventory/raw blobs and fails when Git is unavailable. Explicit snapshots remain supported for reviewed Git-free self-tests. The old test omitted that explicit mode in extracted source. The correction selects snapshot mode only when the self-test project has no root `.git` entry; Git-backed invocations retain the helper default. Present but broken metadata does not trigger a snapshot retry.',
 '', '**Exact proposed commit inventory: one path, 19 additions / 2 deletions — `tests/candy-scope6a-release.test.mjs`.** All prior assertion lines remain unchanged. New assertions enforce commit-bound/current-HEAD results in Git-backed runs, structural-only/null-commit results in snapshot runs, and failure with no success report for a no-Git helper call that omits the snapshot opt-in. Producer, verifier, helper, contracts, package files, native/CUDA, Runtime and application source are unchanged.',
 '', f"Candidate file SHA256: `{candidate['sha256']}`; prospective Git blob: `{candidate['prospectiveGitBlob']}`. `proposed-commit-inventory.json` and `candidate.patch` bind the exact proposed change. All artifact evidence is excluded from the proposed product commit.",
 '','## Fresh product and extracted gates','','| Gate | Working clone | New Git-free extraction |','| --- | --- | --- |',
 f'| npm test | PASS — {count}/{count} discovered files | PASS — {tests[1]["passed"]}/{tests[1]["discovered"]} discovered files |',
 '| lint | PASS | PASS |','| build | PASS | PASS |','| build:github | PASS | PASS |','| production audit | PASS — 0 vulnerabilities | PASS — 0 vulnerabilities |','| git diff --check | PASS | Not applicable without Git |',
 '', 'Fresh npm ci passed in the working clone and extraction. Logs, exit codes, discovered test counts, timing and digests are in `repository-gates.json` and `extracted-gates.json`. `regression-matrix.json` maps all five requested regression requirements. Both full suites include the unchanged contamination and path-alias tests. No test was disabled, assertion weakened, Git metadata injected into extraction, or package-input fallback introduced.',
 '',f"The extracted full suite ran in `{ext['root']}` outside every repository, with no `.git` and no root evidence at extraction. Its test bytes exactly match the one externally recorded candidate overlay.",
 '','## Reproducibility and qualification boundary','',
 f"Fresh default Git-mode packages from the actual clean clone and actual populated read-only witness are byte-identical: SHA256 `{committed['sha256']}`, {committed['bytes']:,} bytes, {committed['entries']} entries, {committed['files']} files, {committed['directories']} directories. Both independently verify as commit-bound to `{base}`. All 22 historical untracked Scope 6D scripts, local-install qualification state and root artifacts remain absent; legitimate native source and Runtime artifactStore remain included.",
 '', 'The default Git release correctly excludes the uncommitted correction. To validate this candidate without weakening release authority, each real committed inventory was separately extracted to a reviewed temporary source tree, overlaid with exactly the same approved test bytes, and packaged with explicit snapshot mode. Those two reviewed candidate projections are also byte-identical.',
 '',f"Reviewed candidate snapshot: SHA256 `{draft['sha256']}`, {draft['bytes']:,} bytes, {draft['entries']} entries, {draft['files']} files, {draft['directories']} directories. It verifies as structural-only, with null sourceCommit. Baseline commit-bound verification rejects exactly `product/{p}`, confirming that the draft is not falsely attested as baseline content. The fresh extracted full suite used this corrected candidate archive. A future candidate commit still needs exact-SHA qualification; no new commit or automated release seal is claimed.",
 '','## Security and preservation','',
 'Focused semantic security review PASS: no unresolved Critical/High issue. No production trust boundary changed. See `security-review.md` and `security-review.json`. **Automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED.** No Codex Security scan/completion/sealing was invoked; the historical accepted exception was not rewritten.',
 '',f"`preservation.json` confirms {pres['primaryTrackedExceptApprovedTestUnchanged']} other clone tracked files, {pres['originalTrackedAnd22UntrackedScriptsUnchanged']} original tracked/script files, {pres['originalLocalInstallationFilesUnchanged']} original local-install files and {pres['originalPriorArtifactsUnchanged']} original prior artifacts are byte-identical. Both indexes and all refs are unchanged; the original status, branch and HEAD are unchanged. Neither historical package NON-PASS nor V3 NON-PASS was reinterpreted or overwritten.",
 '', 'The five missing Scope 6D evidence files were not fabricated, reconstructed or replaced. No CUDA execution, native-source change, Runtime restart, Studio/browser integration or integrated Scope 6E qualification was attempted. No staging, commit, push, tag, merge or main change occurred. Stop after this candidate review.',
 '', 'Final evidence hashes: `final-inventory.json`.']
with (o/'corrective-report.md').open('x',encoding='utf8') as f:f.write('\n'.join(lines)+'\n')
evidence=[dict(path=x.relative_to(r).as_posix(),bytes=x.stat().st_size,sha256=h(x)) for x in sorted(o.rglob('*')) if x.is_file()]
save('final-inventory.json',dict(recordedAt=recorded,verdict=verdict,baseline=base,branch=branch,repository=str(r),
 proposedCandidate=inventory,preservation=pres,evidenceFiles=evidence,selfDigestExcluded=True))
print(json.dumps(dict(verdict=verdict,repository=str(r),candidatePaths=[p],repositoryPassed=count,extractedPassed=tests[1]['passed'],evidenceFiles=len(evidence)+1,preservation=pres)),flush=True)
