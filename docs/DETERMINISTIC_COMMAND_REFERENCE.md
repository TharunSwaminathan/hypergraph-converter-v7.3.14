# Deterministic Command Reference

Generated from `src/agent/deterministicNlu/commandCatalog.js`.
Do not edit manually.

These are supported command patterns and examples, not a case-sensitive command language. The deterministic assistant accepts several natural-language variations.

## Quick Start

### Quick Start command suggestions

Shows a small curated set of catalog-backed commands to try first.

- ID: `help.quick-start`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SHOW_HELP_OVERVIEW`

Ambiguity/safety notes:
- The Quick Start list is derived from stable catalog IDs rather than duplicated UI strings.

## Graph Editing

### Create a hyperedge

Creates a new hyperedge with explicitly supplied vertices. If vertices are omitted, the assistant asks for them.

- ID: `graph.create-hyperedge`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `ADD_HYPEREDGE`

Patterns:
- `Create hyperedge <id> with vertices <vertices>`
- `Make a new group called <id> with <vertices>`

Examples:
- `Create hyperedge h3`
- `Create hyperedge h3 with vertices 8 and 9`
- `Make a new group called Researchers with Alice and Bob`

Identifier notes:
- Quote a literal ID such as "new group" if the words are part of the identifier.

Ambiguity/safety notes:
- The new hyperedge ID must not already exist.

### Remove one hyperedge

Removes a named hyperedge from the current graph after preview and confirmation.

- ID: `graph.remove-hyperedge`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `REMOVE_HYPEREDGE`

Patterns:
- `Remove hyperedge <id>`
- `Delete the hyperedge named <id>`

Examples:
- `Remove hyperedge h1`
- `Delete the hyperedge named Researchers`

Identifier notes:
- Use quotes around hyperedge IDs with spaces.

Ambiguity/safety notes:
- If a name or label is not unique, the assistant asks which hyperedge you mean.

### Add vertices to a hyperedge

Adds one or more vertices to an existing hyperedge. Multiple vertices become multiple ADD_INCIDENCE operations.

- ID: `graph.add-incidence`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `ADD_INCIDENCE`

Patterns:
- `Add <vertex> to <hyperedge>`
- `Include <vertices> in <hyperedge>`
- `Put <vertex> into <hyperedge>`

Examples:
- `Add vertex 6 to h2`
- `Add a vertex 6 to hyperedge h2`
- `Include vertices 6 and 7 in h2`
- `Put Alice into Researchers`

Identifier notes:
- `a vertex 6` is normalized to `6`; quote "a vertex 6" to preserve that literal text.

Ambiguity/safety notes:
- If the target hyperedge cannot be resolved uniquely, the assistant asks for clarification.

### Remove a vertex from one hyperedge

Removes one membership from one hyperedge while keeping the vertex everywhere else.

- ID: `graph.remove-incidence`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`, `existing_vertex`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `REMOVE_INCIDENCE`

Patterns:
- `Remove <vertex> from <hyperedge>`
- `Take <vertex> out of <hyperedge>`

Examples:
- `Remove vertex 4 from h0`
- `Take Alice out of Researchers`

Identifier notes:
- This is scoped to one hyperedge; use `everywhere` for global removal.

Ambiguity/safety notes:
- If removing the vertex would empty the hyperedge, the assistant asks whether to keep or remove the empty hyperedge.

### Remove a vertex everywhere

Removes a vertex from every hyperedge in the graph after preview and confirmation.

- ID: `graph.remove-vertex-global`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_vertex`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `REMOVE_VERTEX_GLOBAL`

Patterns:
- `Remove <vertex> everywhere`
- `Delete <vertex> from the entire graph`

Examples:
- `Remove vertex 4 everywhere`
- `Delete Alice from the entire graph`

Identifier notes:
- Contrast this with `Remove vertex 4 from h0`, which affects only h0.

Ambiguity/safety notes:
- The assistant clarifies empty-hyperedge handling when needed.

### Rename a vertex

Renames a vertex everywhere it appears in the graph.

- ID: `graph.rename-vertex`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_vertex`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `RENAME_VERTEX`

Patterns:
- `Rename vertex <old> to <new>`
- `Change vertex <old> to <new>`

Examples:
- `Rename vertex 4 to Alice`
- `Change vertex "old name" to "new name"`

Identifier notes:
- Quote IDs with spaces or leading words such as vertex/hyperedge.

Ambiguity/safety notes:
- Quoted old/new names preserve spaces exactly.

### Rename a hyperedge

Renames a hyperedge ID while keeping its vertices and metadata.

- ID: `graph.rename-hyperedge`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `RENAME_HYPEREDGE`

Patterns:
- `Rename <hyperedge> to <new>`
- `Change hyperedge <old> to <new>`

Examples:
- `Rename h0 to Researchers`
- `Change hyperedge "Group A" to "Research Group A"`

Identifier notes:
- Quote IDs with spaces.

Ambiguity/safety notes:
- The destination hyperedge ID must not collide with another hyperedge.

### Set hyperedge time

Sets or replaces the time metadata for one hyperedge.

- ID: `graph.set-time`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_HYPEREDGE_TIME`

Patterns:
- `Set <hyperedge>'s time to <value>`
- `Set the time of <hyperedge> to <value>`

Examples:
- `Set h2's time to 2026`
- `Set the time of h2 to "2026-08"`

Identifier notes:
- Quote non-numeric time strings if you want exact literal text.

Ambiguity/safety notes:
- The hyperedge reference must resolve uniquely.

### Set hyperedge weight

Sets numeric weight metadata for one hyperedge. Zero is valid.

- ID: `graph.set-weight`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_HYPEREDGE_WEIGHT`

Patterns:
- `Set <hyperedge>'s weight to <number>`
- `Change the weight of <hyperedge> to <number>`

Examples:
- `Set h2's weight to 3.5`
- `Change the weight of h2 to 0`

Identifier notes:
- Use the bare hyperedge ID unless the literal ID needs quotes.

Ambiguity/safety notes:
- Negative or non-numeric weights are rejected by the graph mutation validator.

### Set a hyperedge attribute

Sets one named metadata attribute on one hyperedge.

- ID: `graph.set-attribute`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_HYPEREDGE_ATTRIBUTE`

Patterns:
- `Set attribute <key> on <hyperedge> to <value>`
- `Set <hyperedge>'s <key> attribute to <value>`

Examples:
- `Set attribute category on h2 to research`
- `Set h2's color attribute to blue`

Identifier notes:
- Quote values with spaces when exact literal text matters.

Ambiguity/safety notes:
- Attribute keys must be simple identifiers such as category or color.

### Remove a hyperedge attribute

Deletes one named metadata attribute from one hyperedge.

- ID: `graph.remove-attribute`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `existing_hyperedge`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `REMOVE_HYPEREDGE_ATTRIBUTE`

