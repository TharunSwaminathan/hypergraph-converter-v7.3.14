# Hypergraph Converter Studio v7.3.15 final exact-SHA release qualification

READY FOR FINAL v7.3.15 RELEASE TAG AND MAIN PROMOTION

Candidate `335c320a052eab48d3f0c2d309805d10a5918189`; parent / qualified functional baseline `51e8a46ad527760b838bd92e78e19404d07acf40`; tree `2a9b123565fc49ec3aa344fd3edb45392c175243`. Branch `release-v7.3.15-final-qualification`. Recorded UTC: 2026-10-29T04:46:21.641257+00:00.

Every required release gate passed on the exact committed candidate. This verdict permits a subsequent human-authorized tag/main promotion step; this run did not create a tag, release, product commit or promotion.

| Required gate | Result | Evidence |
|---|---|---|
| Pre-flight and approved version-only delta | PASS | 15 approved files, +16/-16, exact parent, local/remote branch identity, clean tracked/index state; v7.3.15 absent locally/remotely. |
| Fresh source product gates | PASS | npm ci; 288/288 files in 203.5s; lint; normal and GitHub builds; production audit 0; diff check. |
| Exact candidate-SHA CI | PASS | Ubuntu build/lint/test, macOS build/test, Windows build/test; CPU source-release pull_request and push. Each actual job and required step completed successfully with head SHA equal to candidate. |
| Committed-clean and populated package | PASS | Both Git-mode archives byte-identical; independent commit-bound membership/content/mode verification; adversarial alias/source-input suites passed. |
| Fresh Git-free extraction | PASS | 288/288 files in 189.8s, install/lint/both builds/audit 0; all 885 shipped source files retain exact archive bytes; no .git. |
| Extracted Runtime | PASS | Fresh health/auth, upload/canonical IDs, literal/%3A/%3a metadata, presence/reuse, 36 raw negative routes, ownership isolation, restart/reconnect/shutdown. |
| Portable CUDA boundary | PASS | Both explicit motif backends rejected as BACKEND_UNAVAILABLE without private state; no CPU or implicit STATIC fallback/projection/false qualification; zero native jobs. |
| Existing qualified native sanity | PASS | 18 unchanged qualified inputs; ordinary production discovery and 3 STATIC + 3 incremental genuine cases with exact fingerprints and vectors; no rebuild or substitution. |
| STATIC/incremental parity | PASS | 3 controlled transitions, 12 genuine GPU jobs; difference equals signed incremental delta in all 30 bins; separate Apply, metadata reuse and stale-result checks. |
| Built-product browser smoke | PASS | Built candidate with documented Runtime feature flag; fresh tab, real qualified Runtime, 6 genuine GPU jobs, all 30 displayed STATIC/signed bins match native; graph version 2->3 only after separate Apply. Three sessions, clean/abrupt restarts, stale approval disabled, fresh execution, encoded metadata 200/no duplicate upload. |
| Bounded integrated soak/recovery | PASS | Published S1 seed 731406: 20 STATIC + 20 incremental jobs; 520 retention uploads; max 32 jobs / 512 artifacts; no corruption/fallback/crash; owned workspace/native/supervisor cleanup; clean/abrupt recovery. |
| Fresh substantive security | PASS | Zero unresolved Critical/High, source and extracted production audits zero. See security review. Automated seal remains unavailable under accepted exception. |
| Current documentation and history | PASS | v7.3.15 current identity and current integrated CANDY contracts match behavior. Phase-scoped/historical milestone, standalone and v7.3.14 release records remain unchanged. |
| GitHub Pages compatibility/state | PASS | Candidate GitHub build passed; successful prior main Pages build/deploy on parent confirmed. No candidate deployment triggered or claimed. |
| Preservation and cleanup | PASS | HEAD/tree/index/all refs/protected remote refs unchanged; 1,286 source/historical files, 1,369 V6 source/evidence files and 18 qualified inputs unchanged in bytes/size/mtime; no tracked/staged changes. Browser, preview and Runtime closed; credential file removed; no native/supervisor remains. |

## Final archive and provenance

