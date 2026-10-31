# Workspace resume, saved-data visibility and preferences

Scope 7E presents the qualified project/workspace, Assistant memory and local
model persistence stack. It does not grant execution authority or resume pending
commands. Apply/delete/parser/CUDA approvals, selected graph entities and unsent
Assistant input are never restored as permissions.

## Opening a workspace

The saved-workspace surface shows project identity, verified source/graph
availability, project memory, model configuration, the separate reconnect
preference, current connection state and acknowledged save status. A chooser
summary is availability metadata, not a claim that content is already restored.
Resume validates the selected project before mounting its writer. Source and graph
are loaded from verified durable bytes; no parsing or transformation runs merely
to make restoration appear successful. Memory loads independently, followed by
the existing Scope 7D model coordinator. A configured model is never called
Connected until that coordinator completes fresh runtime discovery.

**Resume previous workspace automatically** is an application/origin preference.
The deterministic default is ON, preserving the qualified pre-7E automatic
restore behavior. Existing valid project data is not migrated/re-written just to
add this setting. When OFF and saved data exists, the chooser waits for explicit
Resume: the App/project writer and model reconnect do not start first. This does
not change **Auto reconnect** in Assistant Settings. The two intents are separate.

The visible states distinguish no saved data, available, restoring, restored,
partial restoration, stale, recovery required and fresh session. Model outage is
reported separately and does not erase an otherwise restored workspace. Saving
and Saved use transaction-completion receipts, rather than React updates or
unload handlers. Beforeunload warnings are supplemental only.

## Fresh sessions and project switching

**Start fresh session** normally creates a separate empty saved project and selects
it atomically with the startup preference revision. Previous source, graphs,
memory and chat remain intact and selectable. It does not delete saved work.
The standard 80-project retention cap still applies. When settings/storage cannot
be safely used, an explicitly requested temporary fresh session does not publish
project writes and clearly says changes are not saved. Incompatible settings and
saved projects remain preserved. A temporary session is not a backup or recovery.

The project selector supports A→B→A without sharing project writers or memory.
Selection is captured per mounted session; another tab's global startup choice
cannot redirect an existing writer. Original legacy quarantine remains read-only
for its owning project; a separately created project does not inherit that quarantine. Switching discards pending authority and
warns about uncommitted local edits. Shared model configuration follows existing
application-level Scope 7D ownership; no model profile is copied into projects.

## Category-specific clear operations

The saved-data controls and existing memory/model controls require labelled,
keyboard-accessible confirmations for destructive changes. Cancel receives focus;
Escape cancels and focus returns to the initiating control.

- **Delete saved workspace** deletes only the selected project's source, graph,
  derived metadata and checkpoints, and clears historical chat workspace
  references. Project Assistant memory, chat text, other projects and application
  preferences remain. A strict captured project revision is checked atomically.
- **Clear this project's memory**, individual/category forgetting and replacement
  preserve source/graph and other projects. Existing chat/model quotes are separate
  retained content. The clear uses the captured project identity/revision and the
  existing bounded memory validation/CAS semantics.
- **Forget model connection** is application-wide and retains projects/memory.
  Scope 7D remains responsible for its revisioned tombstone, retry cancellation,
  legacy-hint cleanup and durable reconnect OFF behavior.
- Startup auto-resume can be explicitly set OFF without deleting any category.

Stale confirmation or a foreign write fails without a successful clear receipt.
Reload is required; timestamps do not replace CAS ownership. Opening another
project invalidates outstanding confirmation scopes. After a successful clear,
the mounted scene is replaced, discarding obsolete asynchronous/UI authority.
An already submitted old transaction can finish before a clear; the clear then
fails its stale revision rather than silently rebasing.

## Partial restoration and recovery

Strict Scope 7B restore remains the default. The 7E read-only category path can
expose independently verified source bytes and application metadata when a
referenced graph payload is missing/corrupt or its mapping is stale. The original
root/digest/headers are retained, never re-sealed to fabricate a graph. Invalid
root/ownership/digest/future schema, missing source or bad derived metadata still
fail closed. A partial owner cannot automatically overwrite the saved evidence.
User edits in that session remain explicitly unsaved. Reload/exact-source recovery
or a separate fresh project are the bounded paths; no guessed repair is promised.

Memory and model failures do not crash the whole application. Verified explicit
project memory can remain available while graph-derived memory is stale. Restored
parser text still needs the existing fresh review/Run/Apply process. Source-versus-graph visibility compares verified byte digests, not temporary input
IDs; equal bytes under a new ID do not falsely stale the graph. Display
preferences never restore graph selection, pending mutations or result authority.

## Preference schema and ownership

One validated `workspace-resume` record uses the existing IndexedDB meta store;
database version stays 4 and project/workspace/memory/profile schemas stay intact.
It contains namespace/schema/revision, auto-resume intent, selected project UUID,
at most 80 bounded display labels, and view/layout/preview-limit preferences.
Unknown fields, future schemas, unsafe prototypes/accessors and invalid enums,
IDs, lengths or limits fail closed. Missing settings use defaults without a
destructive migration. Future/corrupt settings remain read-only with auto-resume
OFF. Preferences and fresh-project selection use native transaction CAS and
completion receipts. Explicit application-wide clearing also clears these new
startup labels/selection and sets auto-resume OFF atomically with tombstones.

Display settings are application/origin-owned: Hypergraph/Line Graph view,
Force/Circular/Grid layout and a bounded preview limit. They do not mutate the
canonical graph or enable execution. Other preferences, graph selections and
cross-machine portability are not silently invented or stored in project memory.

Revision-only workspace/memory notifications mark another tab stale; they never
transfer source, graph, prompt content or authority. Foreign preference changes
require reload rather than a silent overwrite. Diagnostics retain at most 16
state markers and bounded timing/category summaries, not data payloads or secrets.

## Qualification boundaries

Source/metadata/graph validation, memory load, chooser availability and total
usable-startup timings are measured on representative synthetic data. Timings are
observations, not scale, quota, fsync or availability guarantees. Real Ollama
generation is separate from controlled loopback outage tests and from mocked
mounted/transaction tests. Qualification uses fresh guarded browser profiles.

Pre-commit packages are explicitly **PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**.
The existing snapshot producer/verifier contract is unchanged. Browser storage,
memories, endpoint/model preferences, credentials and native/private runtime state
are excluded. Candidate-SHA packaging, commit-bound verification, remote CI and
final exact-SHA qualification remain deferred until a candidate commit exists.

Full workspace export/import/cross-origin portability, historical motif results,
physical power loss, forced termination and integrated restart soak remain later
work. Scope 7F is not qualified or started by this phase.