Patterns:
- `Remove the <key> attribute from <hyperedge>`
- `Delete attribute <key> from <hyperedge>`

Examples:
- `Remove the category attribute from h2`
- `Delete attribute color from h2`

Identifier notes:
- Attribute keys are not graph entity IDs.

Ambiguity/safety notes:
- If the attribute is absent, the preview reports a no-op rather than silently changing state.

### Clear the graph

Stages a preview that removes every committed hyperedge. Confirmation is required.

- ID: `graph.clear-graph`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `CLEAR_GRAPH`

Patterns:
- `Clear the graph`
- `Remove all hyperedges`

Examples:
- `Clear the graph`
- `Remove all hyperedges`

Ambiguity/safety notes:
- Nothing is removed until you confirm the staged preview.

## Dataset Mapping

### Set dataset file roles

Marks uploaded files as vertex, hyperedge, or membership tables in the active DatasetMappingSpec.

- ID: `mapping.file-roles`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_FILE_ROLE`

Patterns:
- `Use <file> as the vertex table`
- `Make <file> the hyperedge table`
- `Treat <file> as the membership table`

Examples:
- `Use authors.csv as the vertex table`
- `Make papers.csv the hyperedge table`
- `Treat authorships.csv as the membership table`

Identifier notes:
- Use exact uploaded filenames when names are similar.

Ambiguity/safety notes:
- Unclear file references trigger clarification instead of guessing.

### Set key columns

Sets vertex or hyperedge key columns and updates the corresponding entity rule.

- ID: `mapping.key-columns`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_FILE_KEY_COLUMNS`, `SET_VERTEX_ENTITY_RULE`, `SET_HYPEREDGE_ENTITY_RULE`

Patterns:
- `Use <column> as the vertex key`
- `Use <column> as the hyperedge key`
- `Use <a> and <b> together as the paper key`

Examples:
- `Use author_id as the vertex key`
- `Use paper_id as the hyperedge key`
- `Use year and paper_id together as the paper key`

Identifier notes:
- Column names are resolved against uploaded file headers.

Ambiguity/safety notes:
- If a column appears in multiple files, the assistant asks which file should use it.

### Add membership relationships

Connects the membership table to vertex and hyperedge tables through verified key columns.

- ID: `mapping.relationships`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `ADD_RELATIONSHIP`

Patterns:
- `<membership>.<column> links to <table>.<column>`
- `Use <membership file> to connect vertices and hyperedges through IDs`

Examples:
- `authorships.author_id links to authors.author_id`
- `authorships.paper_id links to papers.paper_id`
- `Use authorships.csv to connect authors and papers through their ID columns`

Identifier notes:
- Qualified `file.column` syntax is the least ambiguous form.

Ambiguity/safety notes:
- A valid relationship needs enough context to identify membership, vertex, and hyperedge files.

### Set entity ID and time rules

Sets vertex IDs, hyperedge IDs, or hyperedge time metadata from dataset columns.

- ID: `mapping.entity-rules`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_VERTEX_ENTITY_RULE`, `SET_HYPEREDGE_ENTITY_RULE`

Patterns:
- `Use <column> as the hyperedge time`
- `Use <column> as the hyperedge ID`
- `Use <column> as the vertex ID`

Examples:
- `Use year as the hyperedge time`
- `Use paper_id as the hyperedge ID`
- `Use author_id as the vertex ID`

Identifier notes:
- Use file-qualified column names if headers repeat.

Ambiguity/safety notes:
- Column references are resolved from the active DatasetMappingSpec.

### Set supported mapping policies

Sets supported parser policies such as preserving empty hyperedges or deduplicating repeated memberships.

- ID: `mapping.policies`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_POLICY`

Patterns:
- `Keep papers with no authors`
- `Deduplicate repeated memberships`

Examples:
- `Keep papers with no authors`
- `Deduplicate repeated memberships`

Ambiguity/safety notes:
- Only supported SET_POLICY values are advertised. Missing-ID row dropping is not advertised as a deterministic command in this release.

## Dataset Grouping

### Treat files together or separately

Controls whether uploaded files are parsed as one dataset, separate datasets, or explicit groups.

- ID: `grouping.parse-mode`
- Availability: `chat_command`
- Side effect: `reversible_grouping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_PARSE_MODE`

Patterns:
- `Treat <files> as one dataset`
- `Keep <files> in separate groups`

Examples:
- `Treat authors.csv, papers.csv, and authorships.csv as one dataset`
- `Keep january.csv and february.csv in separate groups`

Identifier notes:
- Use exact uploaded filenames.

Ambiguity/safety notes:
- Grouping edits create a mapping revision immediately, but they do not alter the parsed graph.

### Create or populate a dataset group

Creates named dataset groups and moves uploaded files into them.

- ID: `grouping.create-group`
- Availability: `chat_command`
- Side effect: `reversible_grouping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `CREATE_GROUP`, `MOVE_FILE_TO_GROUP`

Patterns:
- `Create a group called <name>`
- `Move <file> into <group>`

Examples:
- `Create a group called Publications`
- `Move papers.csv into Publications`

Identifier notes:
- Group labels are user-facing; group IDs are stable slug IDs.

Ambiguity/safety notes:
- If the group label does not exist, the deterministic patch uses the corresponding stable group id.

### Mark validation, update, or ignored files

Marks files that should validate output, act as update streams, or be ignored by parser input.

- ID: `grouping.validation-files`
- Availability: `chat_command`
- Side effect: `reversible_grouping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `MARK_VALIDATION_FILE`, `MARK_UPDATE_STREAM`, `IGNORE_FILE`

Patterns:
- `Use <file> only for validation`
- `Mark <file> as an update stream`
- `Ignore <file>`

Examples:
- `Ignore notes.csv`
- `Use expected.json only for validation`
- `Mark graph_updates.csv as an update stream`

Identifier notes:
- Use exact filenames for safety.

Ambiguity/safety notes:
- Validation-only and ignored files are excluded from parser input.

## Custom Parser Workflow

### Show parser workflow status

Reports what is ready in the DatasetMappingSpec to parser workflow without changing state.

