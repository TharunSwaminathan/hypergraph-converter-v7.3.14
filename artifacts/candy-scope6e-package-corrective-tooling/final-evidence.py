"""Write the user-requested additive closure report and exact product inventory."""
import hashlib, json, pathlib, shutil, subprocess, sys
from datetime import datetime, timezone

r = pathlib.Path.cwd()
out = r / 'artifacts'
run = out / 'candy-scope6e-package-corrective-final-run'
scan_id = 'ce39ac67-885a-486d-b456-99dd082d9c70'
scan = pathlib.Path(r'C:\Users\tharu\.codex\state\plugins\codex-security\scans\hypergraph-converter-v7.3.14-scope6e-package-corrective\c294ed0cea093bb8933d06e6e23177a7f1409952_20261024T170845Z_e5i5f7vi')
scan = pathlib.Path(chr(92)*2+'?'+chr(92)+str(scan))
status = sys.argv[1]
assert status in ['pending', 'completed', 'infrastructure-blocked']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args):
    return subprocess.check_output(['git', *args]).decode('utf8').strip()
def save(path, value):
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf8')
now = datetime.now(timezone.utc).isoformat()
base = 'c294ed0cea093bb8933d06e6e23177a7f1409952'
paths = ['scripts/package-portable-source.py','scripts/verify-portable-archive.py',
         'tests/candy-scope6e-package.test.mjs','docs/PORTABLE_LOCAL_INSTALL_POLICY.md']
categories = ['packaging policy','independent archive verifier policy',
              'package corrective regression test','directly relevant packaging policy documentation']
recovered = json.loads((run/'recovered-state.json').read_text())
assert git('rev-parse','HEAD') == base
assert git('branch','--show-current') == 'candy-integration-scope6e-package-corrective'
assert not git('diff','--cached','--name-status')
assert sorted(git('diff','--name-only').splitlines()) == sorted(paths[:2])
untracked = git('ls-files','--others','--exclude-standard').splitlines()
assert sorted(p for p in untracked if not p.startswith('artifacts/')) == sorted(paths[2:])
assert all(sha(r/p)==h for p,h in recovered['sourceSha256'].items())
assert all(sha(r/p)==h for p,h in recovered['preservedTrackedFileSha256'].items())
assert subprocess.check_output(['git','show-ref']).decode()==recovered['refs']
assert sha(pathlib.Path(git('rev-parse','--git-path','index')))==recovered['indexSha256']
subprocess.run(['git','diff','--check'],check=True)

inventory=[]
for p,category in zip(paths,categories):
    old=git('rev-parse',f'{base}:{p}') if p in paths[:2] else None
    inventory.append(dict(path=p,status='modified tracked' if old else 'new untracked proposed addition',
         category=category,bytes=(r/p).stat().st_size,worktreeSha256=sha(r/p),
         baselineGitBlob=old,prospectiveGitBlob=git('hash-object',f'--path={p}',p),
         staged=False,archiveMember='product/'+p))
gates=json.loads((run/'gates.json').read_text())
package=json.loads((out/'candy-scope6e-package-corrective-package-final.json').read_text())
preservation=json.loads((run/'preservation-reconciled.json').read_text())
result=scan/'artifacts/02_discovery/validation_artifacts/candidate-75ede7b1f21f28b6/result.json'
alias=json.loads(result.read_text())
local_probe=run/'windows-alias-result.json'
if not local_probe.exists():shutil.copyfile(result,local_probe)
assert sha(local_probe)==sha(result)
assert gates['allPass'] and gates['results'][0]['passed']==286
assert package['identicalBytes'] and all(c['verifier']['ok'] for c in package['cases'])
assert not package['independentContamination']['verifier']['ok']
assert all(c['verifier']['ok'] and c['actualWindowsExtraction'] for c in alias['cases'])
manifest=json.loads((scan/'scan-manifest.json').read_text())
findings=json.loads((scan/'findings.json').read_text())
coverage=json.loads((scan/'coverage.json').read_text())
if status=='completed':
    assert manifest['scan'].get('sealedAt')
    assert coverage['completeness']=='complete'
    assert len(findings['findings'])==1
    assert findings['findings'][0]['severity']['level']=='low'
