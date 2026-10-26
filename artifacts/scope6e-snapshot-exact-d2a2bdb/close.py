"""Finalize only after all fresh exact-SHA requirements pass."""
import hashlib,json,os,pathlib,subprocess
from datetime import datetime,timezone
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/scope6e-snapshot-exact-d2a2bdb'
sha='d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2';base='e84f06cdaa750803a06007ade63124b6bce693c8';branch='candy-integration-scope6e-extracted-snapshot-corrective'
verdict='READY FOR SCOPE 6E EXTRACTED SNAPSHOT CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION'
security='Substantive product security qualification PASS under the explicitly accepted security-infrastructure exception; automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED.'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((o/name).read_text(encoding='utf8'))
def save(name,v):
    with (o/name).open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
def git(root,*a):return subprocess.check_output(['git',*a],cwd=root,env=env).decode('utf8').strip()
def index(root):
    p=pathlib.Path(git(root,'rev-parse','--git-path','index'));return p if p.is_absolute() else root/p
b=read('before.json');delta=read('committed-delta.json');repo=read('repository-gates.json');ext=read('extracted-gates.json')
package=read('package-reproduction.json');matrix=read('adversarial-matrix.json');ci=read('remote/closure.json');extraction=read('extraction.json')
assert git(r,'rev-parse','HEAD')==sha and git(r,'branch','--show-current')==branch
assert not git(r,'diff','--name-only') and not git(r,'diff','--cached','--name-only')
assert git(r,'diff','--name-only',base,sha).splitlines()==['tests/candy-scope6a-release.test.mjs']
assert git(r,'ls-remote','https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14.git','refs/heads/'+branch).split()[0]==sha
assert all(x['candidate']==sha and x['status']=='PASS' for x in [delta,repo,ext,package,matrix])
assert ci['candidate']==ci['remoteBranchSha']==ci['pullRequest']['headSha']==sha and ci['allFivePassExactSha'] and len(ci['requiredChecks'])==5
assert all(c['candidateSha']==c['jobHeadSha']==c['checkHeadSha']==sha and c['status']=='PASS' for c in ci['requiredChecks'])
tests=[]
for g in [repo,ext]:
    for row in g['results']:assert row['candidate']==sha and row['exitCode']==0 and h(r/row['log'])==row['sha256']
    t=next(x for x in g['results'] if x['command']==['npm.cmd','test']);assert t['allDiscoveredPassed'] and t['passed']==t['total']==t['discovered'];tests.append(t)
    assert next(x for x in g['results'] if x['command']==['npm.cmd','audit','--omit=dev'])['productionVulnerabilities']==0
assert tests[0]['passed']==tests[1]['passed']
for case in package['cases']:
    assert h(r/case['path'])==case['sha256'] and case['verifier']['ok'] and case['verifier']['sourceCommit']==sha and case['verifier']['verificationLevel']=='commit-bound'
assert package['identicalBytes'] and (o/'clean.zip').read_bytes()==(o/'populated.zip').read_bytes()
assert matrix['rejected']==24 and matrix['acceptedCanonicalControls']==6
assert all(h(r/p)==d for p,d in b['trackedSha256'].items())
assert all(h(r/p)==d for p,d in b['priorArtifactSha256'].items())
for field in ['trackedAndScriptsSha256','localSha256','priorArtifactSha256']:
    assert all(h(old/p)==d for p,d in b['older'][field].items())
assert git(r,'show-ref')==b['refs'] and h(index(r))==b['indexSha256']
assert git(old,'show-ref')==b['older']['refs'] and h(index(old))==b['older']['indexSha256']
assert git(old,'status','--short')==b['older']['status'] and git(old,'rev-parse','HEAD')==b['older']['head'] and git(old,'branch','--show-current')==b['older']['branch']
recorded=datetime.now(timezone.utc).isoformat()
pres=dict(status='PASS',primaryTrackedBytesUnchanged=len(b['trackedSha256']),priorPrimaryArtifactsUnchanged=len(b['priorArtifactSha256']),
 populatedTrackedAnd22ScriptsUnchanged=len(b['older']['trackedAndScriptsSha256']),populatedLocalInstallationFilesUnchanged=len(b['older']['localSha256']),
 populatedPriorArtifactsUnchanged=len(b['older']['priorArtifactSha256']),bothIndexesAndAllRefsUnchanged=True,populatedStatusBranchHeadUnchanged=True,
 sourceTestPolicyRuntimeNativeCudaBytesModified=False,populatedWitnessReadOnly=True,noStagingCommitPushTagMergeOrMainChange=True,
 readyForReviewClicked=False,missingNativeEvidenceTouched=False,integratedQualificationResumed=False)