- ID: `parser.workflow-status`
- Availability: `chat_command`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SHOW_WORKFLOW_STATUS`

Patterns:
- `Show the current parser workflow status`
- `What is ready?`
- `What should I do next?`

Examples:
- `Show the current parser workflow status`
- `What is ready?`
- `What should I do next?`

Ambiguity/safety notes:
- `Continue` chooses the unique next parser-workflow step from current state.

### Generate the transformation plan

Creates a deterministic transformation plan from the active validated mapping.

- ID: `parser.generate-plan`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `GENERATE_TRANSFORMATION_PLAN`

Patterns:
- `Generate the transformation plan`
- `Do not run it; just show the transformation plan`

Examples:
- `Generate the transformation plan`
- `Do not run it; just show the transformation plan`

Ambiguity/safety notes:
- A negated run request must not stage parser execution.

### Generate parser code from mapping

Generates Custom Parser Studio code from the active mapping/plan, but does not run it.

- ID: `parser.generate-parser`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `GENERATE_PARSER_FROM_MAPPING`

Patterns:
- `Generate the parser from this mapping`
- `Generate the parser but do not execute it`

Examples:
- `Generate the parser from this mapping`
- `Generate the parser but do not execute it`
- `Generate the plan and parser, but do not run it`

Ambiguity/safety notes:
- Generation and execution are separate. This command does not execute parser code.

### Run the custom parser

Stages a confirmation request before running Custom Parser Studio code.

- ID: `parser.run-parser`
- Availability: `chat_command`
- Side effect: `requires_parser_run_confirmation`
- Confirmation: `run_confirmation`
- Required context: `generated_parser`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `RUN_CUSTOM_PARSER_CONFIRMATION`

Patterns:
- `Run the parser`
- `Execute the generated parser`

Examples:
- `Run the parser`

Ambiguity/safety notes:
- The code does not run until you confirm.

### Apply parser result to graph

Stages a confirmation request before applying a parser result to the graph.

- ID: `parser.apply-result`
- Availability: `chat_command`
- Side effect: `requires_graph_apply_confirmation`
- Confirmation: `apply_confirmation`
- Required context: `parser_result_ready`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION`

Patterns:
- `Apply the parser result`
- `Load the parser result`

Examples:
- `Apply the parser result`

Ambiguity/safety notes:
- The graph is not replaced until you confirm.

## Dashboard and Navigation

### Open Statistics

Navigates to the statistics section for the current graph.

- ID: `dashboard.statistics`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `NAVIGATE_STATS`

Patterns:
- `Open Statistics`
- `Show graph stats`

Examples:
- `Open Statistics`

### Open Visualization

Navigates to the graph preview/visualization section.

- ID: `dashboard.visualization`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `NAVIGATE_VISUALIZATION`

Patterns:
- `Show Graph Preview`
- `Go to Visualization`

Examples:
- `Go to Visualization`

### Open Runtime Diagnostics

Opens the local runtime diagnostics panel.

- ID: `dashboard.runtime-diagnostics`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `OPEN_RUNTIME_DIAGNOSTICS`

Patterns:
- `Open Runtime Diagnostics`
- `Show Ollama diagnostics`

Examples:
- `Open Runtime Diagnostics`

### Set visualization limit

Changes the number of hyperedges shown in the visualization preview.

- ID: `dashboard.visual-limit`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_VISUAL_LIMIT`

Patterns:
- `Set the visual limit to <number>`
- `Show only the first <number> vertices`

Examples:
- `Set the visual limit to 100`
- `Show only the first 50 vertices`

Ambiguity/safety notes:
- The limit affects visualization display, not the graph data.

### Switch input route

Switches the dashboard input route/tab without parsing or replacing the graph.

- ID: `dashboard.input-route`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_INPUT_ROUTE`

Patterns:
- `Use <format> input`
- `Switch to <format>`
- `Open Custom Parser`

Examples:
- `Use H2V input`
- `Switch to CSR`
- `Open Custom Parser`

Ambiguity/safety notes:
- Switching routes does not parse data. Parsing may replace the graph and has separate confirmation paths.

### Select export preview

Selects an export preview format for review. It does not automatically download a file. V2V is documented under Mappings as a vertex-to-vertex 2-section projection view, not a native hypergraph incidence representation.

- ID: `dashboard.export-preview`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_EXPORT_FORMAT`

Patterns:
- `Set the export format to <format>`
- `Preview an <format> export`
- `Export as CSR CSV`

Examples:
- `Set the export format to JSON`
- `Preview an H2V export`
- `Export as CSR CSV`

Ambiguity/safety notes:
- Automatic file download remains a confirmation-required operation and is not performed by preview commands.

## File and Batch Management

### Upload or attach files

Opens the assistant file picker. It does not parse or replace the graph until you choose files and request parsing. To learn about this command, ask “How do I add files?” To execute it, use a direct request such as “Upload files.”

- ID: `files.upload`
- Availability: `chat_command`
- Side effect: `file_picker`
- Confirmation: `no_confirmation_action`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `upload_files`

Patterns:
- `add files`
- `choose files`
- `file picker`

Examples:
- `Upload files`
- `Open the file picker`
- `Attach files`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Clear the active upload batch

Clears the active assistant upload batch. The parsed graph and manual dashboard inputs are not changed. To learn about this command, ask “How do I clear active batch?” To execute it, use a direct request such as “Clear the active batch.”

- ID: `files.clear-active-batch`
- Availability: `chat_command`
- Side effect: `destructive_batch_state`
- Confirmation: `immediate_batch_state`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `clear_uploaded_files`

Patterns:
- `clear active batch`
- `clear uploaded files`
- `detach active files`

Examples:
- `Clear the active batch`
- `Remove the uploaded files`

Ambiguity/safety notes:
- This action changes assistant workspace state. Ask as a How-do-I question to learn about it without executing it.

### Clear all upload batches

Clears every assistant upload batch. This is destructive for batch workspace state, but does not directly clear the current graph. To learn about this command, ask “How do I remove all batches?” To execute it, use a direct request such as “Clear all batches.”

- ID: `files.clear-all-batches`
- Availability: `chat_command`
- Side effect: `destructive_batch_state`
- Confirmation: `immediate_batch_state`
- Required context: `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `clear_all_batches`

Patterns:
- `remove all batches`
- `clear every batch`

Examples:
- `Clear all batches`
- `Delete all upload batches`

Ambiguity/safety notes:
- This action changes assistant workspace state. Ask as a How-do-I question to learn about it without executing it.

### View the previous batch

Switches the assistant workspace back to the previous upload batch when one exists. To learn about this command, ask “How do I open previous batch?” To execute it, use a direct request such as “View previous batch.”

- ID: `files.view-previous-batch`
- Availability: `chat_command`
- Side effect: `batch_state_edit`
- Confirmation: `no_confirmation_action`
- Required context: `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `view_previous_batch`

Patterns:
- `open previous batch`
- `select last batch`

Examples:
- `View previous batch`
- `Show the previous batch`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Add files to the previous batch

Merges the active upload batch into the previous batch when both exist. To learn about this command, ask “How do I merge with previous batch?” To execute it, use a direct request such as “Add files to previous batch.”

- ID: `files.add-to-previous-batch`
- Availability: `chat_command`
- Side effect: `batch_state_edit`
- Confirmation: `no_confirmation_action`
- Required context: `active_batch`, `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `add_to_previous_batch`

Patterns:
- `merge with previous batch`
- `append to last batch`

Examples:
- `Add files to previous batch`
- `Add these files to the previous batch`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Clear the previous batch

