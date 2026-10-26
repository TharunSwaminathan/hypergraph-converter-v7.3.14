import hashlib,json,pathlib,subprocess,os
from datetime import datetime,timezone
r=pathlib.Path.cwd();a=r/'artifacts';o=a/'candy-scope6e-v2-package-input-work';env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf8'))
def git(*args):return subprocess.check_output(['git',*args],cwd=r,env=env).decode().strip()
def save(name,data):
    with (a/name).open('x',encoding='utf8',newline='\n') as f:json.dump(data,f,indent=2);f.write('\n')
before=read(o/'before.json');g=read(o/'gates.json');repro=read(a/'candy-scope6e-v2-package-input-reproduction.json');candidate=read(o/'reviewed-candidate.json')
old=read(o/'older-preservation.json');compat=read(o/'scope6a-compatibility.json');cli=read(o/'cli-and-historical-rechecks.json')
expected=['docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md','docs/PORTABLE_LOCAL_INSTALL_POLICY.md','scripts/package-portable-source.py',
 'scripts/qualify-scope6a-package.py','scripts/verify-portable-archive.py','tests/candy-rc2-package.test.mjs',
 'tests/candy-scope6e-package.test.mjs','tests/zip-permissions-v7-3-11.test.mjs','tests/candy-scope6e-package-input.test.mjs']
assert sorted(git('diff','--name-only').splitlines()+['tests/candy-scope6e-package-input.test.mjs'])==sorted(expected)
assert not git('diff','--cached','--name-only') and git('rev-parse','HEAD')==before['head']
assert git('branch','--show-current')==before['branch'] and git('show-ref')==before['refs']
assert h(pathlib.Path(git('rev-parse','--git-path','index')))==before['indexSha256']
assert all(h(r/p)==sha for p,sha in before['trackedSha256'].items() if p not in expected)
assert all(h(r/p)==sha for p,sha in before['priorArtifacts'].items())
assert all(h(r/p)==sha for p,sha in g['sourceSha256'].items())
assert g['allPass'] and all(v['exitCode']==0 for v in g['results'])
test=next(v for v in g['results'] if v['command']==['npm.cmd','test']);assert test['passed']==test['discovered']==287
assert repro['status']=='PASS' and repro['identicalBytes'] and compat['status']=='PASS' and compat['identicalBytes']
assert cli['noGitDefaultCliExitCode']!=0 and cli['explicitSnapshotCliExitCode']==0 and cli['qualifiedVerifierCliExitCode']==0
assert old['oldScriptsUnchanged']==22 and old['oldGitStatusRefsIndexUnchanged']
assert all(h(r/v['path'])==v['sha256'] for v in candidate['candidateOverlays'])
assert all(h(r/v['path'])==v['sha256'] for v in repro['cases'])
assert h(r/candidate['path'])==candidate['sha256']
now=datetime.now(timezone.utc).isoformat();verdict='READY FOR SCOPE 6E V2 PACKAGE INPUT CORRECTIVE CANDIDATE REVIEW'
policy=dict(recordedAt=now,baseline=before['head'],productionSourceMode='git (default)',
  authority='One resolved commit tree and raw blobs; not checkout files, index, Git attributes/filters, or untracked paths',
  sourceRevisionPinned=True,sourceRootMustMatchGitWorktreeRoot=True,ambientGitOverridesRemoved=True,replacementObjectsDisabled=True,
  textAndBinaryBytes='Exact committed blobs; no blind text normalization',untrackedInjection='Excluded as a class, not by 22 filenames',
  gitUnavailableBehavior='FAIL; no automatic filesystem fallback',
  noGitCompatibility=dict(mode='snapshot (explicit only)',intendedUse='Reviewed Git-free archives, intentional fixtures and uncommitted candidate snapshots',
    membership='Reviewed filesystem inventory with existing exclusions; not a committed-release attestation',bytes='Exact filesystem bytes'),
  verifier=dict(independent=True,importsProducerPolicy=False,qualifiedMode='--source-root <trusted-worktree> --revision <commit>',
    expectedInventory='Independently read commit tree/raw blobs from external trusted Git',
    rejects='Extra/missing/changed files and extra/missing directories, plus independent structural policy',
    withoutSourceRoot='structural-only; ok does not attest intended membership or committed identity'),
  compatibilityEvidence=dict(scope6aActualCleanPopulated='PASS, byte-identical; actual release commit-bound',
    rc2IntentionalNestedFixture='PASS, explicit snapshot mode',windowsInputTests='PASS',linuxWslInputTests='PASS',
    noGitCli='Default refusal and explicit snapshot round-trip PASS'),
  candidateQualification=dict(commitCreated=False,defaultReleaseSource=before['head'],
    implementation='Current uncommitted producer/verifier exercised against actual worktrees and disposable Git fixtures',
    reviewedCandidateSnapshot=candidate['path'],reviewedCandidateSha256=candidate['sha256'],
    newCommitStillRequiresExactShaQualification=True),
  historicalFailure='Preserved unchanged; prior 939/961 entries, 22 extra scripts and 555 EOL-only differences remain historical evidence')
