# Scope 6D tranche 1 binding security review

No reportable introduced vulnerability and no unresolved Critical/High issue was found in the narrow binding delta and directly supporting authority paths. This is not a repository-wide audit.

Candidate implementation commit: f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0. Reviewed product files: candy-runtime/src/capabilities/motifQualification.js (5 additions / 3 deletions) and tests/candy-scope6d-binding.test.mjs (32 new lines). Neither file changed after the full 285/285 test run.

The fixed incremental selection names the versioned native package, distinct qualification tag and versioned record. The additional raw-record SHA256 check is necessary for the requested wrong-record hash/content rejection: a self-consistent rewritten record cannot authorize alternative binaries or evidence. It affects only CUDA_INCREMENTAL. STATIC selection and record handling are unchanged.

The verifier freshly checks bounded regular source/Makefile/executable/evidence files, their exact hashes, evidence semantics/case counts, exact tag commit and GPU/toolchain. No HTTP, model, graph, environment variable or user request chooses the path or tag. No historical-record fallback exists. Parsing reuse is digest-and-byte checked, frozen and bounded; no cached availability becomes authority. Admission and NativeProcessRunner requalify independently of discovery.

Real negative cases cover missing/corrupt/CRLF files, record substitution, stale identity, wrong/missing tag and environment mismatch; STATIC remains available. An isolated executable replacement after positive discovery is rejected by NativeProcessRunner.trustedExecutable before execution. Node Windows symlink creation returned EPERM; a WSL-created source symlink was recognized by Windows lstat as symbolic and rejected. These are distinct recorded observations.

TOCTOU qualification is limited truthfully: lstat/readFile and subsequent pathname execution are separate operations. The unchanged trusted local installation/PATH/WSL/supervisor contract does not protect against an already privileged concurrent installation writer or guarantee atomic inode execution. No lower-trust graph/HTTP write path to those resources was found. This change neither widens that trust boundary nor claims to eliminate that pre-existing host assumption.

Genuine authenticated native jobs use only fingerprint sha256:58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff. Three representative exact signed 30-bin cases, 300 repeated jobs, retention expiration, clean and abrupt restart, stale credential/job/result/artifact rejection and owned-process drain pass. Browser analysis remains delta-only, never commits, requires independent Apply confirmation, and revokes results on graph/session changes. No native, protocol/schema, admission, retention or browser source changes occur.

Codex Security diff scan f6ce1795-c7be-4f2f-a6ca-4545713ad18b completed with zero findings. Report: C:\Users\tharu\.codex\state\plugins\codex-security\scans\hypergraph-converter-v7.3.14\f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0_20261023T062343Z_on4g7l8t\report.md

The workbench warned that working-tree contents changed during the scan. Changes were additive excluded diagnostics/evidence; the two reviewed product files are unchanged and hash-bound by the final qualification inventory. Historical untracked experimental scripts and evidence were explicitly excluded from the proposed-product security scope. Architecture/preflight workers were used as required by the security skill. The completed canonical coverage contains a cosmetic test line-count note of 36; actual file length is 32 and the entire unchanged file was read.

Daybreak advisory: not granted for this account; review proceeded. Partial workbench usage attribution (cumulative rollout data, not an isolated per-review cost): total 5569123, input 5549944, cached input 5304192. Attribution is partial and includes unavailable threads; no cost estimate is made.