Removes the previous assistant upload batch when one exists. It does not directly clear the current graph. To learn about this command, ask “How do I delete previous batch?” To execute it, use a direct request such as “Clear previous batch.”

- ID: `files.clear-previous-batch`
- Availability: `chat_command`
- Side effect: `destructive_batch_state`
- Confirmation: `immediate_batch_state`
- Required context: `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `clear_previous_batch`

Patterns:
- `delete previous batch`
- `clear last batch`

Examples:
- `Clear previous batch`
- `Remove the previous batch`

Ambiguity/safety notes:
- This action changes assistant workspace state. Ask as a How-do-I question to learn about it without executing it.

### Use the active batch

Keeps the current assistant upload batch active and reports that subsequent file/model/parser actions use it. To learn about this command, ask “How do I keep active batch?” To execute it, use a direct request such as “Use active batch.”

- ID: `files.use-active-batch`
- Availability: `chat_command`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `use_active_batch`

Patterns:
- `keep active batch`

Examples:
- `Use active batch`
- `Use the active batch`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Activate a numbered batch

Switches the assistant workspace to a numbered upload batch when that batch exists. To learn about this command, ask “How do I activate batch?” To execute it, use a direct request such as “Activate batch 2.”

- ID: `files.activate-batch-number`
- Availability: `chat_command`
- Side effect: `batch_state_edit`
- Confirmation: `no_confirmation_action`
- Required context: `existing_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `activate_batch_number`

Patterns:
- `Activate batch <number>`
- `Switch to batch <number>`
- `Select batch <number>`
- `activate batch`
- `switch to batch`
- `select batch`

Examples:
- `Activate batch 2`
- `Switch to batch 3`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Generate parser for a numbered batch

Activates a numbered upload batch and then runs the existing parser-generation workflow for that batch. To learn about this command, ask “How do I generate parser for batch?” To execute it, use a direct request such as “Generate parser for batch 2.”

- ID: `files.generate-parser-for-batch`
- Availability: `chat_command`
- Side effect: `batch_state_edit`
- Confirmation: `no_confirmation_action`
- Required context: `existing_batch`, `valid_mapping_for_batch`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `generate_parser_for_batch`

Patterns:
- `Generate parser for batch <number>`
- `Create parser for batch <number>`
- `generate parser for batch`
- `create parser for batch`

Examples:
- `Generate parser for batch 2`
- `Create parser for batch 3`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Parse active files together

Marks the active upload batch to be parsed together as one dataset. To learn about this command, ask “How do I parse together?” To execute it, use a direct request such as “Parse files together.”

- ID: `files.parse-together`
- Availability: `chat_command`
- Side effect: `batch_state_edit`
- Confirmation: `no_confirmation_action`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `parse_together`

Patterns:
- `parse together`
- `one dataset`

Examples:
- `Parse files together`
- `Treat these files as one dataset`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Parse active files separately

Marks the active upload batch as separate datasets so the dashboard does not silently merge unrelated graphs. To learn about this command, ask “How do I parse separately?” To execute it, use a direct request such as “Parse files separately.”

- ID: `files.parse-separately`
- Availability: `chat_command`
- Side effect: `batch_state_edit`
- Confirmation: `no_confirmation_action`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `parse_separately`

Patterns:
- `parse separately`
- `separate datasets`

Examples:
- `Parse files separately`
- `Treat these files as separate datasets`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Use upload as the new dataset

Explains that the latest upload batch is already isolated as the active new dataset. To learn about this command, ask “How do I new dataset?” To execute it, use a direct request such as “Use as new dataset.”

- ID: `files.use-as-new-dataset`
- Availability: `chat_command`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `use_as_new_dataset`

Patterns:
- `new dataset`
- `keep as separate new upload`

Examples:
- `Use as new dataset`
- `Use these files as a new dataset`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

## Detection and Parsing

### Auto-detect uploaded files

Runs deterministic file and format detection for the active assistant upload batch. To learn about this command, ask “How do I auto detect uploaded files?” To execute it, use a direct request such as “Auto-detect uploaded files.”

- ID: `files.auto-detect`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `no_confirmation_action`
- Required context: `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `auto_detect_uploaded_files`

Patterns:
- `auto detect uploaded files`
- `auto-detect format`
- `detect attached files`

Examples:
- `Auto-detect uploaded files`
- `Detect the uploaded format`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Parse uploaded files

Parses the active upload batch using the detected or selected route. If this would replace an existing graph, confirmation is staged first. To learn about this command, ask “How do I process uploaded files?” To execute it, use a direct request such as “Parse uploaded files.”

- ID: `files.parse-uploaded`
- Availability: `chat_command`
- Side effect: `requires_graph_apply_confirmation`
- Confirmation: `apply_confirmation`
- Required context: `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `parse_uploaded_files`

Patterns:
- `process uploaded files`
- `convert attached files`

Examples:
- `Parse uploaded files`
- `Parse the uploaded files`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Use uploaded files with Custom Parser

Routes the active uploaded batch into Custom Parser Studio without running parser code. To learn about this command, ask “How do I custom parser uploaded files?” To execute it, use a direct request such as “Use uploaded files with Custom Parser.”

- ID: `files.custom-parser-route`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `uploaded_files`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `use_uploaded_files_with_custom_parser`

Patterns:
- `custom parser uploaded files`
- `route files to custom parser`

Examples:
- `Use uploaded files with Custom Parser`
- `Send these files to Custom Parser`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

## Mapping Validation and Repair

### Generate a mapping specification

Creates a DatasetMappingSpec workflow draft from active file previews. If model assist is disabled, it falls back to deterministic mapping. To learn about this command, ask “How do I map these files?” To execute it, use a direct request such as “Generate mapping specification.”

- ID: `mapping.generate-spec`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `generate_mapping_spec`

Patterns:
- `map these files`
- `infer mapping spec`

Examples:
- `Generate mapping specification`
- `Generate mapping spec`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Validate the mapping

Validates the active DatasetMappingSpec without parsing or applying a graph. To learn about this command, ask “How do I validate mapping?” To execute it, use a direct request such as “Validate the mapping.”

- ID: `mapping.validate`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `validate_mapping`

Patterns:
- `validate mapping`
- `check mapping`

Examples:
- `Validate the mapping`
- `Check the mapping spec`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Edit the mapping

Focuses the active DatasetMappingSpec editor so you can review or edit the mapping JSON. It does not apply edited JSON by itself. To learn about this command, ask “How do I edit mapping?” To execute it, use a direct request such as “Edit the mapping.”

- ID: `mapping.edit`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `edit_mapping`

Patterns:
- `edit mapping`
- `show mapping editor`
- `open mapping editor`

Examples:
- `Edit the mapping`
- `Open the mapping editor`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Auto-repair the mapping

Runs deterministic mapping auto-repair on the active mapping revision. To learn about this command, ask “How do I repair mapping?” To execute it, use a direct request such as “Auto-repair the mapping.”

