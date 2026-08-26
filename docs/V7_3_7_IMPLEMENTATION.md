# v7.3.7 Implementation Notes

v7.3.7 adds a deterministic command catalog and searchable Help system for Hypergraph Converter Studio.

## Added architecture

- `src/agent/deterministicNlu/commandCatalogSchema.js` defines stable enums for categories, availability, required context, side effects, confirmation behavior, model policy, typed kinds, and Help-query intents.
- `src/agent/deterministicNlu/commandCatalog.js` is the authoritative documentation registry for deterministic chat commands, read-only questions, input formats, and panel-only features.
- `src/agent/deterministicNlu/commandCatalogSearch.js` performs local deterministic search with lightweight stop-word normalization.
- `src/agent/deterministicNlu/commandCatalogFormatter.js` formats catalog entries for chat responses and generated Markdown.
- `src/agent/deterministicNlu/domains/helpGrammar.js` compiles command-help questions into `DeterministicHelpQuery`.
- `src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js` answers Help queries without model calls or state changes.
- `src/components/DeterministicCommandHelp.jsx` and `.css` render searchable/filterable command cards inside the assistant Help panel.

## Runtime integration

`compileDeterministicAction` now recognizes `help_query` as an authoritative deterministic domain. `dispatchCompiledAction` routes `help_query` / `DeterministicHelpQuery` before grounded-question fallback. `AgentChatPanel` wires the production handler and implements safe `Try this command` insertion:

- empty composer: inserts the example;
- non-empty composer: asks before replacing unsent text;
- no auto-submit;
- no graph/mapping/parser mutation.

## Command coverage

The catalog covers:

- graph mutation previews: add/remove hyperedges, add/remove incidences, global vertex removal, renames, time/weight/attribute edits, clear, undo;
- dataset mapping edits: roles, key columns, relationships, entity rules, policies;
- dataset grouping edits: parse mode, create group, move files, validation/update/ignored files;
- parser workflow controls: status, transformation plan, parser generation, run confirmation, apply confirmation;
- dashboard/navigation controls: statistics, visualization, runtime diagnostics, visual limit, input route, export preview;
- deterministic Help queries;
- read-only question/action contrast examples;
- quoted identifiers and ambiguity behavior;
- verified input data formats;
- panel-only algorithms and advanced panels.

## Adjacent fixes from catalog verification

Catalog execution exposed and fixed several deterministic phrasing edges:

- `Include vertices 6 and 7 in h2` now produces two `ADD_INCIDENCE` operations.
- Named graph examples use realistic fixtures, including `Researchers` and quoted `Group A`/`old name` IDs.
- Dataset grouping examples use fixture files that actually exist: `january.csv`, `february.csv`, `notes.csv`, `graph_updates.csv`, and `expected.json`.
- Relationship examples document the actual role-setting operations emitted alongside `ADD_RELATIONSHIP`.
- `Keep papers with no authors` documents the two supported `SET_POLICY` patches and does not become a grouping move.
- `Do not run it; just show the transformation plan` stays a safe parser workflow request and does not stage parser execution.

## Offline and model policy

The Help catalog and command-search path are deterministic and offline. Ollama remains optional local assist for unusual phrasing or mapping/parser guidance; it is not needed to browse Help or answer command-help questions.
