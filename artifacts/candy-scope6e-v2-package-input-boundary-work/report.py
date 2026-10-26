import hashlib,json,os,pathlib,subprocess
from datetime import datetime,timezone
r=pathlib.Path.cwd();a=r/'artifacts';o=a/'candy-scope6e-v2-package-input-boundary-work';env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf8'))
def git(*args):return subprocess.check_output(['git',*args],cwd=r,env=env).decode('utf8').strip()
def save(p,value):
    with p.open('w',encoding='utf8',newline='\n') as f:json.dump(value,f,indent=2);f.write('\n')
b=read(o/'before.json');w=read(o/'real-witness-review.json');tests=read(o/'focused-tests.json');preserve=read(o/'preservation.json')
contracts=read(o/'test-contract-review.json');gates=read(a/'candy-scope6e-v2-package-input-work/gates.json')
compat=read(a/'candy-scope6e-v2-package-input-work/scope6a-compatibility.json')
assert git('branch','--show-current')=='candy-integration-scope6e-v2-package-input-corrective'
assert git('rev-parse','HEAD')==b['head']=='d22b9c89f79446fbfea2480e98e807f8da4dfbf4'
assert not git('diff','--cached','--name-only')
assert w['identicalBytes'] and len(w['oldScripts'])==22
assert all(t['exitCode']==0 for t in tests) and all(t['assertionsAndAllOtherCodePreserved'] and not t['lessStrictAssertions'] for t in contracts)
assert compat['status']=='PASS' and compat['identicalBytes']
assert len({v['sha256'] for v in compat['cases']})==1
assert all(v['integrity']['verificationLevel']=='commit-bound' for v in compat['cases'])
assert gates['allPass'] and all(h(r/p)==sha for p,sha in gates['sourceSha256'].items())
assert all(h(r/v['path'])==v['sha256'] for v in gates['results'])
assert all(h(r/p)==sha for p,sha in b['trackedSha256'].items())
assert all(h(r/p)==sha for p,sha in b['priorArtifactSha256'].items())
assert git('show-ref')==b['refs'] and h(pathlib.Path(git('rev-parse','--git-path','index')))==b['indexSha256']
classifications=[
 ('scripts/package-portable-source.py','A','PRODUCT/CONTRACT FILES','Required product corrective: replaces implicit filesystem release inputs with a pinned commit tree/raw blobs; retains explicit reviewed snapshots for Git-free compatibility.'),
 ('scripts/verify-portable-archive.py','A','PRODUCT/CONTRACT FILES','Required product corrective: independently derives trusted committed membership/content and rejects extra/missing/changed files/directories, while preserving structural policy and explicit verification levels.'),
 ('scripts/qualify-scope6a-package.py','A','PRODUCT/CONTRACT FILES','Required production qualification caller: its temporary no-Git clean/populated trees must use explicit snapshots assembled from the same committed blobs as actual release production, with independent commit-bound verification.'),
 ('docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md','C','PRODUCT/CONTRACT FILES','Required current contract update: the old unconditional intended-untracked/observed-byte policy would contradict the corrected release mode; preserves historical capture-time claims and explicitly documents Git-free snapshots.'),
 ('docs/PORTABLE_LOCAL_INSTALL_POLICY.md','C','PRODUCT/CONTRACT FILES','Required source trust-boundary documentation: distinguishes committed release authority from explicit reviewed snapshots, no automatic fallback, external trusted verifier inventory and structural-only results.'),
 ('tests/candy-rc2-package.test.mjs','B','TEST FILES','Required compatibility regression: constructs no-Git temporary trees and deliberately adds a nested source fixture. Explicit snapshot mode preserves that existing contract; every assertion and all other code are unchanged.'),
 ('tests/candy-scope6e-package.test.mjs','B','TEST FILES','Required prior-fix regression: constructs synthetic no-Git clean/populated and unsafe-name trees. Two explicit snapshot arguments preserve the same alias/local-install/metadata/extraction assertions; no assertion changed.'),
 ('tests/zip-permissions-v7-3-11.test.mjs','B','TEST FILES','Required metadata regression in both contexts: explicitly selects Git for a checkout and snapshot for an extracted source tree. No permission/executable/non-Unix/entry-count assertion was removed or relaxed.'),
 ('tests/candy-scope6e-package-input.test.mjs','B','TEST FILES','Required independent new regression: disposable commits test arbitrary untracked injection, EOL/dirty binary checkout changes, exact committed binary/script/native/fixture content, independent inventory tampering rejection, unsafe Git modes/paths, metadata overrides, ancestor roots and no silent fallback.')]