- ID: `mapping.auto-repair`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `auto_repair_mapping`

Patterns:
- `repair mapping`
- `fix mapping`

Examples:
- `Auto-repair the mapping`
- `Repair the mapping`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Use deterministic mapping draft

Applies the stored deterministic mapping draft to the active batch. To learn about this command, ask “How do I apply deterministic draft?” To execute it, use a direct request such as “Use deterministic draft.”

- ID: `mapping.use-deterministic-draft`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `use_deterministic_draft`

Patterns:
- `apply deterministic draft`
- `deterministic draft`

Examples:
- `Use deterministic draft`
- `Use the deterministic mapping draft`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Use repaired mapping

Applies the stored repaired mapping to the active batch. To learn about this command, ask “How do I apply repaired mapping?” To execute it, use a direct request such as “Use repaired mapping.”

- ID: `mapping.use-repaired`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `use_repaired_mapping`

Patterns:
- `apply repaired mapping`
- `repaired mapping`

Examples:
- `Use repaired mapping`
- `Use the repaired mapping`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Compare expected output

Compares parser or mapping output with a validation/expected-output file when one is available. To learn about this command, ask “How do I validate expected output?” To execute it, use a direct request such as “Compare expected output.”

- ID: `mapping.compare-expected`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `compare_expected_output`

Patterns:
- `validate expected output`
- `expected output comparison`

Examples:
- `Compare expected output`
- `Compare with expected output`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Repair mapping specification with local assist

Requests a mapping-spec repair workflow for the active batch. Deterministic validation still checks the result. To learn about this command, ask “How do I fix mapping spec?” To execute it, use a direct request such as “Repair mapping spec.”

- ID: `mapping.repair-spec`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `repair_mapping_spec`

Patterns:
- `fix mapping spec`

Examples:
- `Repair mapping spec`
- `Repair mapping specification`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Generate deterministic mapping draft

Builds, auto-repairs, and validates a deterministic mapping draft without requiring a local model. To learn about this command, ask “How do I deterministic mapping draft?” To execute it, use a direct request such as “Generate deterministic mapping.”

- ID: `mapping.generate-deterministic`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `generate_deterministic_mapping`

Patterns:
- `deterministic mapping draft`

Examples:
- `Generate deterministic mapping`
- `Create deterministic mapping draft`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Generate parser from mapping

Generates deterministic Custom Parser code from the active validated mapping. To learn about this command, ask “How do I parser from mapping?” To execute it, use a direct request such as “Generate parser from mapping.”

- ID: `mapping.generate-parser-from-mapping`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `generate_parser_from_mapping`

Patterns:
- `parser from mapping`

Examples:
- `Generate parser from mapping`
- `Build parser from mapping`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Show mapping repair notes

Shows deterministic mapping auto-repair notes for the active mapping, when notes exist. To learn about this command, ask “How do I mapping repair notes?” To execute it, use a direct request such as “Show mapping repair notes.”

- ID: `mapping.show-repair-notes`
- Availability: `chat_command`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `show_repair_notes`

Patterns:
- `mapping repair notes`

Examples:
- `Show mapping repair notes`
- `Show repair notes`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Accept mapping

Records positive feedback for the active mapping so local training/debug export can include it. To learn about this command, ask “How do I approve mapping?” To execute it, use a direct request such as “Accept mapping.”

- ID: `mapping.accept`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `accept_mapping`

Patterns:
- `approve mapping`

Examples:
- `Accept mapping`
- `Accept the mapping`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Reject mapping

Records negative feedback for the active mapping so local training/debug export can include it. To learn about this command, ask “How do I decline mapping?” To execute it, use a direct request such as “Reject mapping.”

- ID: `mapping.reject`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `reject_mapping`

Patterns:
- `decline mapping`

Examples:
- `Reject mapping`
- `Reject the mapping`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Use mapping workflow

Starts the deterministic mapping workflow for the active upload batch. To learn about this command, ask “How do I mapping workflow?” To execute it, use a direct request such as “Use mapping workflow.”

- ID: `mapping.use-workflow`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `use_mapping_workflow`

Patterns:
- `mapping workflow`

Examples:
- `Use mapping workflow`
- `Start mapping workflow`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

## Local Model and Runtime

### Connect local model

Tests and connects the configured local Ollama runtime. This may contact only local/private endpoints. To learn about this command, ask “How do I connect local model?” To execute it, use a direct request such as “Connect local model.”

- ID: `runtime.connect-local-model`
- Availability: `chat_command`
- Side effect: `runtime_control`
- Confirmation: `runtime_control`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_connect`

Patterns:
- `connect local model`
- `connect ollama`
- `reconnect local assistant`

Examples:
- `Connect local model`
- `Reconnect Ollama`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Disconnect local assistant

Disables local model assist and keeps deterministic controls available. To learn about this command, ask “How do I turn off local model?” To execute it, use a direct request such as “Disconnect local model.”

- ID: `runtime.disconnect-local-model`
- Availability: `chat_command`
- Side effect: `runtime_control`
- Confirmation: `runtime_control`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `local_model_disable`

Patterns:
- `turn off local model`
- `disconnect ollama`
- `disconnect local assistant`

Examples:
- `Disconnect local model`
- `Disable local assistant`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### List installed local models

Lists models reported by the local Ollama runtime when it is reachable. To learn about this command, ask “How do I list installed models?” To execute it, use a direct request such as “List local models.”

- ID: `runtime.list-models`
- Availability: `chat_command`
- Side effect: `runtime_probe`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_list`

Patterns:
- `list installed models`
- `show ollama models`

Examples:
- `List local models`
- `Show installed local models`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Use a local model name

Updates the configured Ollama model name. The next connection or generation request verifies that the named model is installed and reachable. To learn about this command, ask “How do I use model?” To execute it, use a direct request such as “Use model qwen3:8b.”

- ID: `runtime.use-model-name`
- Availability: `chat_command`
- Side effect: `runtime_control`
- Confirmation: `runtime_control`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_select`

Patterns:
- `Use model <model name>`
- `use model`

Examples:
- `Use model qwen3:8b`
- `Use model qwen2.5-coder:1.5b`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Test local model connection

Runs the local model connection test without changing graph, mapping, or parser state. To learn about this command, ask “How do I test local model?” To execute it, use a direct request such as “Test local model connection.”

- ID: `runtime.test-connection`
- Availability: `chat_command`
- Side effect: `runtime_probe`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_test`

Patterns:
- `test local model`
- `test ollama`

Examples:
- `Test local model connection`
- `Test Ollama connection`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Open runtime diagnostics

Runs and opens the Local Runtime Diagnostics panel. To learn about this command, ask “How do I runtime diagnostics panel?” To execute it, use a direct request such as “Run runtime diagnostics.”

