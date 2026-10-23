# Scope 6D controlled baseline matrix

All 30 accepted fixture cases passed all-30-bin parity, totaling 54 genuine CUDA jobs; 14 rejection/byte-boundary probes passed. Eight seeded STATIC and eight seeded INCREMENTAL random fixtures use independent set-oracle truth. Larger deterministic fixtures use exact disjoint/coincident/hub/chain formulas. CPU calculation is validation only, never a production fallback. Seed: 0x6d202610. Recipes: scripts/measure-scope6d-native.mjs. No optimized implementation is measured.

V/E/I describes OLD for incremental. Full NEW cardinality distributions, incidence/work counts, deletion/insertion counts, estimates, observed memory and expected bins are in the JSON. Host pack is one independent timing per fixture. Other times are medians where n>1; single-sample boundaries are descriptive. Fixture/pending-update derivation occurs before clocks. Runtime prep includes artifact read/parse/pack/workspace write; native wall includes WSL/setsid initialization and teardown. Event interval is not pure GPU active time. E2E includes workflow/upload/admission/fresh qualification/result validation, excluding independent oracle and standalone pack timings.

| Fixture | Mode | V/E/I | Card min–max | Candidates all or OLD/NEW | Packed bytes | Host pack ms | Runtime prep ms | Native wall ms | Event ms | Runtime E2E ms | Result bytes | n |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A-many-small | STATIC | 256/128/256 | 2–2 | 341376 | 1763 | 0.703 | 5.169 | 267.382 | 0.608 | 668.666 | 1790 | 3 |
| B-high-cardinality | STATIC | 25000/4/100000 | 25000–25000 | 4 | 556003 | 86.254 | 100.769 | 288.904 | 4.859 | 888.394 | 1801 | 3 |
| C-sparse-overlap | STATIC | 193/64/256 | 4–4 | 41664 | 1512 | 0.300 | 4.662 | 269.277 | 0.682 | 675.487 | 1800 | 3 |
| D-dense-overlap | STATIC | 4/64/256 | 4–4 | 41664 | 1140 | 1.259 | 4.299 | 272.106 | 0.707 | 668.763 | 1804 | 3 |
| E-open-wedges | STATIC | 65/64/128 | 2–2 | 41664 | 959 | 0.271 | 4.666 | 258.092 | 0.693 | 675.819 | 1794 | 3 |
| F-closed-triangles | STATIC | 65/64/128 | 2–2 | 41664 | 988 | 0.504 | 4.580 | 274.545 | 0.836 | 760.319 | 1810 | 3 |
| G-local-128 | INCREMENTAL | 129/128/256 | 2–2 | 8001/8001 | 4174 | 3.852 | 7.240 | 268.279 | 1.067 | 729.010 | 2401 | 3 |
| G-local-near-216 | INCREMENTAL | 1/216/216 | 1–1 | 23005/23005 | 4762 | 2.002 | 6.856 | 282.256 | 1.107 | 717.998 | 2444 | 3 |
| H-high-impact-128 | INCREMENTAL | 129/128/256 | 2–2 | 341376/341376 | 5114 | 1.833 | 8.192 | 280.845 | 1.114 | 739.001 | 2448 | 3 |
| H-full-replace-216 | INCREMENTAL | 1/216/216 | 1–1 | 1656360/1656360 | 6394 | 1.978 | 7.694 | 290.451 | 2.774 | 716.496 | 2457 | 3 |
| I-edge-216-inc-217 | STATIC | 217/216/217 | 1–2 | 1656360 | 1930 | 0.610 | 4.490 | 262.433 | 0.874 | 689.751 | 1801 | 3 |
| I-work-64-inc-2560 | STATIC | 40/64/2560 | 40–40 | 41664 | 7747 | 0.712 | 4.577 | 271.293 | 0.711 | 711.680 | 1810 | 3 |
| I-incidence-cardinality-100000 | STATIC | 100000/1/100000 | 100000–100000 | 0 | 589364 | 221.174 | 198.447 | 288.799 | 0.702 | 1153.577 | 1826 | 1 |
| I-incremental-inserted-100000 | INCREMENTAL | 1/1/1 | 1–1 | 0/0 | 589878 | 379.785 | 368.811 | 271.700 | 1.345 | 1420.356 | 2484 | 1 |
| R0-static | STATIC | 6/4/9 | 1–4 | 4 | 394 | 0.202 | 3.644 | 291.416 | 0.842 | 709.544 | 1782 | 1 |
| R0-incremental | INCREMENTAL | 6/4/9 | 1–4 | 3/3 | 901 | 0.179 | 4.893 | 283.633 | 0.976 | 647.701 | 2409 | 1 |
| R1-static | STATIC | 5/5/11 | 1–3 | 10 | 403 | 0.126 | 3.829 | 272.092 | 0.750 | 810.112 | 1784 | 1 |
| R1-incremental | INCREMENTAL | 5/5/11 | 1–3 | 6/6 | 920 | 0.720 | 5.152 | 248.976 | 1.014 | 664.608 | 2410 | 1 |
| R2-static | STATIC | 8/6/19 | 2–4 | 20 | 423 | 0.248 | 5.112 | 250.609 | 0.509 | 664.414 | 1783 | 1 |
| R2-incremental | INCREMENTAL | 8/6/19 | 2–4 | 10/10 | 967 | 0.304 | 6.565 | 269.009 | 0.977 | 701.621 | 2412 | 1 |
| R3-static | STATIC | 10/7/21 | 1–5 | 35 | 430 | 0.224 | 4.059 | 514.180 | 0.846 | 915.256 | 1785 | 1 |
| R3-incremental | INCREMENTAL | 10/7/21 | 1–5 | 15/15 | 986 | 0.266 | 5.173 | 288.640 | 0.928 | 838.568 | 2412 | 1 |
| R4-static | STATIC | 10/8/29 | 1–6 | 56 | 450 | 0.070 | 4.337 | 253.769 | 0.861 | 762.079 | 1785 | 1 |
| R4-incremental | INCREMENTAL | 10/8/29 | 1–6 | 21/21 | 1029 | 2.007 | 5.306 | 248.625 | 1.086 | 649.383 | 2416 | 1 |
| R5-static | STATIC | 11/9/25 | 1–4 | 84 | 448 | 0.067 | 4.365 | 329.849 | 0.761 | 812.802 | 1786 | 1 |
| R5-incremental | INCREMENTAL | 11/9/25 | 1–4 | 28/28 | 1029 | 2.507 | 4.929 | 242.809 | 0.767 | 648.546 | 2414 | 1 |
| R6-static | STATIC | 12/10/36 | 1–6 | 120 | 477 | 0.085 | 3.811 | 268.066 | 0.647 | 665.756 | 1790 | 1 |
| R6-incremental | INCREMENTAL | 12/10/36 | 1–6 | 36/36 | 1093 | 0.304 | 5.950 | 265.216 | 0.991 | 801.591 | 2420 | 1 |
| R7-static | STATIC | 12/11/45 | 1–7 | 165 | 502 | 0.140 | 3.973 | 255.910 | 0.575 | 646.111 | 1788 | 1 |
| R7-incremental | INCREMENTAL | 12/11/45 | 1–7 | 45/45 | 1149 | 0.460 | 6.224 | 247.537 | 1.063 | 667.845 | 2416 | 1 |