save('candy-scope6e-v2-package-input-policy.json',policy)
security=f'''# Scope 6E V2 package input — focused semantic security review

Reviewed {now}, baseline `{before['head']}` plus the explicit current nine-file packaging-policy/test/documentation delta. No Codex Security tool, scan or automated completion/sealing was invoked. This is a bounded source/dataflow review, not a repository-wide audit.

## Source authority and validation-to-use boundary

The old producer used `iter_source_files` filesystem membership and `read_bytes` checkout contents. That admitted any otherwise-allowed untracked file and made CRLF/LF representations release inputs. Current `git_source_entries` (`scripts/package-portable-source.py`) resolves the operator-selected revision once, enumerates the pinned tree with NUL-separated Git records, rejects unsafe names/case collisions and non-regular included modes, and reads objects with `cat-file --batch`. The object header, type, length and blob digest are checked before bytes are archived. No checkout filters, hooks or text conversion execute. Binary and text content are unchanged raw blobs. Untracked and dirty/staged worktree inputs have no release authority.

`create_zip` defaults to Git mode and must match the exact Git worktree root. Broken/missing metadata or discovery of an ancestor repository fails; no automatic fallback is taken. Ambient `GIT_*` metadata/config overrides are removed, replacement objects disabled and optional locks disabled. Subprocesses use argument arrays, not a shell; revision parsing uses `--end-of-options`. Git configuration/metadata and the operator's selected commit are explicitly trusted inputs: this is a reproducible-source boundary, not a publisher signature or defense against an operator deliberately choosing malicious committed code. A changed commit is a different authority. Qualification passes an exact SHA.

## Independent verifier and attacker-controlled archive

The verifier imports no producer implementation. Its `committed_inventory` independently enumerates the trusted external Git tree, applies its own exclusions and hashes the exact blobs. Commit-bound `verify(... source_root=..., revision=...)` compares every file's path and content plus directory inventory. A fabricated manifest inside the ZIP cannot authorize an extra script. Tests inject newly named scripts and ordinary source files, mutate binary contents, omit required members, and add empty directories: commit-bound verification rejects them. The corrected verifier also detects source-inventory mismatches in both historical V2 ZIPs without modifying them.

Legacy structural verification remains available, clearly labelled `structural-only`, for intentionally assembled Git-free snapshots and fixtures. It checks path/type/mode/exclusion integrity, not source provenance. `ok` at this level must not be used as committed-release attestation. Qualified production requires Git-mode production plus commit-bound verification against an external trusted root/revision. This is an explicit trust boundary, never a silent fallback to filesystem walking.

## Paths, symlinks, metadata and bytes

Raw Git paths are validated before constructing host Paths; backslashes, traversal/dot/empty components, trailing dots/spaces, controls, Windows illegal names and case collisions fail. Included committed symlinks and submodules fail regardless of regular-looking checkout targets. Release production does not read worktree symlink targets. Explicit snapshot mode retains the existing file-symlink/nonportable-source checks and excludes non-files from its walk; it is for trusted reviewed trees, not an untrusted concurrent filesystem sandbox. Existing archive traversal/absolute/UNC, raw-alias, symlink/special, permissions, executable allowlist, duplicate/case, root and CRC controls remain active. Tests cover both Windows and Linux and retain the prior independent malformed-archive regression.

No arbitrary text-wide normalization occurs. A binary fixture containing all byte values, NUL and CRLF survives bit-for-bit; changing its checkout copy cannot affect committed output. A text fixture's LF/CRLF worktree representations produce identical release bytes. Commit-bound verification rejects changed bytes rather than normalizing them into acceptance.

## Compatibility, limitations and outcome

The existing Scope 6A contract and RC2 tests intentionally supported source trees without `.git`, nested source fixtures and reviewed uncommitted source. That capability is preserved through explicit snapshot mode; historical callers/tests were updated to choose the correct mode. The Scope 6A helper derives its actual Git source and temporary clean/populated snapshots from the same raw commit and independently verifies all three against that commit. Their bytes match. Git-free CLI snapshot round-trip also matches the explicitly reviewed candidate snapshot exactly.

The direct real-worktree gate passes without removing any of the older witness's 22 diagnostic scripts or changing its 555 checkout EOL differences. The default release source is still committed HEAD `{before['head']}`; uncommitted corrective files intentionally do not appear in that release. A separate explicit nine-file candidate overlay is hashed and packaged for review. A future commit containing the corrective must receive exact-SHA qualification; no new commit is claimed here.

**Outcome: no unresolved Critical or High issue identified within this package-input trust boundary.** No remaining reportable finding was identified in the bounded review. No application, graph, Runtime or CUDA/native behavior was changed. This does not qualify broader Scope 6E integration, provide arbitrary-content secret detection, sign a release, or make a concurrency guarantee for an explicitly reviewed mutable snapshot.

The prior human acceptance remains narrowly applicable to the documented security infrastructure failure and has not been rewritten. Substantive review here passes under that accepted exception; the automated Codex Security completion seal remains **UNAVAILABLE / NOT COMPLETED**, never automated PASS.
'''
with (a/'candy-scope6e-v2-package-input-security-review.md').open('x',encoding='utf8',newline='\n') as f:f.write(security)
categories={
 'scripts/package-portable-source.py':'Pinned commit inventory/raw-blob release input and explicit snapshot compatibility',
 'scripts/verify-portable-archive.py':'Independent commit-bound membership/content verification',
 'scripts/qualify-scope6a-package.py':'Historical package qualification caller compatibility; no silent fallback',
 'tests/candy-scope6e-package-input.test.mjs':'New deterministic Git input and independent-verifier regression',
 'tests/candy-scope6e-package.test.mjs':'Existing synthetic fixtures explicitly select snapshot mode',
 'tests/candy-rc2-package.test.mjs':'Intentional uncommitted nested-source fixture explicitly selects snapshot mode',
 'tests/zip-permissions-v7-3-11.test.mjs':'Permission test supports both real Git and extracted no-Git source',
 'docs/PORTABLE_LOCAL_INSTALL_POLICY.md':'Current source trust boundary, modes and fallback policy',
 'docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md':'Current release contract compatibility and committed byte authority'}