- ID: `runtime.diagnostics`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `local_runtime_diagnostics`

Patterns:
- `runtime diagnostics panel`
- `ollama diagnostics panel`

Examples:
- `Run runtime diagnostics`
- `Run local runtime diagnostics`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Test direct Ollama

Runs the diagnostics probe against the direct Ollama endpoint. To learn about this command, ask “How do I direct ollama test?” To execute it, use a direct request such as “Test direct Ollama.”

- ID: `runtime.test-direct-ollama`
- Availability: `chat_command`
- Side effect: `runtime_probe`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `local_runtime_test_direct_ollama`

Patterns:
- `direct ollama test`

Examples:
- `Test direct Ollama`
- `Test direct Ollama connection`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Test Local Runtime Bridge

Runs the diagnostics probe against the optional local runtime bridge. To learn about this command, ask “How do I test bridge?” To execute it, use a direct request such as “Test Local Runtime Bridge.”

- ID: `runtime.test-bridge`
- Availability: `chat_command`
- Side effect: `runtime_probe`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `local_runtime_test_bridge`

Patterns:
- `test bridge`
- `local runtime bridge test`

Examples:
- `Test Local Runtime Bridge`
- `Test the bridge`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Reconnect using Ollama bridge

Retries the local assistant connection while preferring the local runtime bridge transport. To learn about this command, ask “How do I use local bridge?” To execute it, use a direct request such as “Use Ollama bridge.”

- ID: `runtime.reconnect-bridge`
- Availability: `chat_command`
- Side effect: `runtime_control`
- Confirmation: `runtime_control`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_reconnect_bridge`

Patterns:
- `use local bridge`
- `prefer bridge`

Examples:
- `Use Ollama bridge`
- `Prefer Ollama bridge`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Enable local model assist

Enables local Ollama assist in settings. Deterministic controls continue to work if the runtime is not connected. To learn about this command, ask “How do I enable local assistant?” To execute it, use a direct request such as “Enable local model.”

- ID: `runtime.enable-local-model`
- Availability: `chat_command`
- Side effect: `runtime_control`
- Confirmation: `runtime_control`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_enable`

Patterns:
- `enable local assistant`
- `turn on local assistant`

Examples:
- `Enable local model`
- `Turn on local model assist`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Test simple local generation

Runs the Local Runtime Diagnostics simple generation check when a local model name is configured. To learn about this command, ask “How do I simple generation test?” To execute it, use a direct request such as “Test simple generation.”

- ID: `runtime.test-generation`
- Availability: `chat_command`
- Side effect: `runtime_probe`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_runtime_test_generation`

Patterns:
- `simple generation test`

Examples:
- `Test simple generation`
- `Run generation test`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Generate parser with local model

Asks the optional local Ollama assistant to help with parser generation, then validates deterministic output before insertion. To learn about this command, ask “How do I local model parser generation?” To execute it, use a direct request such as “Generate parser with local model.”

- ID: `runtime.generate-parser`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_generate_parser`

Patterns:
- `local model parser generation`

Examples:
- `Generate parser with local model`
- `Create parser with local model`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Analyze file roles with local model

Asks the optional local Ollama assistant to explain or analyze active file roles without replacing the graph. To learn about this command, ask “How do I local model file roles?” To execute it, use a direct request such as “Explain file roles with local model.”

- ID: `runtime.analyze-file-roles`
- Availability: `chat_command`
- Side effect: `runtime_probe`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_analyze_roles`

Patterns:
- `local model file roles`

Examples:
- `Explain file roles with local model`
- `Analyze file roles with local model`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Repair parser with local model

Asks the optional local Ollama assistant to repair current Custom Parser code, then validates before insertion. To learn about this command, ask “How do I local model parser repair?” To execute it, use a direct request such as “Repair parser with local model.”

- ID: `runtime.repair-parser`
- Availability: `chat_command`
- Side effect: `workflow_preparation`
- Confirmation: `none`
- Required context: `generated_parser`
- Works offline: yes
- Model policy: `deterministic_when_unambiguous_local_model_may_assist`
- Operations/intents: `local_model_repair_parser`

Patterns:
- `local model parser repair`

Examples:
- `Repair parser with local model`
- `Fix parser with local model`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

## Mappings and Exports

### Export mapping fine-tuning data

Downloads a local debug/training example for the active mapping workflow. To learn about this command, ask “How do I mapping training export?” To execute it, use a direct request such as “Export mapping fine-tuning data.”

- ID: `mapping.export-finetune`
- Availability: `chat_command`
- Side effect: `download_or_copy`
- Confirmation: `download_or_copy`
- Required context: `valid_mapping`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `export_mapping_finetune`

Patterns:
- `mapping training export`
- `fine tuning export`

Examples:
- `Export mapping fine-tuning data`
- `Export mapping finetune example`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Show mappings

Opens the Mappings section for the current graph, including H2V/V2H/H2H views and the V2V 2-section projection mapping. To learn about this command, ask “How do I view h2v mapping?” To execute it, use a direct request such as “Show mappings.”

- ID: `navigation.show-mappings`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `show_mappings`

Patterns:
- `view h2v mapping`
- `show v2h mapping`
- `show h2h mapping`
- `show v2v mapping`
- `view v2v mapping`
- `open v2v`
- `display vertex-to-vertex mapping`
- `show projected graph mapping`

Examples:
- `Show mappings`
- `Open mappings`
- `Show V2V mapping`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Show export options

Opens export previews/options for the current graph without downloading a file. To learn about this command, ask “How do I show exports?” To execute it, use a direct request such as “Show export options.”

- ID: `navigation.show-exports`
- Availability: `chat_command`
- Side effect: `navigation`
- Confirmation: `navigation_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `show_exports`

Patterns:
- `show exports`
- `export options`

Examples:
- `Show export options`
- `Open exports`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

## Confirmation and Control

### Cancel pending action

Cancels a pending confirmation. No staged graph, parser, or batch operation is committed. To learn about this command, ask “How do I cancel confirmation?” To execute it, use a direct request such as “Cancel pending action.”

- ID: `pending.cancel`
- Availability: `chat_command`
- Side effect: `confirmation_control`
- Confirmation: `pending_control`
- Required context: `pending_action`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `pending_cancel`

Patterns:
- `cancel confirmation`
- `cancel staged action`

Examples:
- `Cancel pending action`
- `Cancel the pending action`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Confirm pending action

Confirms the currently staged action after the app verifies the confirmation is still fresh. To learn about this command, ask “How do I confirm action?” To execute it, use a direct request such as “Confirm pending action.”

- ID: `pending.confirm`
- Availability: `chat_command`
- Side effect: `confirmation_control`
- Confirmation: `pending_control`
- Required context: `compatible_pending_confirmation`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `pending_confirm`

Patterns:
- `confirm action`
- `confirm staged action`