The chain case has 62 connected open-wedge motifs; most enumerated triples are disconnected. The hub case has 41,664 connected closed-triangle motifs. All taxonomy/result bins, including zero bins, were checked. There is no p95 or speedup claim from these small baseline samples. OS/WSL caches, clocks and external desktop GPU work were not controlled; benchmark jobs were sequential and profiling occurred afterward.

## Count/work admission table

| E | Maximum I by count/work | Nonempty feasible | Max one row with other rows singleton |
|---:|---:|---|---:|
| 1 | 100000 | yes | 100000 |
| 2 | 100000 | yes | 99999 |
| 3 | 100000 | yes | 99998 |
| 4 | 100000 | yes | 99997 |
| 10 | 100000 | yes | 99991 |
| 12 | 90909 | yes | 90898 |
| 16 | 47619 | yes | 47604 |
| 32 | 10752 | yes | 10721 |
| 64 | 2560 | yes | 2497 |
| 100 | 1030 | yes | 931 |
| 128 | 624 | yes | 497 |
| 216 | 217 | yes | 2 |
| 217 | 215 | no | — |
| 256 | 154 | no | — |

Other constraints still apply. For E≥3: I≤floor(5,000,000 / C(E−1,2)), also I≤100,000. Nonempty rows require I≥E. This proves E≤216; the 256 nominal bound cannot jointly admit 256 nonempty rows.