Filename: `hypergraph-converter-studio-v7.3.15-portable-source.zip`.
Archive SHA256: `310f1e2bb1b29f52818f8ca4d2addd10f1b8b127085540854bd789c8ef092249`.
Size: 1,785,779 bytes. Entries: 941 (885 files, 56 directories). Source commit: `335c320a052eab48d3f0c2d309805d10a5918189`. Verification level: **commit-bound**; producer mode: **git**.

The clean witness is an independent clean Git checkout pinned to the candidate. The populated witness uses the actual installed/built qualification worktree; root artifacts, untracked tooling, node_modules, dist, private .local/native installations/builds and credentials do not enter either archive. ZIP filenames, normalized modes, content and all bytes agree. Git-free verification is explicitly structural-only; external trusted Git verification binds this exact archive to the candidate. Default production refuses ancestor Git metadata instead of silently falling back to a filesystem walk.

## Qualified native separation and workload limits

Portable native unavailability is required behavior. Separately, the previously recovered V6 native installation was used in place without copying, rebuilding, regenerating or substituting its state. Its 17 Runtime implementation/package files have exact working-byte and Git-blob equality with the release candidate; its host worktree remains the functional parent. Current candidate graph/controller/client code drove the live integrations. Native tags, records, source/Makefile/binary/evidence hashes, GPU and toolchain identity were checked by production discovery.

STATIC binary SHA256: `fd0e2af192a322a00f719c8289218a0e08f96a4861553d31613d1fab6c346688`. Incremental binary SHA256: `58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff`.

**64 genuine GPU jobs** total: 6 smoke + 12 parity/reuse + 6 browser + 40 S1 soak. Fixture-based unit/fault tests are not counted as genuine GPU execution. CPU reference calculations only checked expected values. No new scale, throughput, persistent-worker or public-CI GPU qualification is claimed. Restarts exercised completed jobs and pending approvals, not an in-flight GPU crash-kill.

## Security exception and documentation scope

**Codex Security automated seal: UNAVAILABLE / NOT COMPLETED — accepted infrastructure exception.** No scan/completion/seal was invoked, no automated PASS was claimed, and no product-security finding was waived. Fresh manual review and live-boundary checks found zero unresolved Critical/High findings. A bounded credential-pattern scan of all 885 archive files found no candidates; it is supporting evidence, not an exhaustive secret-detection guarantee.

Current integration behavior is documented by CANDY_SCOPE6A_RELEASE_CONTRACT, CANDY_SCOPE6C_RUNTIME_CONTRACT and PORTABLE_LOCAL_INSTALL_POLICY. Scope 3 incremental-SSSP and Scope 4 standalone milestone text is preserved as phase-scoped history/reference; it is not used as the current integrated motif availability authority. The historical v7.3.14 tag, documents, archive identities, NON-PASS evidence, exception records and interruption records were not relabeled or rewritten.

## Retained operator harness setup history

Three harness setup issues were corrected without product changes: the producer correctly rejected an output under the source tree; the first deeply nested extraction exceeded Win32 MAX_PATH; and an evidence logger initially tried to relativize an outer log to the extraction root after npm ci had already passed. Rejected/partial attempts and the original successful install receipt remain preserved. The populated ZIP was produced outside source and then copied unchanged into artifacts; the successful fresh extraction uses artifacts/x15 with maximum member path length 222. All actual product gates ran against unchanged committed/shipped bytes and passed.

## Evidence and hard stop

The final manifest contains the requested release provenance. The inventory contains hashes and exclusions for additive evidence. Root reports use the `candy-v7.3.15-final-release-` prefix: preflight, product-gates, ci, package, extracted, runtime, portable-native, native-identity, native, native-static, native-incremental, cross-check, browser, runtime-recovery, soak-native, soak, security-review, documentation, pages, manifest and inventory. Raw logs, exact archives, per-member manifests, HTTP/DOM/screenshot receipts and retained setup attempts are in `artifacts/candy-v7.3.15-final-release-work/`.

All new qualification evidence remains untracked under artifacts. Dependencies/build outputs generated by requested npm gates remain ignored. No stage, commit, amendment, merge, product push, main change, tag/release creation, native rebuild/change or new implementation scope was performed.
