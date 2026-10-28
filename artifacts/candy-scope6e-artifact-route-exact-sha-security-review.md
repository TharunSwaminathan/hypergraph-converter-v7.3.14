# Committed corrective focused security closure

Candidate: 51e8a46ad527760b838bd92e78e19404d07acf40. Parent: d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2.
Reviewed server blob: 9d3f3601fe9221090bffaf4fe1abe3b63be01cea.
Reviewed integration-test blob: a5752a8dddfeed11b29b2cf0b080b2fe4abdbdda.

Substantive product security qualification PASS under the accepted
security-infrastructure exception; Codex Security automated completion seal
UNAVAILABLE / NOT COMPLETED.

Fresh manual review is limited to the committed two-path corrective, supported
by current real HTTP route/reuse/isolation regressions, 36 rejected adversarial
raw routes, and both fresh 288/288 suites. No unresolved Critical/High finding
was identified. No automated Codex Security scan/completion/sealing was invoked.

The strict raw-URL route accepts the existing literal sha256: ID or the normal
client's sha256%3A spelling (including percent-escape case %3a), then captures
exactly 64 lowercase hexadecimal digest characters. It reconstructs the fixed
canonical sha256:<digest> for the unchanged store validator/map lookup. There is
no generic percent decoding, whole-path normalization, double decoding or
unvalidated filesystem construction. No algorithm or digest case folding occurs.

Fresh live controls prove literal/%3A/%3a compatibility. Wrong digest length,
non-hex/uppercase identifiers, wrong algorithms, malformed percent escapes,
encoded slash/backslash, double-encoded colon/separators/percent, traversal,
extra components and query/fragment confusion are rejected. Fragment markers
actually transmitted in a raw HTTP path and markers supplied as an ID to the
normal encoding client are separate negative cases; browser URL fragments
ordinarily are not transmitted. Rejected aliases leave the canonical artifact
intact. Only GET metadata is recognized; POST/DELETE do not gain operations.
The anchored artifact route cannot collide with separate UUID job routes.

Existing origin and bearer checks precede routing. Missing/wrong credentials
return 401, unapproved origins 403. Two ordinary Runtime stores and credentials
remain isolated. A present artifact metadata probe avoids a reupload; actual
owned test-artifact eviction follows genuine 404 with exactly one reupload.
Authentication/origin failures propagate without an upload. No retry or cache
authority policy changed. Store ID validation remains an independent boundary.

The public client's encoding and all other production paths remain unchanged.
The limited server spelling repair preserves literal callers and standard
encoded-segment clients without partial client escaping or a general decoder.
This expands supported wire spelling, not artifact authority. The existing
trusted local-operator/per-session store boundary is unchanged.

The authoritative archive and both witnesses independently verify commit-bound
to this candidate. Private records/build state, root evidence, diagnostics and
synthetic credentials are excluded. Extracted CUDA capabilities truthfully
remain unavailable with no private state injection. No native build/job or
qualification evidence generation was needed. This is corrective security
closure, not Scope 6E V6 integrated/native qualification.
