# v7_4 corrective decisions

Freeform / NLP remains reserved and unsupported. The postqualification Corrective B UI contract explicitly preserves its internal format compatibility while excluding it from the visible selector. The public action inventory calls it a manual route placeholder. The integration did not implement a qualified visible workflow. Its former supported-format Help reference was therefore incorrect and has been removed. README and Assistant route guidance now state the same decision. Internal parsing compatibility remains; this correction does not expose a new execution path.

Root qualification artifacts remain excluded from portable source. The UI contract test now exercises current source and actual mounted controls without reading historical release provenance. Historical RC1/RC2 evidence remains repository-only and unchanged.

The explicit One dataset choice uses a typed SET_PARSE_MODE operation before broad parser orchestration. Its owner checks the exact batch identity, version, mapping revision and grouping revision, advances the batch/grouping revision, and clears the old preview. Generation, review/adoption, Run confirmation, worker validation and Apply confirmation remain independent boundaries.

K-core answers preserve null and missing numeric values, distinguish computed, resource-limited, failed and stale results, and give computed authority only to successful current results. The Algorithms owner recomputes synchronously whenever its graph input changes. Local-model conversation context carries the same status and unavailable values.

No Scope 6B work, Runtime schemas, DynamicHypergraph core, motif taxonomy or CUDA/native source is changed. This candidate is for review; no release tag or commit is created.
