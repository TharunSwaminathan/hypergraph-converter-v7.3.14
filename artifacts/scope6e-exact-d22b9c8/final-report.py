"""Seal no tooling state: record exact-SHA closure from verified evidence only."""
import hashlib,json,pathlib,subprocess,zipfile
from datetime import datetime,timezone
root=pathlib.Path.cwd();out=root/'artifacts/scope6e-exact-d22b9c8';q=out/'qualification';art=root/'artifacts'
candidate='d22b9c89f79446fbfea2480e98e807f8da4dfbf4';baseline='c294ed0cea093bb8933d06e6e23177a7f1409952'
branch='candy-integration-scope6e-package-corrective'
verdict='READY FOR SCOPE 6E PACKAGE CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf8'))
def git(*a):return subprocess.check_output(['git',*a],cwd=root).decode('utf8').strip()
def save(path,data):
    with path.open('x',encoding='utf8',newline='\n') as f:json.dump(data,f,indent=2);f.write('\n')
remote=read(out/'remote/closure.json');gates=read(q/'gates.json');package=read(q/'package.json')
matrix=read(q/'adversarial-matrix.json');source=read(q/'exact-source.json');state=read(q/'prechange.json')
preservation=read(q/'preservation.json');security=read(out/'security-exception-binding.json')
accept_path=art/'candy-scope6e-package-corrective-human-exception-acceptance.json';accept=read(accept_path)
exception_path=art/'candy-scope6e-package-corrective-security-infrastructure-exception.json';exception=read(exception_path)
paths=['docs/PORTABLE_LOCAL_INSTALL_POLICY.md','scripts/package-portable-source.py','scripts/verify-portable-archive.py','tests/candy-scope6e-package.test.mjs']
assert git('branch','--show-current')==branch and git('rev-parse','HEAD')==candidate
assert git('rev-parse','origin/'+branch)==candidate
assert not git('diff','HEAD','--name-only') and not git('diff','--cached','--name-only')
assert git('diff','--name-only',baseline,candidate).splitlines()==paths
live_remote=git('ls-remote','origin','refs/heads/'+branch)
assert live_remote.split()[0]==candidate
assert remote['allFivePassExactSha'] and len(remote['requiredChecks'])==5
assert all(c['status']=='PASS' and c['candidateSha']==c['jobHeadSha']==c['checkHeadSha']==candidate for c in remote['requiredChecks'])
assert remote['pullRequest']['headSha']==candidate and remote['pullRequest']['draft']
assert gates['candidate']==package['candidate']==security['candidate']==source['candidate']==candidate
assert gates['allPass'] and all(r['exitCode']==0 for r in gates['results'])
test=next(r for r in gates['results'] if r['command']==['npm.cmd','test'])
assert test['passed']==test['discovered']>=286
assert package['identicalBytes'] and package['allCountsIdentical']
assert matrix['allExpectedDecisions'] and matrix['originalLowBypassClosed']
assert matrix['rejected']==31 and matrix['accepted']==6 and matrix['actualWindowsExtractionProofs']==16
assert accept['humanExceptionAcceptance']['status']=='ACCEPTED' and not accept['humanExceptionAcceptance']['productSecurityFindingsWaived']
assert not accept['automatedCodexSecuritySeal']['completed'] and not exception['toolingStatus']['automatedSealCompleted']
assert security['unresolvedFindings']==dict(critical=0,high=0,medium=0,low=0)
for entry in accept['acceptedExceptionEvidence']:assert sha(root/entry['path'])==entry['sha256']
for row in accept['proposedProductInventory']:
    assert sha(root/row['path'])==row['worktreeSha256']
    assert git('rev-parse',candidate+':'+row['path'])==row['prospectiveGitBlob']==source['files'][row['path']]['gitBlob']
for p,h in state['trackedSha256'].items():assert sha(root/p)==h
for p,h in state['priorArtifactSha256'].items():assert sha(root/p)==h
assert git('show-ref')==state['refs'] and sha(pathlib.Path(git('rev-parse','--git-path','index')))==state['indexSha256']
subprocess.run(['git','diff','--check'],cwd=root,check=True)
raw=[]
for case in package['cases']:
    p=root/case['path'];assert sha(p)==case['sha256'] and p.stat().st_size==case['bytes']
    raw.append(p.read_bytes())
assert len(raw)==2 and raw[0]==raw[1]
numstat=[line.split('\t') for line in git('diff','--numstat',baseline,candidate).splitlines()]
assert sum(int(r[0]) for r in numstat)==334 and sum(int(r[1]) for r in numstat)==4
inventory=[]
for additions,deletions,p in numstat:
    inventory.append(dict(path=p,status='added' if p in [paths[0],paths[3]] else 'modified',
      insertions=int(additions),deletions=int(deletions),committedGitBlob=git('rev-parse',candidate+':'+p),
      worktreeSha256=sha(root/p),exactExportSha256=source['files'][p]['sha256'],exactExportBytes=source['files'][p]['bytes']))