expected={p for p,_,_,_ in classifications}
tracked_nums={row.split('\t',2)[2]:(int(row.split('\t')[0]),int(row.split('\t')[1])) for row in git('diff','--numstat').splitlines()}
new='tests/candy-scope6e-package-input.test.mjs'
proc=subprocess.run(['git','diff','--no-index','--numstat','--','/dev/null',new],cwd=r,env=env,capture_output=True,text=True)
assert proc.returncode==1
fields=proc.stdout.strip().split('\t',2);tracked_nums[new]=(int(fields[0]),int(fields[1]))
assert set(tracked_nums)==expected
rows=[]
for p,category,group,reason in classifications:
    additions,deletions=tracked_nums[p]
    rows.append(dict(path=p,classification=category,group=group,reason=reason,status='new untracked addition' if p==new else 'modified tracked',
       additions=additions,deletions=deletions,bytes=(r/p).stat().st_size,sha256=h(r/p),prospectiveGitBlob=git('hash-object','--path='+p,p)))
assert sum(v['additions'] for v in rows)==415 and sum(v['deletions'] for v in rows)==55
assert all(p.startswith(('scripts/','tests/','docs/')) for p in expected)
assert not git('diff','--name-only','--','candy-runtime/native','candy-runtime/src','src','package.json','package-lock.json')
checks=[]
for args in [['diff','--check'],['-c','core.autocrlf=false','-c','core.safecrlf=false','diff','--no-index','--check','--','/dev/null',new]]:
    p=subprocess.run(['git',*args],cwd=r,env=env,capture_output=True,text=True)
    assert not p.stdout and not p.stderr
    assert p.returncode==0 if args[0]=='diff' else p.returncode==1
    checks.append(dict(command=['git',*args],exitCode=p.returncode,whitespaceErrors=[],note='New-file no-index comparison returns 1 for a difference; there is no whitespace error output.' if args[0]!='diff' else 'PASS'))
verdict='READY TO CREATE SCOPE 6E V2 PACKAGE INPUT CORRECTIVE CANDIDATE COMMIT';now=datetime.now(timezone.utc).isoformat()
report_path=a/'candy-scope6e-v2-package-input-candidate-boundary-review.md'
inventory_path=a/'candy-scope6e-v2-package-input-proposed-commit-inventory.json'
assert not report_path.exists() and not inventory_path.exists()
# Prepare the two new records first so the final Git/untracked inventory includes
# the records themselves. No earlier evidence is overwritten.
report_path.touch(exist_ok=False);inventory_path.touch(exist_ok=False)
untracked=[p for p in git('ls-files','--others','--exclude-standard','-z').split('\0') if p]
ignored=[p for p in git('ls-files','--others','--ignored','--exclude-standard','-z','artifacts/').split('\0') if p]
assert [p for p in untracked if not p.startswith('artifacts/')]==[new]
artifact_paths=sorted(set(p for p in untracked if p.startswith('artifacts/'))|set(ignored))
policy=dict(membership='Pinned resolved commit tree, with existing independent release exclusions',committedBytes='Raw content-addressed Git blobs; no index or checkout reads',
 untrackedFiles='Not eligible in default qualified Git mode; includes arbitrary future filenames, not a 22-name exclusion list',
 eol='Checkout LF/CRLF cannot affect raw committed blobs; no blind text rewriting',binary='Exact committed binary bytes, including NUL/CRLF, preserved',
 gitAvailable='Source root must match Git worktree root; selected ref resolved once; verify blob type/length/hash',
 gitUnavailable='Default release refuses; no automatic walk and no ancestor-root substitution',
 explicitSnapshot='Operator explicitly selects snapshot mode for reviewed Git-free source, intentional fixtures or draft source; not a committed release claim',
 qualifiedVerification='Independent external trusted Git source root/revision; compares full file/directory membership and content; never trusts producer metadata',
 structuralVerification='Explicitly labelled structural-only; ok is not a source-identity qualification',
 determinismConditions='Same resolved commit, producer/policy version, project-root spelling and compatible compression implementation; no cross-zlib-version bit identity claim',
 uncommittedCandidate='Not silently inserted into default HEAD release; review snapshot and future exact-SHA commit qualification remain distinct')