save('preservation.json',pres)
save('corrective-semantics.json',dict(candidate=sha,status='PASS',
 gitBackedSelfTest='No snapshot argument; all three helper cases must report commit-bound and exact HEAD.',
 extractedSelfTest='Explicit --source-mode snapshot; all three helper cases must report structural-only and null sourceCommit.',
 gitFreeDefault='Separate helper invocation without snapshot mode must exit 1 for missing metadata and create no success report.',
 presentBrokenMetadata='No catch/retry; presence of .git keeps default Git mode.',
 allPriorAssertionsPreserved=True,producerVerifierHelperPolicyUnchanged=True,
 evidence=['repository-gates.json','extracted-gates.json','adversarial-matrix.json','committed-delta.json']))
save('security-review.json',dict(candidate=sha,status='PASS',scope='One-file extracted snapshot corrective and package-policy regression boundary only',
 method='Fresh focused manual semantic source review and fresh exact-SHA adversarial/full-suite execution evidence.',
 unresolvedCritical=0,unresolvedHigh=0,statement=security,automatedSeal='UNAVAILABLE / NOT COMPLETED',codexSecurityAutomationInvoked=False,
 review='security-review.md',reviewSha256=h(o/'security-review.md'),historicalExceptionUnchanged=True,
 integratedScope6e='NON-PASS',fiveFileNativeEvidenceBlocker='OPEN / NOT ADDRESSED'))
summary=package['cases'][0];n=tests[0]['passed']
lines=['# Extracted snapshot corrective — exact-SHA closure','',verdict,'',
 f'Recorded {recorded}. Repository `{r}`; branch `{branch}`; exact candidate `{sha}`; starting qualified baseline `{base}`.',
 '','## Exact identity and scope','',
 'HEAD and the live GitHub branch match the exact candidate. Tracked and staged changes are empty. The committed delta is exactly `tests/candy-scope6a-release.test.mjs`, 19 additions / 2 deletions. Its blob matches the reviewed prospective blob. No other product/test/doc/Runtime/native/package-policy or evidence path changed in the commit. The local origin is the historical local witness, so GitHub identity was checked directly against its HTTPS repository and live REST branch record.',
 '', 'The committed caller preserves the helper default in a Git-backed project and explicitly passes snapshot mode only for the intentionally Git-free extracted self-test. Assertions enforce commit-bound/current-SHA results or structural-only/null-commit results as appropriate. A separate no-Git call without snapshot mode still must fail closed and create no success report. Producer, verifier, helper and production policy are unchanged.',
 '','## Live exact-SHA remote CI','',
 f"All five required checks completed successfully on `{sha}`. [PR #{ci['pullRequest']['number']}]({ci['pullRequest']['url']}) was observed as draft and was not changed. No earlier candidate CI was reused. Both overall workflow conclusions and individual matrix job/check conclusions were checked, including every substantive step.",
 '','| Required check | Run ID | Job / check ID | Result |','| --- | --- | --- | --- |']