now=datetime.now(timezone.utc).isoformat()
remote_path=art/'candy-scope6e-package-corrective-remote-ci-closure.json'
package_path=art/'candy-scope6e-package-corrective-exact-sha-package.json'
inventory_path=art/'candy-scope6e-package-corrective-exact-sha-final-inventory.json'
report_path=art/'candy-scope6e-package-corrective-final-closure-report.md'
assert not any(p.exists() for p in [remote_path,package_path,inventory_path,report_path]),'Additive closure paths must be new'
outputs=[remote_path,package_path,inventory_path,report_path]
preexisting={p.relative_to(root).as_posix():sha(p) for p in art.rglob('*') if p.is_file()}
remote_record=dict(remote,closureVerifiedAt=now,liveGitRemoteObservation=live_remote,readOnly=True)
save(remote_path,remote_record)
save(package_path,dict(package,closureVerifiedAt=now,adversarialMatrix=dict(path=(q/'adversarial-matrix.json').relative_to(root).as_posix(),
     sha256=sha(q/'adversarial-matrix.json'),unsafeRejected=31,legitimateAccepted=6,actualWindowsExtractionProofs=16),
     exactSourceEvidence=dict(path=(q/'exact-source.json').relative_to(root).as_posix(),sha256=sha(q/'exact-source.json'))))
save(inventory_path,dict(recordedAt=now,candidate=candidate,baseline=baseline,branch=branch,head=candidate,
     originTrackingSha=candidate,liveRemoteSha=candidate,committedPaths=inventory,files=4,insertions=334,deletions=4,
     committedArtifactsPaths=[],trackedChanges=[],stagedChanges=[],untrackedEvidenceAllowed=True,
     excludedFromFutureProductCommits=['artifacts/**'],protectedNativeAndProductionPathsUnchanged=True,
     preservation=preservation,security=security,readiness=verdict))
case=package['cases'][0]
text=f'''# Scope 6E package corrective — final exact-SHA closure

**{verdict}**

Recorded {now}. Repository `{root}`; branch `{branch}`. HEAD, local `origin/{branch}` and the independently queried live GitHub branch all equal **`{candidate}`**. Starting Scope 6D baseline: `{baseline}`. The worktree has no tracked or staged changes; only untracked qualification evidence is present.

## Exact committed boundary

Git reports **4 files changed, 334 insertions, 4 deletions** between the baseline and candidate. No `artifacts/**` path is in that committed delta.

| Committed path | Insertions | Deletions | Git blob |
| --- | ---: | ---: | --- |
'''
for row in inventory:text+=f"| `{row['path']}` | {row['insertions']} | {row['deletions']} | `{row['committedGitBlob']}` |\n"
text+=f'''
The exact candidate blobs match the previously accepted corrective's prospective Git blob identities. Current product worktree SHA256 values also match that accepted record. No native/CUDA algorithm, runtime job, graph, candy, persistence or visualization source changed.

## Independent exact-SHA remote CI

All five required results were independently fetched from GitHub, not inferred from user statements or reused from the baseline. Every workflow run, job and matching check-run binds to `{candidate}`, is completed and successful, and every substantive recorded job step succeeded. The macOS/Windows job conclusions were inspected individually despite their workflow's continue-on-error configuration.

| Required result | Event | Run ID | Job/check ID | Result |
| --- | --- | --- | --- | --- |
'''
for c in remote['requiredChecks']:
    text+=f"| {c['label']} | {c['event']} | [{c['workflowRunId']}]({c['workflowRunUrl']}) | [{c['jobId']}]({c['jobUrl']}) | PASS |\n"