security=dict(capturedAt=now,scanId=scan_id,scanDirectory=str(scan),freshScan=True,
    previousMissingCheckpointUsed=False,finalizationStatus=status,
    unresolvedSeverityCounts=dict(critical=0,high=0,medium=0,low=1),
    highCriticalGatePass=True,independentVerifierContaminationGatePass=False,
    productDefectConfirmed=True,infrastructureBlocked=status=='infrastructure-blocked',
    finding=findings['findings'][0],coverage=coverage,
    canonicalArtifacts={name:dict(path=str(scan/name),sha256=sha(scan/name)) for name in
                        ['scan-manifest.json','findings.json','coverage.json']},
    aliasEvidence=dict(path=str(local_probe.relative_to(r)).replace('\\','/'),sha256=sha(local_probe)),
    reportPath=str(scan/'report.md') if status=='completed' else None)
save(out/'candy-scope6e-package-corrective-security-final.json',security)
verdict=('NON-PASS — CORRECTIVE CLOSURE INFRASTRUCTURE BLOCKED' if status=='infrastructure-blocked'
         else 'NON-PASS — SCOPE 6E PACKAGE CORRECTIVE VERIFIER POLICY BYPASS')
body=f'''# Scope 6E package corrective fresh closure

**{verdict}**

Fresh run: {now}. Branch `candy-integration-scope6e-package-corrective`; HEAD and original baseline `{base}`.

The existing four-file corrective implementation is byte-for-byte identical to the previously qualified candidate. No product file was changed during this run. Fresh tests and normal packaging gates pass. An additional adversarial check found a reproducible Windows extraction alias bypass, so the independent contamination-rejection requirement is not satisfied and the corrective is not declared qualified for review.

## Confirmed closure blocker

**Low / P3, CWE-180 — Windows path component aliases bypass the reserved local-install guard.** At `scripts/verify-portable-archive.py:125-130`, raw `candy-runtime./native/` or `candy-runtime/native./` components fail the canonical namespace equality check. The actual verifier API and CLI accept both crafted archives with zero issues. Actual Windows Python ZIP extraction removes the trailing dot and writes synthetic `src/main.cu` into `candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-alias/`. The producer excludes that canonical extracted file. The same payload using the canonical ZIP path is rejected.

This is a bounded release-policy bypass with demonstrated producer/verifier disagreement. It requires a supplied or repacked ZIP and subsequent Windows extraction. No code execution, private secret access, native activation or privilege escalation was demonstrated. There are **0 unresolved Critical, 0 High, 0 Medium and 1 Low** findings. The severity threshold passes; the independent contamination-rejection requirement fails. This product finding is distinct from security infrastructure availability.

Suggested follow-up, not applied: reject noncanonical Windows component aliases before path-policy matching and add independent injection plus actual Windows extraction regressions. The preservation constraint limits this attempt to verification and reporting; the implementation remains intact.

Evidence: `candy-scope6e-package-corrective-final-run/windows-alias-result.json`; source/input ZIPs retained in the fresh security scan under `artifacts/02_discovery/validation_artifacts/candidate-75ede7b1f21f28b6/`.

## Fresh qualification results

| Gate | Result |
| --- | --- |
| `npm.cmd test` | PASS, 286/286 discovered test files |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS, 0 vulnerabilities |
| `git diff --check` | PASS |
| Focused package corrective regression | PASS |
| Real baseline + exact four-file overlay, clean/populated archives | PASS, byte-identical |
| Canonical local-install injected contamination | PASS, verifier rejects |
| Windows trailing-dot alias contamination | FAIL, verifier accepts before canonicalizing extraction |
| Fresh security finalization | {status.upper()} |

The build retains its existing advisory about bundles larger than 500 kB. Logs, command exit codes and log SHA256 values are in `candy-scope6e-package-corrective-final-run/gates.json`. The runner counts test files, not individual assertions.

## Exact package identity and source completeness

Fresh clean and populated archives both have SHA256 `{package['cases'][0]['sha256']}`, {package['cases'][0]['bytes']:,} bytes, {package['cases'][0]['entries']} entries, {package['cases'][0]['files']} files and {package['cases'][0]['directories']} directories. This reproduces the previous corrective archive exactly. The package represents the exact committed baseline plus four current uncommitted overlays; no candidate commit was created.

Canonical Scope 6D local qualification source, build binaries and qualification records are absent for historical, arbitrary, empty and mixed-case qualifiers. Both legitimate production native source trees and `candy-runtime/src/artifacts/artifactStore.js` remain present. Relative to the original clean archive, there are zero removed source members, exactly two added product members (test and documentation), and exactly two changed members (producer and verifier). See `candy-scope6e-package-corrective-package-final.json` and the retained ZIP manifests.

## Proposed product commit inventory — four files only

| Path | Classification | Worktree SHA256 |
| --- | --- | --- |
'''
for item in inventory:
    body+=f"| `{item['path']}` | {item['category']} | `{item['worktreeSha256']}` |\n"
