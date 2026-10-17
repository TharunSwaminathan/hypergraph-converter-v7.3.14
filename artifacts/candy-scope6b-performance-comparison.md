# Scope 6B measured performance

Verdict: NON-PASS for full scalability qualification. Measured read-only and preview improvements coexist with cold commit and small-presentation regressions. No blanket speed claim.

| Operation | Fixture | Before median / p95 ms | After median / p95 ms | Absolute median gain ms | Relative gain |
| --- | --- | ---: | ---: | ---: | ---: |
| same_version_fingerprint | S1 | 0.0594 / 0.1622 | 0.0004 / 0.0008 | 0.0590 | 99.3% |
| same_version_counts | S1 | 0.0025 / 0.0056 | 0.0004 / 0.0006 | 0.0021 | 84.0% |
| assistant_planner | S1 | 0.0092 / 0.0267 | 0.0023 / 0.0094 | 0.0069 | 75.0% |
| mapping_presentation | S1 | 0.0046 / 0.0094 | 0.0066 / 0.0186 | -0.0020 | -43.5% |
| statistics | S1 | 0.0677 / 0.2066 | 0.0687 / 0.1513 | -0.0010 | -1.5% |
| cold_commit_plus_history | S1 | 0.0658 / 0.2108 | 0.0866 / 0.1744 | -0.0208 | -31.6% |
| same_version_fingerprint | S2 | 0.2461 / 0.3649 | 0.0006 / 0.0013 | 0.2455 | 99.8% |
| same_version_counts | S2 | 0.0151 / 0.0258 | 0.0007 / 0.0019 | 0.0144 | 95.4% |
| assistant_planner | S2 | 0.0516 / 0.0871 | 0.0037 / 0.0081 | 0.0479 | 92.8% |
| mapping_presentation | S2 | 0.0116 / 0.0234 | 0.0193 / 0.0291 | -0.0077 | -66.4% |
| statistics | S2 | 1.2794 / 1.8720 | 1.2604 / 1.5519 | 0.0190 | 1.5% |
| cold_commit_plus_history | S2 | 0.2757 / 0.3900 | 0.3205 / 0.4249 | -0.0448 | -16.2% |
| same_version_fingerprint | B1 | 35.2825 / 43.1485 | 0.0025 / 0.0031 | 35.2800 | 100.0% |
| same_version_counts | B1 | 1.9168 / 2.0619 | 0.0019 / 0.0032 | 1.9149 | 99.9% |
| assistant_planner | B1 | 5.8099 / 14.2342 | 0.0147 / 0.0182 | 5.7952 | 99.7% |
| mapping_presentation | B1 | 0.1984 / 6.8731 | 0.2346 / 0.2826 | -0.0362 | -18.2% |
| statistics | B1 | 8.5932 / 16.6499 | 10.7501 / 15.7144 | -2.1569 | -25.1% |
| cold_commit_plus_history | B1 | 41.2710 / 49.7977 | 48.6904 / 55.9943 | -7.4194 | -18.0% |
| dynamic_stage | S1 | 0.7832 / 1.0038 | 0.6790 / 0.9181 | 0.1042 | 13.3% |
| dynamic_inspect | S1 | 0.0235 / 0.0363 | 0.0272 / 0.0432 | -0.0037 | -15.7% |
| dynamic_apply | S1 | 0.8462 / 1.1228 | 0.7620 / 1.1320 | 0.0842 | 10.0% |
| dynamic_stage | S2 | 2.9537 / 3.6167 | 2.6807 / 3.2474 | 0.2730 | 9.2% |
| dynamic_inspect | S2 | 0.0789 / 0.1140 | 0.0794 / 0.0982 | -0.0005 | -0.6% |
| dynamic_apply | S2 | 3.5115 / 4.0725 | 2.8476 / 3.3639 | 0.6639 | 18.9% |
| large_mapping_presentation | B5 | 36.2610 / 51.5515 | 0.0021 / 0.0094 | 36.2589 | 100.0% |

Primary pre-edit B5 topology: 1357.2368 ms and 1,000,000 prepared vertices; after: 0.5703 ms and 1,000 prepared vertices. Absolute gain 1356.6665 ms (99.958%); one cold sample, display subset only. Full one-million-membership export still matched 10,000,002 characters in the live browser. B1 replacement: 109.2671 -> 55.7034 ms (one sample); B5 replacement: 150.2220 -> 185.4150 ms (regression, one sample).

B1 cold commit plus history median regressed 41.2710 -> 48.6904 ms; p95 49.7977 -> 55.9943 ms, exceeding the plan's proposed 10% p95 threshold. Deep owned snapshot creation adds first-commit work; no assertion that this tradeoff is accepted. S1/S2 small-cell formatting has extra bounded-display overhead. Direct computeStats remains unoptimized; B1 median is slower although p95 improved. Dynamic Inspect shows no meaningful improvement.

Methods: Node v24.20.0, Intel Core Ultra 5 225F, Windows 10.0.26300, 33,847,996,416 RAM bytes. Primary before/after: monotonic production-function calls, five warmups/30 warm samples for S1/S2/B1; B5 three warm fingerprint/count samples and one cold topology. Supplement: three sequential sessions, five warmups plus 30 repeats; cold commit/history 20 new state instances/session. Exact baseline modules were extracted from da4629b1f4204fbfc8f8e6d14941d29319d79e90; current modules were the final implementation. No randomized AB/BA or confidence interval; session/order/JIT/GC confounding remains. Cold state starts are not cold browsers or cleared OS caches.

The initial supplement contains 420 invalid GraphMutationPlan attempts (UPDATE_WEIGHT); these harness errors are retained, not counted as successful timings. Corrected Stage/Inspect/Apply uses SET_HYPEREDGE_WEIGHT and separately confirmed Apply with exactly one commit and no native jobs.

Browser roundtrip samples include automation/locator overhead and are kept separate. Several large-input selectors timed out at the automation layer; no p95 interaction/paint SLO follows. No browser retained/peak heap, GC plateau, frame trace, thermals or power measurements were obtained. Snapshot JSON accounting and cache text bytes are deterministic proxies, not JS heap estimates. No native/GPU scale qualification is claimed.

Remaining measurement gaps: matched full-browser before/after cold/warm distributions for ordinary render, tab/preview/search, history/undo and exports; instrumented whole-graph copy counts on every path; browser heap lifecycle; complete plan fixture grid B2/B3/optional B4-5M and overlap/ID shapes. Existing B4-2M file was actually attempted and rejected by unchanged 10 MiB upload admission; no easier replacement was substituted.