Examples:
- `Confirm pending action`
- `Confirm the pending action`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Stop active model/runtime work

Stops active local assistant work through the Stop control. If no cancellable request is active, it is a safe no-op with an informative response; it does not undo already committed graph or mapping edits. To learn about this command, ask “How do I stop?” To execute it, use a direct request such as “Stop the current request.”

- ID: `runtime.stop`
- Availability: `chat_command`
- Side effect: `runtime_control`
- Confirmation: `runtime_control`
- Required context: `active_cancellable_work`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `runtime_stop`

Patterns:
- `stop`
- `abort request`
- `stop active work`

Examples:
- `Stop the current request`
- `Abort the model request`

Ambiguity/safety notes:
- Help-seeking forms are read-only; direct requests use the existing deterministic handler.

### Correct the last interpretation

Replaces or refines a pending/recent interpretation. The side effect depends on the corrected command. This is documented as a speech-act control concept rather than a standalone planner action.

- ID: `correction.replace-interpretation`
- Availability: `read_only`
- Side effect: `confirmation_control`
- Confirmation: `depends_on_replacement`
- Required context: `matching_pending_or_recent_interpretation`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `correction`

Patterns:
- `actually`
- `i meant`
- `no, use`

Examples:
- `Actually, use paper_id instead of title`
- `Actually add vertex 7 to h2 instead`
- `How do I correct the last interpretation?`

Ambiguity/safety notes:
- Correction phrasing is interpreted against a pending or recent command; ask as a How-do-I question to learn without changing interpretation state.

## Questions and Explanations

### Questions are read-only

Question phrasing explains or evaluates without changing mapping, parser, dashboard, or graph state.

- ID: `questions.question-action-contrast`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`

Patterns:
- `Would <column> be a better key?`
- `What would happen if I removed <vertex>?`

Examples:
- `Would paper_id be a better key?`
- `What would happen if I removed vertex 4 from h0?`

Ambiguity/safety notes:
- Use action phrasing such as `Could you use paper_id as the key?` if you want a mapping edit.

### Polite action requests still change state

A polite question can still be an action when it asks the assistant to use, set, apply, run, or remove something.

- ID: `questions.action-contrast`
- Availability: `chat_command`
- Side effect: `reversible_mapping_edit`
- Confirmation: `immediate_reversible_mapping_edit`
- Required context: `uploaded_files`, `active_batch`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SET_FILE_KEY_COLUMNS`

Patterns:
- `Could you use <column> as the key?`

Examples:
- `Could you use paper_id as the key?`

Ambiguity/safety notes:
- If there are several paper_id columns, the assistant asks which file should use it.

### Ask what commands are available

Shows a catalog-driven overview of supported deterministic commands.

- ID: `help.overview`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `SHOW_HELP_OVERVIEW`

Patterns:
- `What commands can I use?`
- `What can the deterministic chatbot do?`

Examples:
- `What commands can I use?`

### Search command help in chat

Finds relevant catalog entries and returns examples without executing them.

- ID: `help.find-command`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `FIND_COMMAND`, `EXPLAIN_COMMAND`, `EXPLAIN_ACTION_COMMAND`, `LIST_COMMAND_CATEGORY`

Patterns:
- `Show graph commands`
- `How do I add a vertex?`
- `How do I remove a vertex everywhere?`

Examples:
- `Show graph commands`
- `How do I add a vertex to a hyperedge?`
- `How do I remove a vertex everywhere?`
- `Show dataset mapping examples`

Ambiguity/safety notes:
- Help responses may offer example chips, but they never auto-run commands.

### List read-only questions

Lists deterministic questions and explanations that never mutate app state.

- ID: `help.read-only-list`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `LIST_READ_ONLY_COMMANDS`

Patterns:
- `Show read-only questions`

Examples:
- `Show read-only questions`

### What works without Ollama

The deterministic catalog, dashboard routing, graph previews, mapping edits, parser workflow controls, and Help search work offline without model calls.

- ID: `help.model-offline`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- A local model may assist unusual phrasing only after deterministic routing does not confidently handle it.

## Corrections, Confirmation, and Safety

### Undo the last graph edit

Stages a preview that reverts the most recent committed graph mutation.

- ID: `graph.undo-last-mutation`
- Availability: `chat_command`
- Side effect: `graph_edit_preview`
- Confirmation: `preview_confirmation`
- Required context: `loaded_graph`, `reversible_committed_history`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `UNDO_LAST_MUTATION`

Patterns:
- `Undo the last graph edit`
- `Undo the previous mutation`

Examples:
- `Undo the last graph edit`
- `Undo the previous mutation`

Ambiguity/safety notes:
- If there is no mutation history, the assistant reports that nothing can be undone.

### List commands that require confirmation

Lists graph previews, parser runs, parser-result application, and other confirmation-gated actions.

- ID: `help.confirmation-list`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `LIST_CONFIRMATION_COMMANDS`

Patterns:
- `Which commands require confirmation?`

Examples:
- `Which commands require confirmation?`

### Reported parser commands are read-only

Reported speech such as a reminder about a previous parser command does not run or stage parser execution.

- ID: `parser.reported-speech`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Patterns:
- `I previously asked you to run the parser`

Examples:
- `I previously asked you to run the parser`

Ambiguity/safety notes:
- Reported speech is intentionally blocked from side effects.

## Quoted Identifiers

### How quoted identifiers work

Explains how the deterministic graph grammar strips words like vertex/hyperedge unless they are quoted.

- ID: `quoted.identifiers`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `EXPLAIN_QUOTED_IDENTIFIERS`

Patterns:
- `How do quoted identifiers work?`

Examples:
- `How do quoted identifiers work?`

Identifier notes:
- Quote IDs with spaces, punctuation, or words like vertex, node, hyperedge, group.

Ambiguity/safety notes:
- Unquoted `a vertex 6` is normalized to `6`; quoted `"a vertex 6"` is preserved literally.

## Ambiguity and Clarification

### Ambiguity and clarification

Explains why the assistant asks follow-up questions instead of guessing when references are ambiguous.

- ID: `ambiguity.clarification`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `EXPLAIN_AMBIGUITY`

Patterns:
- `Why did the assistant ask a clarification?`
- `How does ambiguity work?`

Examples:
- `Why did the assistant ask a clarification?`

Ambiguity/safety notes:
- Nothing changes while clarification is pending.

## Algorithms

### Can the chatbot run algorithms?

Explains that algorithms are currently panel-only tools, not deterministic chat-executed commands.

- ID: `algorithms.chatbot-support`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `EXPLAIN_PANEL_ONLY_FEATURE`

Patterns:
- `Can the chatbot run BFS?`
- `Can the assistant execute algorithms?`

Examples:
- `Can the chatbot run BFS?`

Ambiguity/safety notes:
- The answer may point to the Algorithms panel, but it does not execute BFS, DFS, Dijkstra, or components from chat.