body+='''
The machine-readable inventory includes byte sizes, baseline Git blobs and prospective filtered Git blob identities. Every path under `artifacts/**`, including qualification tooling and all final reports/witnesses, is excluded from the proposed product commit. Nothing has been staged.

## Preservation and review coverage

All four current file hashes match prior gate/package overlay records; prior log digests were independently checked. All other 1,280 tracked files, Git refs and index bytes are unchanged. Protected native algorithm trees, jobs, graph, candy, persistence and visualization paths have no changes. No reset, restore, clean, stash, worktree recreation, commit, push, tag change or main update was performed. Scope 6E integrated qualification was not resumed.

The test suite regenerated one gitignored nondeterministic telemetry file, `artifacts/deterministic-nlu-integrated-routing-report.json`. A deliberately broad preservation assertion consequently stopped the evidence runner after all gates and package checks had passed. `preservation-reconciled.json` independently verifies the exact difference, confirms it is ignored, and verifies that all product files, tracked historical evidence, prior corrective evidence, Scope 6E NON-PASS evidence, refs and index are preserved. This instrumentation assertion is not a test, product or security-infrastructure failure. No historical evidence was restored or rewritten.

The fresh security review covers path-prefix bypass, slash/backslash handling, case variants, nested lookalikes, traversal, absolute paths, symlinks/special entries, qualification records, executable/credential/token filename exclusions, production native false positives, producer/verifier disagreement, root artifacts and local installations, and source completeness. The compact tool inventory listed 13 paths: two product scripts and eleven evidence/tooling paths; the new untracked test and document were explicitly reviewed in addition. Root artifacts are excluded from product scope by the user's request. This is a bounded corrective diff review, not a repository-wide or native/runtime security certification. Path exclusions do not establish arbitrary secret detection within otherwise legitimate source contents.

'''
body+=f"Fresh security scan `{scan_id}`; directory `{scan}`. A fresh checkpoint and final semantic draft were created; the old missing checkpoint was neither recovered nor used. Canonical security finalization status: **{status.upper()}**.\n"
if status=='infrastructure-blocked':
    body+='\nSecurity finalization infrastructure failed in addition to the independently confirmed product policy bypass. See the retained completion result; no PASS is asserted.\n'
report=out/'candy-scope6e-package-corrective-final-report.md'
report.write_text(body,encoding='utf8')
invpath=out/'candy-scope6e-package-corrective-final-inventory.json'
if not invpath.exists():save(invpath,{})
record=dict(capturedAt=now,verdict=verdict,branch=git('branch','--show-current'),baseline=base,head=git('rev-parse','HEAD'),
    proposedProductPaths=inventory,excludedFromProductCommit=[dict(pattern='artifacts/**',category='qualification evidence/tooling',reason='Explicit user instruction; never stage evidence')],
    changedTrackedPaths=git('diff','--name-status').splitlines(),untrackedNonEvidencePaths=[p for p in untracked if not p.startswith('artifacts/')],
    stagedPaths=git('diff','--cached','--name-status').splitlines(),gitStatusShort=git('status','--short'),
    gitDiffStat=git('diff','--stat'),diffCheckPass=True,protectedProductionPathsUnchanged=True,
    allCandidateHashesMatchPriorEvidence=True,preservation=preservation,securityFinalization=status,
    references=dict(report=report.name,security='candy-scope6e-package-corrective-security-final.json',package='candy-scope6e-package-corrective-package-final.json'))
save(invpath,record)
print(json.dumps(dict(verdict=verdict,securityFinalization=status,productFiles=len(inventory),report=str(report),inventory=str(invpath))))
