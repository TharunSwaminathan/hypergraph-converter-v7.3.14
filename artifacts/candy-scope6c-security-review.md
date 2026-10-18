# Scope 6C security and reliability closure

The final working-tree review found no unresolved Critical/High issue. This is
a scoped implementation review, not a guarantee about unrelated repository code.
The final qualification and inventory bind the reviewed production bytes to the
final tests and genuine Runtime/browser observations.

## Preserved managed security review

The Codex Security `security-diff-scan` workflow completed scan
`cae6a747-1f46-48c0-8314-ceb7a19485ff`, snapshot
`codex-security-snapshot/v1:sha256:5213b262aa2a5b4628594811aa73d45aec5e7238b2412f4a0f081b88ccd137a6`.
Its immutable report remains at:

`C:\Users\tharu\.codex\state\plugins\codex-security\scans\hypergraph-converter-v7.3.14\61e3dda985b74be35e98f1e6b3886d33b58a4bfd_20261017T182123Z_i_nlmhj1\report.md`

That snapshot covered the implementation before the corrective lifecycle changes:
30 review items across five surfaces. The completed canonical scan was not
rewritten or presented as a scan of later bytes. It retained three dynamically
confirmed functional defects. Under the supplied security severity policy their
operator/self-only attack paths did not constitute reportable security
vulnerabilities; zero reportable security findings does not mean zero defects.

The managed scan reported 11,851,132 total tokens (11,817,598 input, including
11,267,072 cached; 33,534 output; 12,771 reasoning), across four rollout threads.
These tool-reported rollout totals include shared cached history and are not an
incremental billing/cost estimate. Daybreak access was not granted; the local
review and saved canonical artifacts completed.

## Corrective follow-up

The original PoC and validation output remain under the scan's
`artifacts/validation/` directory. Additive correction review and regressions close:

1. Stale PID reconciliation could race between two owners. The final root obtains
   a kernel TCP lease before inspecting marker/PID files and holds it through
   final directory removal. PID reuse is diagnostic only. Concurrent acquisition,
   stale current PID, and disposal/reacquisition regressions pass. A separate
   read-only reviewer checked failed-bind cleanup, Windows canonical path casing,
   empty socket responses, and release/reacquisition.
2. Terminal pins could exhaust storage before count eviction. Storage pressure
   now expires oldest terminal owners synchronously before unpinning/removal,
   preserving active pins. The regression fills a small real ArtifactStore,
   expires old job/result handles to 404, and successfully executes subsequent work.
3. A deadline expiring during final cleanup could publish success. Expiry now
   unconditionally revokes result authority, with a per-execution cleanup-failure
   flag preserving the current cleanup error. Both ordinary delayed cleanup and
   an unrelated manager cleanup fault are covered. A final independent read-only
   review found no remaining concrete issue in these corrections.

These checks use production ownership/storage/job code with controlled CPU
fixtures. They are distinguished from the separately recorded genuine CUDA soak.
The additive review also accounts for the new corrective regression, Runtime
contract document, gate runner and browser Runtime launcher. Together with the
original inventory, all 34 changed/new implementation, test, script and contract
files are accounted for. The gate runner invokes fixed local commands and stores
exit codes; the launcher has no network shutdown route or substituted backend.

## Authority and boundary review

Every verification still reads and validates current qualification bytes, binary,
source, evidence, tag and environment. Only immutable parsing is cached; discovery
shares one fresh environment observation within that request. No approval cache
exists. Runtime restart creates a fresh credential/session and empty job Map.
Graph/pending/session identities remain part of browser result currentness;
metadata revalidation is required for exact-byte upload reuse. STATIC and
INCREMENTAL retain distinct qualified backends with no fallback or implicit Apply.

Admission, FIFO execution, retention, HTTP operations and write buffers are
bounded. Expiry unpublishes before deletion; active pins cannot be evicted. Cleanup
uses owned regular-file unlink and empty-directory removal, never recursive
production deletion. Unknown files, links and root changes fail closed. Request
workspaces are inside the owned root. Native children retain a parent-liveness
pipe and supervised process group. Credentials are not included in receipts or
qualification reports. The controlled browser launcher writes a fresh private
pairing file and invokes production server/clean close without adding HTTP control.

The root lease contract is one private local host/network namespace. Sharing roots
across hosts/containers/Windows-WSL Runtime instances is unsupported; a hash port
collision fails closed. No native source or manifest change is included. Persistent
native workers remain deferred because the executable protocol is one-shot.

Final automated gates, exact changed-file hashes, process-group checkpoints and
fresh browser restart evidence are recorded in the companion qualification files.
No direct JavaScript heap measurement is claimed; source-byte/serialized budgets
and process RSS have their stated accounting limits.