for c in ci['requiredChecks']:lines.append(f"| {c['label']} | [{c['workflowRunId']}]({c['workflowRunUrl']}) | [{c['jobId']}]({c['jobUrl']}) | PASS |")
lines+=['','The connector returned 404. Read-only GitHub REST used existing Git authentication; credentials were never printed or persisted. Raw branch, PR, run, job and check responses plus SHA bindings are in `remote/`.',
 '','## Fresh committed repository and Git-free extracted gates','',
 '| Gate | Repository | Fresh Git-free extraction |','| --- | --- | --- |',
 '| npm ci | PASS | PASS |',f'| npm test | PASS — {n}/{n} discovered files | PASS — {tests[1]["passed"]}/{tests[1]["discovered"]} discovered files |',
 '| lint | PASS | PASS |','| build | PASS | PASS |','| build:github | PASS | PASS |','| production audit | PASS — 0 vulnerabilities | PASS — 0 vulnerabilities |','| git diff --check | PASS | Not applicable without Git |',
 '',f"The extraction is a new directory outside every repository: `{ext['root']}`. It has no `.git`, no ancestor repository discovery and no root evidence at extraction. It contains the exact committed corrective, not a precommit overlay. The complete extracted suite passed, including `candy-scope6a-release.test.mjs` and its explicit snapshot/provenance/default-failure assertions. No product/test bytes, hidden Git metadata or fallback were introduced for these runs. `repository-gates.json`, `extracted-gates.json` and raw hashed logs record actual discovery, commands, times and results.",
 '','## Real clean/populated package reproducibility','',
 f"The qualified producer and independent verifier were compiled directly from candidate Git blobs and invoked against both actual roots with explicit revision `{sha}` and a shared `product` ZIP root. Both verify as commit-bound to that SHA and are byte-identical: **SHA256 `{summary['sha256']}`; {summary['bytes']:,} bytes; {summary['entries']} entries; {summary['files']} files; {summary['directories']} directories**.",
 '',f"The populated witness remains at its existing HEAD `{package['cases'][1]['sourceWorktreeHead']}`; its existing object database supports the explicit candidate revision without checkout, ref, source or index changes. All 22 historical untracked scripts remain excluded. There are {summary['checkoutEolOnlyDifferences']} observed shared checkout-only EOL differences, which do not affect release bytes. The corrected test itself exactly matches its committed blob in the ZIP. Local Scope 6D installation/qualification namespaces and root artifacts are absent; production native source and Runtime artifactStore remain present. Both historical 937-vs-941 and 939-vs-961 blocker classes remain closed.",
 '', 'The release contains no binary member identified by the binary-member observations; the unchanged committed synthetic input-policy test independently proves all-byte/NUL/CRLF binary preservation and dirty-binary independence in both fresh full suites. No text normalization is applied to qualified release input. Archive manifests and detailed witness records are in `package-reproduction.json` and the two manifests.',
 '','## Package adversarial regression and security','',
 'The independent exact committed verifier rejected 24 malicious mutations of the actual release archive and accepted six canonical production controls. The matrix explicitly covers arbitrary new scripts/source files, local native installs, root artifacts, trailing-dot/space and mixed/backslash aliases, traversal, POSIX/Windows absolute and UNC paths, token/credential/environment contamination, unsafe executable aliases, NUL/control/illegal names, symlinks, special files and unsafe modes. Both fresh full suites also passed the unchanged committed untracked/dirty/EOL/binary, no-Git, independent-verifier and Windows extraction-guard regressions. See `adversarial-matrix.json` and `corrective-semantics.json`.',
 '', '**Focused semantic security review: PASS; no unresolved Critical/High issue in this corrective.** See `security-review.md` and `security-review.json`.',
 '', security,
 '', 'No Codex Security automated scan, completion or sealing was invoked. The accepted historical infrastructure exception was not rewritten and is not a waiver of product findings. This security statement is limited to the extracted-snapshot corrective.',
 '','## Separate native blocker and preservation','',
 '**The five-file Scope 6D incremental native qualification-evidence blocker remains OPEN. Overall integrated Scope 6E remains NON-PASS.** No missing evidence was fabricated, regenerated, copied from similarly named sources, silently replaced or reinterpreted. No CUDA execution or final integrated Runtime/browser/soak qualification occurred in this task.',
 '',f"`preservation.json` verifies {pres['primaryTrackedBytesUnchanged']} primary tracked files, {pres['priorPrimaryArtifactsUnchanged']} prior primary artifacts, {pres['populatedTrackedAnd22ScriptsUnchanged']} populated tracked/script files, {pres['populatedLocalInstallationFilesUnchanged']} populated local-install files and {pres['populatedPriorArtifactsUnchanged']} populated prior artifacts retained exact bytes. Both indexes/all refs and populated status/branch/HEAD are unchanged. Historical NON-PASS, corrections, alias/security infrastructure/acceptance and precommit review evidence were preserved. Only the ignored test-generated routing timing report was excluded from prior-artifact comparison, as declared in the initial snapshot.",
 '', 'No staging, commit, push, tag, merge, main modification or Ready for review action occurred. This report establishes readiness for qualification-tag and main-promotion review of this exact corrective only. Stop at corrective closure; integrated Scope 6E is not complete and has not resumed.',
 '', 'Final evidence digest inventory: `final-inventory.json`.']
with (o/'exact-sha-report.md').open('x',encoding='utf8') as f:f.write('\n'.join(lines)+'\n')
files=[dict(path=p.relative_to(r).as_posix(),bytes=p.stat().st_size,sha256=h(p)) for p in sorted(o.rglob('*')) if p.is_file()]
save('final-inventory.json',dict(recordedAt=recorded,verdict=verdict,status='PASS',candidate=sha,baseline=base,branch=branch,
 committedDelta=delta,trackedAndStagedChanges=[],repositoryTests=dict(passed=n,discovered=n),extractedTests=dict(passed=tests[1]['passed'],discovered=tests[1]['discovered']),
 repositoryGates='PASS',extractedGates='PASS',bothProductionAudits=0,allFiveRemoteChecksPassExactSha=True,remoteChecks=ci['requiredChecks'],pullRequest=ci['pullRequest'],
 archive={k:summary[k] for k in ['sha256','bytes','entries','files','directories']},realWitnessesByteIdentical=True,packageAdversarial='PASS',rejectedAdversarialCases=24,
 substantiveSecurity='PASS for corrective scope',unresolvedCriticalHigh=0,securityStatement=security,automatedCodexSecuritySeal='UNAVAILABLE / NOT COMPLETED',
 fiveFileNativeEvidenceBlocker='OPEN / NOT ADDRESSED',integratedScope6e='NON-PASS',integratedScope6eResumed=False,preservation=pres,
 staged=False,committed=False,pushed=False,tagged=False,merged=False,mainModified=False,readyForReviewClicked=False,evidenceFiles=files,selfDigestExcluded=True))
print(json.dumps(dict(verdict=verdict,candidate=sha,repositoryTests=n,extractedTests=tests[1]['passed'],preservation=pres,evidenceFiles=len(files)+1)),flush=True)