security=dict(reviewScope='Changed package input boundary and direct historical packaging callers',unresolvedCritical=0,unresolvedHigh=0,
 automaticSecuritySeal='UNAVAILABLE / NOT COMPLETED',automatedCodexSecurityInvoked=False,
 assessment=[
  'Untracked and malicious checkout files cannot influence Git-mode membership or bytes; synthetic independent test also changes a binary checkout.',
  'Git metadata and the operator-selected revision are trusted release inputs, not publisher signatures. Ambient GIT overrides and replacement objects are disabled; raw blob identities are verified.',
  'Raw Git names reject traversal, controls, Windows aliases and collisions before host Path conversion. Included Git symlinks/submodules reject; no checkout symlink targets are read by release mode.',
  'Snapshot mode intentionally admits reviewed filesystem source and remains unqualified; missing/broken Git never automatically enables it. Existing structural controls remain independent.',
  'Commit-bound verifier detects arbitrary extra files, missing files, altered binaries and directory mismatches using its own Git inventory. Structural-only acceptance is not promoted into a committed identity claim.'],
 limitations=['Bounded review, not a repository-wide security certification.','Mutable snapshot mode assumes a reviewed source tree; it is not a concurrent hostile-filesystem sandbox.','No general arbitrary-source secret detection or publisher authenticity claim.'],
 dependencyContext='Production audit in hash-bound full gates was zero. npm ci retained preexisting development-dependency advisories; dependency manifests are unchanged and this review does not claim a globally clean development audit.')
record=dict(recordedAt=now,verdict=verdict,branch=git('branch','--show-current'),head=b['head'],baseline=b['head'],
 classifications=rows,unnecessaryNonArtifactPaths=[],productContractFiles=[x['path'] for x in rows if x['group']=='PRODUCT/CONTRACT FILES'],
 testFiles=[x['path'] for x in rows if x['group']=='TEST FILES'],totals=dict(paths=9,additions=415,deletions=55,
 productContractPaths=5,productContractAdditions=257,productContractDeletions=51,testPaths=4,testAdditions=158,testDeletions=4),
 diffCheck='PASS',whitespaceChecks=checks,sourcePolicy=policy,testContractReview=contracts,realWitnessReconfirmation=w,
 focusedTestResults=tests,engineeringFullGates=dict(path='artifacts/candy-scope6e-v2-package-input-work/gates.json',sha256=h(a/'candy-scope6e-v2-package-input-work/gates.json'),
 allCurrentProposedHashesMatchPassedRun=True,testFilesPassed=287,lintBuildBuildGithub='PASS',productionVulnerabilities=0),
 scope6aHelperCompatibility=dict(status='PASS',allThreePackagesCommitBound=True,threeArchivesByteIdentical=True,
 evidence='artifacts/candy-scope6e-v2-package-input-work/scope6a-compatibility.json',sha256=h(a/'candy-scope6e-v2-package-input-work/scope6a-compatibility.json')),
 securityReview=security,evidenceToolingMustNotCommit=dict(pattern='artifacts/**',explicitExamples=[
 'artifacts/candy-scope6e-v2-package-input-work/qualify.py','artifacts/candy-scope6e-v2-package-input-work/report.py'],
 changedUntrackedAndIgnoredPaths=artifact_paths,temporaryDirectoriesOutsideRepository='Disposable qualification/test fixtures; never candidate inputs'),
 fullCurrentUntrackedInventory=untracked,ignoredEvidenceInventory=ignored,stagedPaths=[],protectedPathsUnchanged=True,
 preservation=preserve,noProductEditsDuringBoundaryReview=True,noStageCommitPushTagMergeMainOrIntegratedQualification=True,
 oldEngineeringElevenPathExplanation='Nine justified non-artifact candidate files plus two evidence-only engineering helpers (qualify.py/report.py); not eleven product files. Current complete artifact inventory is enumerated separately.')
