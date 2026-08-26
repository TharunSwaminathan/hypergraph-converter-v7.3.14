# Dataset Profiling

`src/agent/datasetProfiler.js` creates bounded deterministic profiles. It records delimiter/header evidence, row counts, exact versus sampled status, column types, null/distinct/duplicate counts, uniqueness ratios, sample values, candidate keys, list-like columns, row-width consistency, and header fingerprints.

Default limits cap file count, exact bytes, sampled characters, sampled rows, columns, sample values, and composite-key width. Full files are not sent to model prompts by default.