inventory=[dict(path=p,status='new untracked proposed addition' if p.endswith('package-input.test.mjs') else 'modified tracked',
  category=categories[p],bytes=(r/p).stat().st_size,sha256=h(r/p),prospectiveGitBlob=git('hash-object','--path='+p,p),
  staged=False) for p in expected]
save('candy-scope6e-v2-package-input-final-inventory.json',dict(recordedAt=now,baseline=before['head'],head=git('rev-parse','HEAD'),
 branch=before['branch'],verdict=verdict,productPaths=inventory,productFileCount=9,excludedFromProductCommit=['artifacts/**'],
 stagedPaths=[],productScope='Packaging policy, relevant historical packaging caller/tests and directly applicable documentation only',
 noApplicationRuntimeNativeGraphBehaviorChanges=True,existingTrackedFilesUnchangedOutsideInventory=True,
 priorNonPassEvidenceHashesPreserved=before['priorArtifacts'],olderPreservation=old,
 realReproduction='candy-scope6e-v2-package-input-reproduction.json',candidateSnapshot=candidate,
 fullGateResults='artifacts/candy-scope6e-v2-package-input-work/gates.json',automatedSecuritySeal='UNAVAILABLE',futureExactShaQualificationRequired=True))
case=repro['cases'][0]
report=f'''# Scope 6E V2 portable package input-policy corrective

**{verdict}**

Recorded {now}. Primary worktree `{r}`; branch `{before['branch']}`; unchanged HEAD/baseline `{before['head']}`. No new product commit exists. The previous V2 NON-PASS and both historical ZIP witnesses are preserved unchanged.

## Diagnosis and chosen contract

The previous producer selected files using an exclusion-filtered filesystem walk and archived raw checkout bytes. Git membership and canonical blobs were not consulted. That explains both measured failures: the 22 untracked `scripts/` files were selected as ordinary source, and 555 LF/CRLF-only differences changed bytes despite identical Git blobs. The prior local native-install namespace and root-artifacts exclusions were already working and remain intact.

Historical compatibility was established from `CANDY_SCOPE6A_RELEASE_CONTRACT.md`, `RELEASE_v7.3.14.md`, the Scope 6A helper, RC2 package tests, synthetic Scope 6E fixtures and the ZIP permission regression. They intentionally support Git-free source trees and generated/reviewed fixture files. A Git-only implementation would break that contract. The correction therefore makes two distinct modes explicit:

- **Default Git release:** one pinned commit tree defines membership; raw Git blobs define bytes. No index/dirty/untracked or checkout EOL/attribute/filter input can alter the output. Unusable Git metadata fails instead of falling back. Binary content is not normalized.
- **Explicit reviewed snapshot:** preserves the prior filesystem/exclusion behavior for Git-free distributions, intentional fixtures and reviewed uncommitted candidate snapshots. This mode is not a committed-release attestation. The CLI/API choice is explicit and documented.

Qualified verification independently derives the expected tree/content from a trusted Git source root and revision. It rejects additional, missing or changed members and directories. It never trusts a producer-supplied archive manifest. Structural-only verification is separately labelled and cannot attest source membership. The existing path-alias, native-install, root-artifact, credential/token, executable and metadata rules remain enforced.

## Actual real-worktree reproduction — PASS

The corrected producer was invoked directly against this primary Git worktree and the actual older populated worktree `{older if False else r.parent/'hypergraph-converter-v7.3.14'}`. Both use the same exact committed revision and `product` root name. No temporary tracked-only copy, 22-filename blacklist, file deletion or EOL rewrite was used.

Both resulting release archives have:

- SHA256 **`{case['sha256']}`**
- **{case['bytes']:,} bytes**, **{case['entries']} entries**, **{case['files']} files**, **{case['directories']} directories**

They are byte-identical and both independently pass commit-bound verification. All 22 untracked diagnostic/qualification scripts, all other untracked state, root artifacts and local qualification installations are absent. Both legitimate production native source trees and `candy-runtime/src/artifacts/artifactStore.js` are present. The older witness's script bytes, native-install files, tracked bytes, Git status, index and refs are unchanged. Newly named script/source injections are independently rejected.

The source revision of these default releases remains committed baseline `{before['head']}`: the uncommitted correction is deliberately **not** silently included. To bind the intended draft itself, a separate explicit reviewed snapshot contains the baseline's canonical committed product plus exactly the nine inventoried corrective files, with every overlay checked against the actual worktree bytes. Its SHA256 is `{candidate['sha256']}`. CLI Git-free snapshot repackaging reproduces that exact archive. It is a review candidate, not a fabricated committed release. Future exact-SHA qualification is still required after the user creates the corrective commit.

## Regression and full product gates — PASS

| Check | Result |
| --- | --- |
| New Git-input regression on Windows | PASS |
| Same new regression in WSL Linux | PASS |
| Existing alias/local-install synthetic regression | PASS |
| RC2 nested-fixture/extracted source regression | PASS |
| Scope 6A actual/clean/populated package helper | PASS, byte-identical and independently commit-bound |
| Git-free CLI default | Expected fail-closed refusal |
| Explicit Git-free snapshot CLI | PASS, reviewed candidate round-trip byte identity |
| Qualified verifier CLI | PASS |
| `npm.cmd test` | **287/287 discovered test files PASS** |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS, **0 production vulnerabilities** |
| `git diff --check` | PASS |

Dependencies were installed fresh with `npm.cmd ci` before the full gates. The usual bundle-size advisory is informational; both builds passed. Logs, command exit codes, timings and hashes are retained under `candy-scope6e-v2-package-input-work/`.

The new deterministic Git fixture covers clean committed output; arbitrary untracked script and unrelated source-file injection; LF/CRLF checkout differences; exact binary preservation even when the binary checkout is dirty; committed script/native/intentional fixture inclusion; committed local-state/root-artifact exclusion; independent extra/missing/mutated members and extra directories; included Git symlink/submodule rejection; unsafe raw Git paths and case collisions; ambient Git metadata override removal; ancestor-root rejection; and no automatic Git-free fallback. Its synthetic Git objects/refs exist only in disposable test repositories, never in either product worktree. Existing malformed-path/mode/CRC/extraction tests remain active.

## Exact proposed product boundary

Nine product paths are needed: producer, verifier, one historical package helper, four packaging regression files (including the new input regression), and two directly relevant contracts. The historical callers/tests explicitly selected snapshots rather than being allowed to silently weaken default release production. No application, Runtime algorithm, graph or CUDA/native source changed.

'''
for row in inventory:report+='- `'+row['path']+'`: '+row['category']+'.\n'
report+='''
The machine-readable final inventory contains byte sizes, SHA256 values and prospective Git blob identities for every path. Every `artifacts/**` path is qualification evidence/tooling and excluded from the proposed product commit. No evidence or product file was staged.

## Focused semantic security and preservation

The separate security-review document records the Git metadata/operator trust boundary, untracked injection, traversal/aliases, symlink/special behavior, checkout/index manipulation, raw binary/text preservation and explicit no-Git behavior. No unresolved Critical/High issue was identified within this bounded input-policy review; no remaining reportable issue was identified. No Codex Security tool or automated sealing was invoked. The prior accepted infrastructure exception remains unchanged: automated Codex Security completion is **UNAVAILABLE / NOT COMPLETED**, never automated PASS.

All preexisting V2 NON-PASS evidence and tracked files outside the nine-path corrective inventory retain their pre-task hashes. The older populated witness was read-only and unchanged. Git HEAD, branch, index, refs, main and qualification tags are unchanged. No application/native behavior, staging, product commit, push, tag, main update, cleanup/stash/reset of the older witness, or broader Scope 6E integrated qualification occurred.

Stop at corrective candidate review. This result closes the two measured package-input defects for the defined release mode; it does not qualify a new corrective commit, resume integrated qualification or replace historical evidence.
'''
with (a/'candy-scope6e-v2-package-input-corrective-report.md').open('x',encoding='utf8',newline='\n') as f:f.write(report)
assert all(h(r/p)==sha for p,sha in before['priorArtifacts'].items())
assert all(h(r/p)==sha for p,sha in before['trackedSha256'].items() if p not in expected)
assert not git('diff','--cached','--name-only') and git('show-ref')==before['refs']
print(json.dumps(dict(verdict=verdict,tests=test['passed'],productPaths=9,realArchiveSha256=case['sha256'],
 report=str(a/'candy-scope6e-v2-package-input-corrective-report.md'),priorFailureEvidenceUnchanged=True,olderWitnessUnchanged=True)))