save(inventory_path,record)
text=f'''# Scope 6E V2 package input corrective — candidate commit boundary review

**{verdict}**

Reviewed {now}. Branch `{record['branch']}`; HEAD/baseline `{b['head']}`. No staged changes. This review made no product-source edits and performed no staging, commit, push, tag, merge, main update, older-witness cleanup or broader integrated qualification.

## Exact proposed inventory and classification

The CURRENT Git inventory contains **eight modified tracked product paths and one untracked regression test**: **nine proposed files, 415 additions, 55 deletions**. The earlier eleven-edited-path description included nine product/test/contract files plus two evidence-only engineering helpers. It is not an eleven-product-file boundary. No non-artifact path is classified D (unnecessary).

| Path | Classification | Reason | + | − |
| --- | --- | --- | ---: | ---: |
'''
for x in rows:text+=f"| `{x['path']}` | {x['classification']} | {x['reason']} | {x['additions']} | {x['deletions']} |\n"
text+='''
A = REQUIRED PRODUCT CORRECTIVE; B = REQUIRED REGRESSION TEST; C = REQUIRED CONTRACT/DOCUMENTATION UPDATE; D = UNNECESSARY / SHOULD NOT ENTER CANDIDATE.

PRODUCT/CONTRACT FILES — five paths, 257 additions / 51 deletions:

'''
for p in record['productContractFiles']:text+='- `'+p+'`\n'
text+='\nTEST FILES — four paths, 158 additions / 4 deletions:\n\n'
for p in record['testFiles']:text+='- `'+p+'`\n'
text+='''
`git diff --check`: **PASS**. The untracked test was separately checked with a no-index comparison against `/dev/null`; no whitespace errors were reported. New-file statistics are included above, unlike ordinary tracked-only `git diff --stat`. Nothing has been staged.

## EVIDENCE/TOOLING — MUST NOT COMMIT

**Every `artifacts/**` path is excluded from this candidate**, including explicitly:

- `artifacts/candy-scope6e-v2-package-input-work/qualify.py`
- `artifacts/candy-scope6e-v2-package-input-work/report.py`
- All engineering/boundary-review helpers, historical reports, ZIPs, logs, manifests, snapshots, reproduction records and generated/ignored qualification outputs.

The companion JSON enumerates every current Git-untracked path and every ignored artifact path, separately from the exact nine-file candidate. Existing tracked historical artifacts are unchanged and outside this delta. Temporary directories outside the repository and the older local native installation are never candidate files. No diagnostic/tooling path was included merely because it was convenient during testing.

## Source-of-truth policy review

1. **Membership:** Git mode enumerates the one resolved commit tree and applies release exclusions; it does not discover eligible source by walking arbitrary worktree files.
2. **Committed bytes:** content-addressed raw Git blobs are read and their type/length/digest verified. Index/staged/dirty checkout bytes are not used.
3. **Untracked files:** arbitrary filenames under `scripts/`, `src/` or other otherwise-allowed directories cannot enter that committed inventory. The 22 names are not hardcoded.
4. **LF/CRLF:** checkout representations never become release bytes; the exact blob is used rather than blindly normalizing file content.
5. **Binary:** raw blob bytes are preserved, including embedded NUL, all byte values and CRLF. Fresh disposable-commit regression verifies this even after the binary checkout is changed. This real source archive currently selects no PNG/ICO/WOFF assets outside excluded historical artifacts; no real binary-member count is invented.
6. **Usable Git:** the source root must be the actual worktree root; the ref is pinned once. Ambient metadata overrides and replacements are disabled. Git metadata and the selected revision are operator trust boundaries, not publisher authenticity.
7. **No Git:** default release production fails. It does not discover an ancestor repository or silently enable a filesystem fallback.

Git-free capability remains only through an **explicit operator/caller snapshot choice**, preserving reviewed extracted trees and intentional fixtures. Such a mutable snapshot is not a committed release and does not inherit source identity. Independent qualified verification requires a trusted external Git root/revision and checks every expected file byte/path and directory. The verifier never imports producer policy or trusts an in-ZIP inventory. Reports without the external source root explicitly say `structural-only`; structural `ok` does not qualify membership.

Determinism is bounded to the same commit, producer/policy version, root name and compatible compression implementation. This review does not assert bit identity across arbitrary zlib implementations or equate an uncommitted review snapshot with a future committed release. Default HEAD releases deliberately exclude the current uncommitted corrective; the separately hashed reviewed candidate snapshot and future exact-SHA qualification remain necessary.

## Fresh real-witness reconfirmation

The current producer was invoked directly against the actual clean and older populated worktrees, using the same exact committed revision and archive root `product`. The older witness remained read-only. Both outputs passed independent commit-bound verification and have identical bytes and counts:

'''
c=w['cases'][0]
text+=f"- SHA256: `{c['sha256']}`\n- Bytes: **{c['bytes']:,}**\n- Entries: **{c['entries']}**\n- Files: **{c['files']}**\n- Directories: **{c['directories']}**\n"
text+='''
All 22 untracked Scope 6D scripts remain present in the older input but absent from the ZIP. Local-install and root-artifact state remain absent; production native source and `candy-runtime/src/artifacts/artifactStore.js` remain included. The shared checkout EOL differences cannot affect raw committed output. Fresh regression covers exact committed binary content independently. Prior measured V2 failure ZIPs and reports remain unchanged rather than being replaced with the corrected result.

## Historical test and contract integrity

The three changed pre-existing tests were compared to HEAD after removing only the explicit source-mode call changes. With consistent UTF-8/EOL decoding, **the entire remaining code is identical**, including every assertion, error check and control. **No assertion became less strict.**

- RC2 intentionally constructs Git-free temporary copies and a nested uncommitted fixture; making that snapshot choice explicit preserves the test instead of bypassing Git authority for releases. Its contamination, metadata, native-source and extracted Runtime assertions are unchanged.
- The existing Scope 6E test uses synthetic no-Git fixture trees, including POSIX unsafe-name trees. Two explicit snapshot arguments keep the same byte-identity, local-install, Windows alias, path, metadata and extraction checks. No successful case was removed.
- The permissions regression explicitly chooses Git for a checkout and snapshot for a Git-free extraction. Its permission masks, executable suffix allowlist, create-system and minimum-member checks are unchanged. Missing/broken metadata does not silently change the producer's default policy.

The new input-policy regression independently constructs disposable Git objects/refs and verifies committed source selection, arbitrary untracked names in unrelated directories, dirty/EOL/binary checkout irrelevance, intended committed script/native/fixture inclusion, exclusions, independent member mutation/addition/removal rejection, unsafe included Git modes, raw aliases/case collisions, ambient metadata overrides and explicit no-Git behavior. It does not rely on a producer's archive manifest to authorize extra source. No synthetic fixture commit/ref belongs to either product worktree.

The two documentation updates truthfully distinguish current qualified release policy from historical captured source bytes and explicit snapshots. The old Scope 6A helper had to change because its temporary clean/populated trees have no Git metadata: it now assembles those copies from committed blobs and explicitly snapshots them, while independently checking actual/clean/populated packages against the same external commit. The retained hash-bound helper run shows all three identical and commit-bound. Historical evidence itself is untouched.

## Verification and security conclusion

Freshly reran the new input-policy test and all three changed pre-existing tests: **all PASS**. The existing full engineering run remains bound to every current proposed file hash: **287/287 test files**, lint, both builds, production audit zero and diff-check PASS. A broader full rerun was unnecessary because no proposed bytes changed. The observed install-time development advisories remain in retained logs; no clean global development audit is claimed and dependency manifests are unchanged.

Focused review of the package input boundary found **no unresolved Critical or High issue**. Git metadata/ref selection remains explicitly trusted; untracked/dirty checkout state has no release authority; raw Git paths and modes are checked; binary bytes are not transformed; independent verification is external to the archive; explicit snapshot review cannot silently become committed release qualification. The prior local-install, trailing-dot/space, mixed/backslash, traversal/absolute, metadata and canonical production-path controls remain intact and their focused regression passed.

No Codex Security automated completion or sealing was invoked. The already accepted infrastructure exception remains historical; the automated seal is **UNAVAILABLE / NOT COMPLETED**, never automated PASS. This is a bounded candidate review, not repository-wide certification or integrated Scope 6E qualification.

## Protected boundaries and hard stop

No changes exist under `candy-runtime/native/**`, `candy-runtime/src/**`, `src/**`, `package.json` or `package-lock.json`. The current product bytes were unchanged by this review; all prior artifact hashes, refs and index bytes are preserved. The older tracked files, 22 scripts, local-install files, status and index are unchanged. No implementation correction was needed or made.

The proposed commit contains exactly the five product/contract paths and four tests above. **Exclude all evidence/tooling. Do not stage or commit as part of this review.** Stop after this exact inventory; no tag, merge, main promotion or broader integrated qualification has occurred.
'''
report_path.write_text(text,encoding='utf8',newline='\n')
assert all(h(r/p)==sha for p,sha in b['trackedSha256'].items())
assert all(h(r/p)==sha for p,sha in b['priorArtifactSha256'].items())
assert git('show-ref')==b['refs'] and h(pathlib.Path(git('rev-parse','--git-path','index')))==b['indexSha256']
assert not git('diff','--cached','--name-only')
print(json.dumps(dict(verdict=verdict,paths=9,additions=415,deletions=55,diffCheck='PASS',lessStrictHistoricalAssertions=0,
 excluded='artifacts/**',currentUntrackedPaths=len(untracked),untrackedAndIgnoredEvidencePaths=len(artifact_paths),
 report=str(report_path),inventory=str(inventory_path),productSourceEditsDuringReview=0)))