text+=f'''
[Draft PR #{remote['pullRequest']['number']}]({remote['pullRequest']['url']}) remains draft and unmerged, with this exact head SHA and base `{remote['pullRequest']['baseSha']}` on `main`. The GitHub connector returned repository 404 responses; the fallback used authenticated read-only GitHub REST through the repository's existing Git credentials. Credential material was never printed or retained. Raw API branch, PR, run, job and check evidence is under `scope6e-exact-d22b9c8/remote/`; the bound summary is `{remote_path.name}`. No check was rerun or remote object changed by this task.

## Fresh immutable-candidate gates

The candidate was freshly exported using `git archive {candidate}` into a disposable `product` directory with no candidate overlays. Every exported file's canonical Git blob was checked against `git ls-tree` for this commit before execution; every tracked export byte remained unchanged after the gates. Fresh `npm.cmd ci` installed dependencies only in that disposable export. All requested gates then ran there from the candidate's source, with `git diff --check` reconfirmed on the clean persisted worktree.

| Gate | Result |
| --- | --- |
| `npm.cmd test` | PASS, {test['passed']}/{test['discovered']} discovered test files |
| `tests/candy-scope6e-package.test.mjs` | PASS in the full suite and explicit focused command |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS, 0 production vulnerabilities |
| `git diff --check` | PASS |
| Exact-candidate adversarial API/CLI matrix | PASS, 31 unsafe rejections and 6 legitimate acceptances |
| Actual Windows extraction guard proof | PASS, 16 representative cases |

Full commands, exit codes, durations and log hashes are in `scope6e-exact-d22b9c8/qualification/gates.json`. The expected bundle-size advisory remains informational; both builds passed. Test counts refer to discovered files, not individual assertions.

## Exact-commit package identity

Fresh committed-clean and committed-populated witnesses have identical bytes and member content. Their shared authoritative identity is:

- SHA256: `{case['sha256']}`
- Byte size: **{case['bytes']:,}**
- ZIP entries: **{case['entries']}**
- Files: **{case['files']}**
- Directories: **{case['directories']}**

Both witnesses start from the exact committed candidate, with no source overlays. Only the populated copy receives synthetic local qualification state. Both production native source trees, `candy-runtime/src/artifacts/artifactStore.js`, and the corrective test are present and bound to committed source. Canonical Scope 6D local installations, root `artifacts/**`, `.local`, native build outputs, dependencies/caches, credential/token filenames and synthetic temporary qualification state are absent. All expected exclusion markers are absent from every packaged file. Producer and independent verifier accept both corrected archives.

Git archive applies committed attributes and this Windows checkout's EOL policy. Canonical Git blobs and raw exported/package SHA256 values are recorded separately; documentation/test files exported with CRLF differ in raw bytes from their earlier precommit working copies while retaining the identical accepted Git blobs. This exact-commit export's new archive identity is authoritative for this run; no earlier archive identity is substituted. No product source was edited to change line endings.

The exact-candidate matrix preserves the prior corpus: canonical installation contamination, trailing-dot/space aliases, mixed/repeated/backslash separators, traversal, absolute/UNC names, relevant case spellings, symlink/special entries and credential/executable aliases are rejected; canonical native paths and nested legitimate lookalikes are accepted. The explicit corrective regression also verifies unsafe writable/executable/ordinary/directory modes, duplicates/case collisions and CRC corruption. API and CLI checks use the exact export's verifier. Raw paths, Windows-normalized/extracted paths, decisions and fresh crafted witnesses are retained in the new qualification directory.

## Accepted security-infrastructure exception

**Substantive product security qualification PASS under an explicitly accepted security-infrastructure exception; automated Codex Security completion seal UNAVAILABLE.**

The unchanged additive exception and human-acceptance records confirm substantive security review completion with **0 Critical, 0 High, 0 Medium and 0 Low unresolved findings**, the previous Low/P3 CWE-180 bypass no longer reproducing, and explicit human acceptance limited to the reproducible checkpoint-lifecycle / completion-ordering infrastructure failure. No product-security finding was waived. The accepted product hashes/Git blobs were independently bound to this exact candidate. See `scope6e-exact-d22b9c8/security-exception-binding.json`.

No Codex Security scan, completion operation or state recovery was invoked. The automated seal is **UNAVAILABLE / NOT COMPLETED**, never PASS. `.codex` state was not modified. This closure does not rewrite prior NON-PASS or pre-seal evidence.

## Additive evidence and hard stop

The new final inventory is `{inventory_path.name}`; the earlier `candy-scope6e-package-corrective-final-inventory.json` is preserved unchanged. The remote summary, exact-SHA package record and this report are also additive. All prior evidence and all tracked product bytes, Git refs and index bytes were checked for preservation.

This is readiness for the package-corrective qualification tag and main promotion only. **No tag, main promotion, merge, commit, stage or push was performed.** PR #7 remains draft. Scope 6E integrated qualification has not resumed and is not declared qualified by this report. Stop after this closure report.
'''
with report_path.open('x',encoding='utf8',newline='\n') as f:f.write(text)
assert all(sha(root/p)==h for p,h in preexisting.items())
assert all(sha(root/p)==h for p,h in state['trackedSha256'].items())
assert all(sha(root/p)==h for p,h in state['priorArtifactSha256'].items())
assert git('show-ref')==state['refs'] and sha(pathlib.Path(git('rev-parse','--git-path','index')))==state['indexSha256']
assert not git('diff','HEAD','--name-only') and not git('diff','--cached','--name-only')
assert set(p.relative_to(root).as_posix() for p in art.rglob('*') if p.is_file())-set(preexisting)=={p.relative_to(root).as_posix() for p in outputs}
print(json.dumps(dict(verdict=verdict,candidate=candidate,remoteChecks=5,tests=test['passed'],packageIdentity={k:case[k] for k in ['sha256','bytes','entries','files','directories']},
   report=str(report_path),inventory=str(inventory_path),priorEvidencePreserved=True,noStageCommitPushTagMainMerge=True)))
