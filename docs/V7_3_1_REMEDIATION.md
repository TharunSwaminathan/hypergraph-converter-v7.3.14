# v7.3.1 Dataset Mapping Routing Remediation

v7.3.1 is a focused correction release for the v7.3 Custom Parser dataset-mapping workflow.

The fixed defect was routing: explicit multi-file mapping language could fall through to the generic dashboard ActionPlan planner, then into deterministic route selection. That was wrong because an already active Custom Parser batch should stay in the mapping workflow.

Corrected flow:

```text
active Custom Parser batch
+ dataset-mapping language
-> dataset mapping intent detector
-> ensure/derive DatasetMappingSpec v2
-> local model typed patch when connected
   or deterministic typed mapping fallback
-> strict file/column/relationship validation
-> mapping revision + deterministic diff
-> stay in Custom Parser workflow
```

The release does not add new mapping operations, file roles, parser helpers, graph mutation behavior, cloud APIs, backend services, model weights, or autonomous agents.

## Bootstrap behavior

If a batch has deterministic profiles/grouping but no active mapping, the chat path builds a valid v2 mapping from the existing v7.3 deterministic mapping generator. The bootstrap mapping starts at revision `0`; the user patch creates revision `1`. Parser code is not generated or run during bootstrap.

## Fallback behavior

When `plan_dataset_mapping_patch` times out, returns malformed JSON, fails schema validation, or references unavailable files/columns, the app attempts the deterministic typed mapping fallback for supported explicit language. It does not call generic ActionPlan and does not call route planning.

## No-op behavior

If the validated before/after mapping content is identical, the app reports that the mapping already uses the requested roles, keys, joins, and policies. It does not increment `mappingRevision`, append history, generate a parser, or change the graph.

## Runtime state

Connection health and generation health remain separate. A failed mapping generation can produce a degraded/timed-out generation state while the endpoint remains connected.
