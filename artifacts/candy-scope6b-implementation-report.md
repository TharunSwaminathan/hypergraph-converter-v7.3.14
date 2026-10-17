# Scope 6B implementation and qualification

**NON-PASS** for full browser scalability qualification. Implementation is present and all automated gates pass. Do not treat this working tree as a qualified release.

Required branch candy-integration-scope6b-browser-scalability-v7_4; baseline/HEAD/remote/qualification anchor initially exactly da4629b1f4204fbfc8f8e6d14941d29319d79e90 with clean tree. No AGENTS.md found in repository or ancestor directories. Historical Scope6/6A/v7_4/RC evidence is unchanged. No commit, push, tag or merge performed.

Implemented: module-owned detached deeply frozen graph snapshots; content-bound WeakMap canonical/fingerprint/count/planner reuse with mutable/exotic bypass; exact collision-safe no-op checks and replacement/type identity retained. History shares immutable adjacent snapshots and applies deterministic25-event/32MiB snapshot-JSON accounting; UI exposes retention and unavailable undo. H2V/V2H/H2H/V2V/CSR stay demand-driven; stable idle derived results, graph-only validation/triad/incidence selectors and active-export memo avoid unrelated render work. Derived cache caps32 entries/16MiB top-level strings; oversized exact output is still returned. Preview bounding precedes topology/layout and caps200 edges/1000 vertices/3000 memberships; labels show totals, subset, source-order selection and filter scope. Vertex list is paged, list indexOf removed and draw highlights hoisted. Mapping rows/cells are bounded and explicitly labelled. Assistant snapshots stay compact/live/read-only; planner index reuse is immutable-only and sampled keys no longer fully materialized. Local model structured/streamed responses reject above8MiB. Pending oversized bases reject before preview.

Validation: npm ci PASS; full suite278/278 PASS in143.7s (274 original plus4 new Scope6B files); lint/build/build:github PASS; production audit0 vulnerabilities; diff whitespace PASS. EOF whitespace cleanup after the last full suite was followed by the targeted data-path test and lint/both builds. Input/parser/mapping/algorithm/Assistant/authority regressions were executed, not inferred from inspection.

Fresh browser: source server5173 and Runtime-enabled server5176 each HTTP200 before automation. Small/S2/B1 exercised; B1 full489999-character export matched. B5 one-million-member graph loaded, prepared1000 display vertices and exact10000002-character export matched; large automation timeouts prevent a latency-SLO claim. Exact B4-2M fixture20688889 bytes was rejected by unchanged10485760-byte upload limit; screenshot retains the refusal. No easier fixture substituted for that result. Fresh genuine Runtime8791 health200; CUDA_STATIC total1 on RTX5060sm120; CUDA_INCREMENTAL delta-1 with graph unchanged at2; separate Apply committed3 and invalidated result. Edit/metadata/discard truth checked. Small browser-only Apply/undo and current Assistant counts checked. No Ollama startup or fresh model-generation claim.

Measured gains and regressions are in candy-scope6b-performance-comparison.md. B1 repeated fingerprint35.2825 ->0.0025ms, planner5.8099 ->0.0147ms. B5 topology1357.2368 ->0.5703ms (single cold sample; display subset). B1 cold commit/history41.2710 ->48.6904ms median and49.7977 ->55.9943ms p95 regressed. These are production-function measurements; no end-to-end browser speed, statistical significance or large CUDA claim.

Security diff scan completed with27 surfaces/0 findings; original-snapshot warning is explicitly retained. Reliability performance gaps still block full qualification.

Blockers:
- B1 cold commit/history p95 regressed 49.7977 ->55.9943ms (12.44%), above the benchmark plan proposed10% threshold; no accepted tradeoff or randomized/noise study.
- Full matched before/after browser interaction, paint and heap/retention qualification is incomplete. B5 search automation had unresolved selector timeouts.
- Largest B4 file was truthfully rejected by current upload admission; large editing/native capacity is not qualified.

Remaining limits:
- Initial import/normalization/owned snapshot and first index creation remain synchronous O(I); cold commits regressed.
- Preview display capped to 200 hyperedges, 1000 vertices, 3000 memberships; vertex list paged at100; filters search the displayed subset; source order determines selection.
- Mapping display capped to500 rows and40 items/512 nominal characters plus omission label per cell. Exact exports are unchanged.
- History retains at most25 events and32MiB of unique snapshot UTF-16 JSON accounting; oldest evicted first; an event exceeding budget leaves no retained undo event. Metadata/engine overhead is outside that accounting.
- Derived cache holds at most32 entries and16MiB top-level string accounting; nested objects and active demanded export are not total heap capped.
- Raw input, parser results, large demanded exports and first planner index can be large. Full export is exact and may take whole-output work.
- Pending DynamicHypergraph base remains within256 hyperedges/100000 incidences; no larger editing/analysis contract introduced; apply still rederives exact data.
- Existing upload limit is10MiB per file; B4-2M fixture was rejected and capacity was not raised.
- No native limits, taxonomy, Runtime job/artifact reuse or CUDA optimization changed. Browser fixture scale is not CUDA qualification.
- Model response is limited to8MiB UTF-8; platforms without a streaming reader check after text acquisition; actual fetch streams are bounded during reading.
- No browser p95/paint/heap/GC plateau qualification; Chrome/in-app automation errors are retained.
- Existing production bundle-size warning remains.

Evidence: prechange map/inventory; immutable primary before and final after samples; supplementary paired data including failed harness attempts; corrected dynamic and large-mapping samples; performance comparison; full gate logs/test-results; browser fixture hashes/screenshots/qualification; security review; final qualification and inventory.

Human review boundary reached. No changes to candy-runtime/native/** or candy-runtime/src/**, package manifests, historical evidence, released v7.3.14 or the qualification tag. Scope6C/6D not started.

Cleanup: task-owned services stopped and browser pairing cleared. Automatic approval review rejected deletion of C:/Users/tharu/AppData/Local/Temp/candy-scope6b-runtime-pairing.txt with "blocked by policy". The expired Runtime credential file remains in place; no deletion workaround was attempted.
