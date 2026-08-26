# Dataset Mapping Patches

Mapping corrections use `DatasetMappingPatch` drafts. Supported operations include parse-mode changes, group creation/renaming, moving files, setting file roles/keys/list columns, entity rules, relationships, filters, policies, validation/update/ignore marking, and assumptions.

Patch drafts are non-executable JSON. They must reference exact active files, headers, and groups. Valid patches increment mapping revision, add bounded history, invalidate stale generated parser/plan bindings, and can be undone.
## v7.3.1 chat fallback

Chat can now invoke mapping patches directly. When Ollama is connected, the assistant asks for a non-executable `DatasetMappingPatch`. If that draft is invalid, times out, or references unavailable files/columns, supported explicit language is parsed by the deterministic typed fallback and still passes through the same patch validator, applier, and DatasetMappingSpec v2 validator.

No patch may run parser code or change graph state.