### Connected Components

group vertices reachable from each other. Open the Algorithms panel, choose this algorithm, select required vertices, and run it there.

- ID: `algorithm.connected_components`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`

Ambiguity/safety notes:
- The current deterministic chatbot does not execute this algorithm as a chat command.

### Breadth-First Search

explore level by level from a start vertex. Open the Algorithms panel, choose this algorithm, select required vertices, and run it there.

- ID: `algorithm.bfs`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`

Ambiguity/safety notes:
- The current deterministic chatbot does not execute this algorithm as a chat command.

### Depth-First Search

explore as deep as possible before backtracking. Open the Algorithms panel, choose this algorithm, select required vertices, and run it there.

- ID: `algorithm.dfs`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`

Ambiguity/safety notes:
- The current deterministic chatbot does not execute this algorithm as a chat command.

### Shortest Path (Dijkstra)

cheapest route between two vertices, by hyperedge weight. Open the Algorithms panel, choose this algorithm, select required vertices, and run it there.

- ID: `algorithm.shortest_path`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`

Ambiguity/safety notes:
- The current deterministic chatbot does not execute this algorithm as a chat command.

### Degree Distribution

how many hyperedges each vertex belongs to. Open the Algorithms panel, choose this algorithm, select required vertices, and run it there.

- ID: `algorithm.degree_distribution`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`

Ambiguity/safety notes:
- The current deterministic chatbot does not execute this algorithm as a chat command.

### K-Core Decomposition

peel vertices and report exact coreness/k-shell groups. Open the Algorithms panel, choose this algorithm, select required vertices, and run it there.

- ID: `algorithm.k_core`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`

Ambiguity/safety notes:
- The current deterministic chatbot does not execute this algorithm as a chat command.

## Panel-only Features

### Batch Updates

Batch command preview/commit/discard is available in Advanced Options, not as a free-form chatbot command in this release.

- ID: `panel.batch-updates`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `loaded_graph`
- Works offline: yes
- Model policy: `panel_only`
- Operations/intents: `COMMIT_BATCH_UPDATES`

Ambiguity/safety notes:
- Batch preview pauses conversational graph edits until you commit or discard it.

### Advanced mapping patch operations

Some DatasetMappingPatch schema operations are available through mapping editors, repairs, or imported specs but are not deterministic chat commands.

- ID: `panel.mapping-advanced-ops`
- Availability: `panel_only`
- Side effect: `panel_only`
- Confirmation: `panel_only`
- Required context: `active_batch`
- Works offline: yes
- Model policy: `panel_only`
- Operations/intents: `RENAME_GROUP`, `SET_FILE_INPUT_USAGE`, `SET_FILE_LIST_COLUMN`, `UPDATE_RELATIONSHIP`, `REMOVE_RELATIONSHIP`, `ADD_FILTER`, `UPDATE_FILTER`, `REMOVE_FILTER`, `REMOVE_ASSUMPTION`, `ADD_ASSUMPTION`

Ambiguity/safety notes:
- These operation names are documented so schema coverage is honest without advertising unsupported chat phrases.

## Input Data Formats

### Supported input data formats

Lists the verified input routes and compact examples.

- ID: `formats.supported-inputs`
- Availability: `read_only`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`
- Operations/intents: `LIST_INPUT_FORMATS`

Patterns:
- `What input formats are supported?`

Examples:
- `What input formats are supported?`

Ambiguity/safety notes:
- Export-only formats are not described as input formats.

### H2V / Simple

Each row names one hyperedge and lists the vertices it contains. Route: H2V / Simple.

- ID: `format.h2v`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
h0: 1 2 3
h1: 2 4
```

### V2H

Each row names one vertex and lists the hyperedges that contain it. Route: V2H.

- ID: `format.v2h`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
1: h0 h2
2: h0 h1
```

### H2H

Projection rows list neighboring hyperedges and their shared vertices. Route: H2H Projection.

- ID: `format.h2h`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: not advertised as automatic for this format.

Format example:

```text
h0: h1[shared: 2], h2[shared: 1,3]
```

### Incidence Edge List

Each row is one hyperedge/vertex membership. Optional time and weight columns may follow. Route: Incidence Edge List.

- ID: `format.incidence`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
h0,1
h0,2
h1,2
```

### CSV

Each delimited row becomes one hyperedge; row values are vertices. Route: CSV.

- ID: `format.csv`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
1,2,3
2,4
```

### Graph Edge List

Each pairwise row becomes a size-two hyperedge, so this is graph-edge-list semantics. Route: Graph Edge List.

- ID: `format.edge-list`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
1 2
2 3
```

### JSON

Accepts an array of {id, vertices} objects or the app canonical hypergraph object. Route: JSON.

- ID: `format.json`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
[{"id":"h0","vertices":["1","2"]}]
```

### Cornell / SNAP

Uses nverts and simplices files, optionally with times. Route: Cornell / SNAP.

- ID: `format.cornell`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
nverts.txt: 3, 2
simplices.txt: 1, 2, 3, 2, 4
```

### CSR JSON

Uses vertexIds plus h2vCSR offsets and indices. Route: CSR JSON.

- ID: `format.csr-json`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
{"vertexIds":["1"],"h2vCSR":{"offsets":[0,1],"indices":[0]}}
```

### CSR / CSC CSV

Uses labeled rows such as vertexIds, hyperedgeIds, rowOffsets, and columnIndices. Route: CSR / CSC CSV.

- ID: `format.csr-csc-csv`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
vertexIds,1,2
hyperedgeIds,h0
rowOffsets,0,2
columnIndices,0,1
```

### Adjacency List

Each node lists neighbors; reverse duplicate pairs are treated as one undirected size-two hyperedge. Route: Adjacency List.

- ID: `format.adjacency-list`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: supported.

Format example:

```text
1: 2 3
2: 1 4
```

### Freeform / NLP

Uses local deterministic extraction only; it does not call an online model. Route: Freeform / NLP.

- ID: `format.freeform`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: not advertised as automatic for this format.

Format example:

```text
Paper 1 has Alice, Bob, and Charlie as co-authors.
```

### Custom Parser

For unusual or multi-file inputs: upload files, edit parser code, run, validate, then apply. Route: Custom Parser.

- ID: `format.custom-parser`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: not advertised as automatic for this format.

Format example:

```text
async function parseHypergraph(files, helpers) { return []; }
```

### AI Prompt

Prepares a prompt for manual external use; the app does not call cloud APIs. Route: AI Prompt.

- ID: `format.ai-prompt`
- Availability: `format_reference`
- Side effect: `read_only`
- Confirmation: `none`
- Required context: `none`
- Works offline: yes
- Model policy: `always_deterministic`

Ambiguity/safety notes:
- Auto Detect: not advertised as automatic for this format.

Format example:

```text
Paste graph-like text, choose a target, and copy the generated prompt.
```
