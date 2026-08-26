# Command Catalog Migration v7.3.8

v7.3.7 introduced a shared deterministic command catalog. v7.3.8 keeps those stable entries and adds generated catalog entries for public legacy `ActionPlanner` commands.

## What changed

- New source of authority: `src/agent/actionIntentRegistry.js`.
- New compiler domain: `legacy_action`.
- New typed kind: `LegacyActionIntent`.
- New generated catalog entries: file/batch controls, deterministic parsing/detection, mapping validation/repair, local runtime controls, mappings/exports navigation, pending confirmation controls, runtime stop, and correction.
- New Help intent: `EXPLAIN_ACTION_COMMAND`.

## What did not change

- Existing v7.3.7 IDs remain stable.
- Graph edits still preview and require confirmation.
- Custom Parser run/apply still require confirmation.
- Algorithms remain panel-only from chat.
- No cloud APIs, backend, API keys, or bundled model weights were added.

## Deep links

The Help UI now accepts:

```text
#help/<command-id>
#help/category/<category-id>
```

Cards expose stable `command-*` DOM IDs and copyable links. Related commands resolve through `getCatalogEntry(...)` so broken related IDs are caught by catalog integrity tests.

## Verification

The catalog now verifies:

- 113 catalog entries;
- 179 executable examples;
- coverage against authoritative graph mutation, dataset mapping, parser workflow, dashboard, Help, and legacy action registries;
- no internal-only action intent is exposed as an executable command.
