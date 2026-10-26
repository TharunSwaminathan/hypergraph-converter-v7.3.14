"""Assemble additive closure only after all exact-SHA gates pass."""
import hashlib,json,os,pathlib,subprocess
from datetime import datetime,timezone
r=pathlib.Path.cwd();o=r/'artifacts/scope6e-v2-exact-e84f06c'
sha='e84f06cdaa750803a06007ade63124b6bce693c8';base='d22b9c89f79446fbfea2480e98e807f8da4dfbf4'
branch='candy-integration-scope6e-v2-package-input-corrective'
verdict='READY FOR SCOPE 6E V2 PACKAGE INPUT CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads((o/p).read_text(encoding='utf8'))
def save(p,v):
    with (o/p).open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def git(*args):return subprocess.check_output(['git',*args],cwd=r,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')).decode().strip()
assert git('rev-parse','HEAD')==sha and git('branch','--show-current')==branch
assert not git('diff','--name-only') and not git('diff','--cached','--name-only')
assert git('ls-remote','origin','refs/heads/'+branch).split()[0]==sha
g=read('product-gates.json');delta=read('committed-delta.json');repro=read('package-reproduction.json')
focused=read('focused-regressions.json');wsl=read('wsl-regressions.json');pres=read('preservation.json')
ci=read('remote/closure.json');historical=read('historical-assertions.json')
assert all(p['status']=='PASS' for p in [g,delta,repro,focused,wsl,pres,historical])
assert all(p['candidate']==sha for p in [g,delta,repro,focused,pres,historical,ci])
assert ci['allFivePassExactSha'] and len(ci['requiredChecks'])==5 and all(c['candidateSha']==sha for c in ci['requiredChecks'])
assert len(g['results'])==7 and all(p['exitCode']==0 for p in g['results'])
test=next(x for x in g['results'] if x['command']==['npm.cmd','test'])
audit=next(x for x in g['results'] if x['command']==['npm.cmd','audit','--omit=dev'])
assert test['passed']==test['total']==test['discovered']==287 and audit['productionVulnerabilities']==0
for row in g['results']+focused['results']+wsl['results']:
    assert row.get('candidate',sha)==sha and row['exitCode']==0 and h(r/row['log'])==row['sha256']
assert repro['identicalBytes'] and len(repro['all22Scripts'])==22
assert (o/'clean.zip').read_bytes()==(o/'populated.zip').read_bytes()
archive=repro['cases'][0]
assert archive['entries']==940 and archive['files']==884 and archive['directories']==56
for c in repro['cases']:
    assert h(r/c['path'])==c['sha256']==archive['sha256'] and c['explicitSourceRevision']==sha
    assert c['verifier']['ok'] and c['verifier']['verificationLevel']=='commit-bound' and c['verifier']['sourceCommit']==sha
    assert c['rawGitBlobsIndependentlyCompared']==884
recorded=datetime.now(timezone.utc).isoformat()
controls=[
 ('Arbitrary untracked scripts and allowed-directory files excluded','focused-0.log'),
 ('Dirty text/binary and LF/CRLF checkout bytes have no release authority','focused-0.log'),
 ('All committed binary bytes preserved without text normalization','focused-0.log'),
 ('Legitimate committed scripts/native source and artifactStore included','focused-0.log'),
 ('Git-free default fails closed and preserves existing output','focused-0.log'),
 ('Explicit snapshot mode and structural-only result remain explicit','focused-0.log'),
 ('Independent trusted-commit verifier rejects extra/missing/changed files and extra empty directories','focused-0.log'),
 ('Unsafe committed aliases, links, submodules, case collisions and ambient Git overrides rejected','focused-0.log'),
 ('Native local-install/root artifacts exclusion and canonical positive controls','focused-1.log'),
 ('Trailing-dot/space, mixed/backslash, traversal and absolute aliases rejected','focused-1.log'),
 ('Symlink/special/unsafe modes, duplicates/case, CRC and root controls','focused-1.log'),
 ('Actual Windows extraction guard and prior CWE-180 bypass regression','focused-1.log'),
 ('POSIX unsafe filesystem source aliases fail before replacing output','wsl-python-1.log'),
 ('Historical RC2 source policy and exact permission normalization','focused-2.log; focused-3.log')]
save('input-policy-regressions.json',dict(candidate=sha,recordedAt=recorded,status='PASS',
  controls=[dict(control=c,status='PASS',evidence=e) for c,e in controls],
  windowsExecution='Committed Node wrappers with native Windows Python',
  wslExecution='Unmodified Python bodies extracted from exact committed test blobs; Node launcher unavailable and initial failure retained.',
  historicalAssertionsPreserved=historical['status']=='PASS',precommitResultsReused=False))
save('security-review.json',dict(candidate=sha,baseline=base,recordedAt=recorded,status='PASS',
  method='Focused manual semantic review of exact committed package-input trust boundary and fresh adversarial regression evidence.',
  unresolvedFindings=dict(Critical=0,High=0,Medium=0,Low=0),review='security-review.md',reviewSha256=h(o/'security-review.md'),
  automatedCodexSecuritySeal='UNAVAILABLE / NOT COMPLETED',automatedCodexSecurityInvoked=False,
  historicalHumanException='Previously explicitly accepted infrastructure exception; no product-security finding waived; historical record untouched.',
  scope='Nine committed package policy/caller/test/documentation paths; no broader integrated qualification.'))
lines=['# Scope 6E V2 package-input corrective — final exact-SHA qualification','',verdict,'',
 f'Recorded: {recorded}. Candidate `{sha}` on `{branch}`; baseline `{base}`.',
 '','## Candidate and remote CI','',
 'HEAD, origin-tracking ref and live origin branch all identify the candidate. No tracked or staged changes remain. The committed delta is exactly nine reviewed paths, 415 additions and 55 deletions. Every committed blob matches its reviewed prospective Git blob. No evidence/artifacts, native/CUDA source, Runtime/application source or package manifest/lockfile delta is present.',
 '',f"Draft [PR #{ci['pullRequest']['number']}]({ci['pullRequest']['url']}) remains open. All five required checks completed successfully on the exact candidate; both workflow conclusions and individual job/check conclusions were verified, including the informational matrix jobs. No earlier candidate CI was reused.",
 '','| Required check | Run ID | Job / check ID | Result |','| --- | --- | --- | --- |']
for c in ci['requiredChecks']:lines.append(f"| {c['label']} | [{c['workflowRunId']}]({c['workflowRunUrl']}) | [{c['jobId']}]({c['jobUrl']}) | PASS |")
lines+=['','Raw read-only GitHub API responses and SHA bindings are retained in `remote/`; `remote/closure.json` summarizes the checks. The connector returned 404; existing repository Git authentication was used for GET requests only. Credential material was never printed or persisted.',
 '','## Fresh committed product gates','','| Gate | Result |','| --- | --- |']
for row in g['results']:
    extra=' — 287/287 files' if row['command']==['npm.cmd','test'] else (' — 0 production vulnerabilities' if row['command']==['npm.cmd','audit','--omit=dev'] else '')
    lines.append('| `'+ ' '.join(row['command']) +'` | PASS'+extra+' |')
lines+=['','These runs used the clean committed candidate checkout, including a fresh dependency installation. Git checkout line-ending representations are distinguished from raw committed blob hashes in `committed-delta.json`. Exact candidate producer/verifier code for the real witnesses was compiled directly from Git blobs. `product-gates.json` records command times, exit codes and log digests; `toolchain.json` records observed versions.',
 '','## Real package witnesses','',
 f"Both actual worktrees produced identical archives using explicit revision `{sha}` and the same `product` archive root. SHA256: `{archive['sha256']}`. Size: **{archive['bytes']:,} bytes**. Inventory: **940 entries, 884 files, 56 directories**.",
 '', 'The populated worktree stayed at the baseline on main; the shared object database supplied the explicit candidate revision without checkout or ref changes. It was not cleaned or edited. All 22 untracked Scope 6D scripts remain absent from both ZIPs. The required native production source, Runtime artifact store and new input-policy test are present. Root artifacts, Git/Codex state and local qualification/install state are absent. The independent verifier reports commit-bound success and the exact candidate SHA for both archives. Every one of their 884 files was additionally compared directly with its raw Git blob.',
 '', 'The prior precommit baseline archive had 939 entries; it is historical evidence of baseline inputs. This fresh archive includes the newly committed test and all nine committed corrections. Its identity was measured anew and is not inferred from the old archive.',
 '','## Input policy, prior fixes and security','',
 'Fresh focused Windows tests and WSL regression bodies passed. `input-policy-regressions.json` maps each required control to raw execution evidence. These cover arbitrary untracked and dirty/EOL inputs, exact binary bytes, legitimate committed source, Git-free fail-closed behavior, explicit snapshots, independent commit-bound verification, structural-only labeling, local-install/root artifacts exclusion and all prior alias/path/mode controls. The Windows extraction guard passed; the earlier CWE-180 alias bypass no longer reproduces. WSL lacked Node, so the unmodified Python bodies from the exact committed tests ran directly under WSL Python; the initial launcher failure and successful alternative runs are retained.',
 '', 'Fresh exact-blob comparisons confirm historical assertions were not weakened. The Scope 6A helper and extracted browser source build also passed in each exact-SHA CPU release workflow.',
 '', '**Focused substantive security review: PASS; 0 unresolved Critical, High, Medium or Low findings within the reviewed boundary.** See `security-review.md` and `security-review.json` for the source/dataflow analysis and limits.',
 '', '**Automated Codex Security seal UNAVAILABLE / NOT COMPLETED.** No security automation was invoked. The historical human acceptance remains limited to the documented checkpoint-lifecycle/completion-ordering infrastructure failure; it does not waive any product-security finding. Neither this report nor the passing substantive review represents an automated seal.',
 '','## Preservation and permitted next boundary','',
 f"`preservation.json` confirms {pres['allTrackedBytesUnchanged']} primary tracked files, {pres['allPriorPrimaryArtifactsUnchanged']} prior primary artifacts, {pres['allPriorPopulatedArtifactsUnchanged']} prior populated artifacts, {pres['allPopulatedTrackedAnd22ScriptsUnchanged']} populated tracked/script files and {pres['allLocalInstallFilesUnchanged']} local-install files remained byte-identical. Both indexes and all refs are unchanged. Prior NON-PASS, blocker, alias-bypass, interrupted security, exception and human-acceptance evidence was preserved. The ignored test-generated routing timing report was excluded from historical-artifact comparison in the before snapshot; no qualification history was excluded.",
 '', 'This closure permits human review of qualification tagging and main promotion for this exact package-input corrective candidate. No tag, staging, commit, push, PR merge, main modification or broader integrated Scope 6E qualification was performed. Broader Scope 6E integration remains unqualified and has not resumed. Stop at this exact-SHA closure.',
 '','Evidence inventory and SHA256s: `final-candidate-inventory.json`.']
with (o/'qualification-report.md').open('x',encoding='utf8') as f:f.write('\n'.join(lines)+'\n')
evidence=[dict(path=p.relative_to(r).as_posix(),bytes=p.stat().st_size,sha256=h(p)) for p in sorted(o.rglob('*')) if p.is_file()]
save('final-candidate-inventory.json',dict(recordedAt=recorded,verdict=verdict,status='PASS',repository=str(r),branch=branch,
  candidate=sha,baseline=base,liveOriginBranchSha=sha,trackedAndStagedChanges=[],committedDelta=delta,
  productGates='PASS',tests=dict(passed=287,total=287),productionVulnerabilities=0,
  allFiveRemoteChecksPassExactSha=True,remoteChecks=ci['requiredChecks'],pullRequest=ci['pullRequest'],
  archive={k:archive[k] for k in ['sha256','bytes','entries','files','directories']},identicalRealWitnessBytes=True,
  inputAndPriorCorrectives='PASS',substantiveSecurityReview='PASS',unresolvedCriticalHigh=0,
  automatedCodexSecuritySeal='UNAVAILABLE / NOT COMPLETED',humanInfrastructureException='Historical ACCEPTED; unchanged',
  protection=pres,integratedScope6eQualified=False,integratedScope6eResumed=False,
  tagCreated=False,commitCreated=False,pushed=False,staged=False,merged=False,mainModified=False,
  evidenceFiles=evidence,inventorySelfDigestExcluded=True))
print(json.dumps(dict(verdict=verdict,candidate=sha,evidenceDirectory=str(o),evidenceFiles=len(evidence)+1)),flush=True)
