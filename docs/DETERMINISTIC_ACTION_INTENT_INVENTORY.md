# Deterministic Action Intent Inventory

v7.3.9 uses `src/agent/actionIntentRegistry.js` as the authoritative inventory for the deterministic legacy `ActionPlanner` command surface that sits beside the typed NLU domains.

## v7.3.9 authority update

This release separates executable public commands from internal compatibility intents and speech-act-only concepts. Help uses this registry for documentation and exact public-command matching, but Help-seeking speech is filtered before direct action matching.

Counts from the v7.3.9 source:

- Total action intents: 80
- Public chat commands: 49
- Internal-only intents: 30
- Speech-act-only concepts: 1
- Deprecated intents: 0
- Panel-only action intents: 0
- Catalog entries generated from public action intents: 49

## Visibility rule

| Visibility | Meaning |
| --- | --- |
| `public_chat_command` | Can be matched from direct chat text and dispatched through deterministic handlers. |
| `internal_only` | Compatibility, fallback, or planner-only intent; not advertised as an executable Help command. |
| `speech_act_only` | Conversational control concept documented in Help, but not a standalone planner action. |
| `deprecated` | Historical/retired intent. |
| `panel_only` | Panel feature not exposed as chat execution. |

## Public command inventory

| ID | Intent | Side effect | Confirmation | Required context |
| --- | --- | --- | --- | --- |
| `files.upload` | `upload_files` | `file_picker` | `no_confirmation_action` | `none` |
| `files.clear-active-batch` | `clear_uploaded_files` | `destructive_batch_state` | `immediate_batch_state` | `active_batch` |
| `files.clear-all-batches` | `clear_all_batches` | `destructive_batch_state` | `immediate_batch_state` | `uploaded_files` |
| `files.view-previous-batch` | `view_previous_batch` | `batch_state_edit` | `no_confirmation_action` | `uploaded_files` |
| `files.add-to-previous-batch` | `add_to_previous_batch` | `batch_state_edit` | `no_confirmation_action` | `active_batch`, `uploaded_files` |
| `files.clear-previous-batch` | `clear_previous_batch` | `destructive_batch_state` | `immediate_batch_state` | `uploaded_files` |
| `files.use-active-batch` | `use_active_batch` | `read_only` | `none` | `active_batch` |
| `files.activate-batch-number` | `activate_batch_number` | `batch_state_edit` | `no_confirmation_action` | `existing_batch` |
| `files.generate-parser-for-batch` | `generate_parser_for_batch` | `batch_state_edit` | `no_confirmation_action` | `existing_batch`, `valid_mapping_for_batch` |
| `files.parse-together` | `parse_together` | `batch_state_edit` | `no_confirmation_action` | `active_batch` |
| `files.parse-separately` | `parse_separately` | `batch_state_edit` | `no_confirmation_action` | `active_batch` |
| `files.use-as-new-dataset` | `use_as_new_dataset` | `read_only` | `none` | `active_batch` |
| `files.auto-detect` | `auto_detect_uploaded_files` | `workflow_preparation` | `no_confirmation_action` | `uploaded_files` |
| `files.parse-uploaded` | `parse_uploaded_files` | `requires_graph_apply_confirmation` | `apply_confirmation` | `uploaded_files` |
| `files.custom-parser-route` | `use_uploaded_files_with_custom_parser` | `navigation` | `navigation_only` | `uploaded_files` |
| `mapping.generate-spec` | `generate_mapping_spec` | `workflow_preparation` | `none` | `active_batch` |
| `mapping.validate` | `validate_mapping` | `workflow_preparation` | `none` | `valid_mapping` |
| `mapping.edit` | `edit_mapping` | `navigation` | `navigation_only` | `valid_mapping` |
| `mapping.auto-repair` | `auto_repair_mapping` | `reversible_mapping_edit` | `immediate_reversible_mapping_edit` | `valid_mapping` |
| `mapping.use-deterministic-draft` | `use_deterministic_draft` | `reversible_mapping_edit` | `immediate_reversible_mapping_edit` | `active_batch` |
| `mapping.use-repaired` | `use_repaired_mapping` | `reversible_mapping_edit` | `immediate_reversible_mapping_edit` | `active_batch` |
| `mapping.compare-expected` | `compare_expected_output` | `workflow_preparation` | `none` | `active_batch` |
| `mapping.export-finetune` | `export_mapping_finetune` | `download_or_copy` | `download_or_copy` | `valid_mapping` |
| `mapping.repair-spec` | `repair_mapping_spec` | `workflow_preparation` | `none` | `active_batch` |
| `mapping.generate-deterministic` | `generate_deterministic_mapping` | `workflow_preparation` | `none` | `active_batch` |
| `mapping.generate-parser-from-mapping` | `generate_parser_from_mapping` | `workflow_preparation` | `none` | `valid_mapping` |
| `mapping.show-repair-notes` | `show_repair_notes` | `read_only` | `none` | `active_batch` |
| `mapping.accept` | `accept_mapping` | `reversible_mapping_edit` | `immediate_reversible_mapping_edit` | `valid_mapping` |
| `mapping.reject` | `reject_mapping` | `reversible_mapping_edit` | `immediate_reversible_mapping_edit` | `valid_mapping` |
| `mapping.use-workflow` | `use_mapping_workflow` | `workflow_preparation` | `none` | `active_batch` |
| `runtime.connect-local-model` | `local_model_connect` | `runtime_control` | `runtime_control` | `none` |
| `runtime.disconnect-local-model` | `local_model_disable` | `runtime_control` | `runtime_control` | `none` |
| `runtime.list-models` | `local_model_list` | `runtime_probe` | `none` | `none` |
| `runtime.use-model-name` | `local_model_select` | `read_only` | `none` | `none` |
| `runtime.test-connection` | `local_model_test` | `runtime_probe` | `none` | `none` |
| `runtime.diagnostics` | `local_runtime_diagnostics` | `navigation` | `navigation_only` | `none` |
| `runtime.test-direct-ollama` | `local_runtime_test_direct_ollama` | `runtime_probe` | `none` | `none` |
| `runtime.test-bridge` | `local_runtime_test_bridge` | `runtime_probe` | `none` | `none` |
| `runtime.reconnect-bridge` | `local_model_reconnect_bridge` | `runtime_control` | `runtime_control` | `none` |
| `runtime.enable-local-model` | `local_model_enable` | `runtime_control` | `runtime_control` | `none` |
| `runtime.test-generation` | `local_runtime_test_generation` | `runtime_probe` | `none` | `none` |
| `runtime.generate-parser` | `local_model_generate_parser` | `workflow_preparation` | `none` | `active_batch` |
| `runtime.analyze-file-roles` | `local_model_analyze_roles` | `runtime_probe` | `none` | `active_batch` |
| `runtime.repair-parser` | `local_model_repair_parser` | `workflow_preparation` | `none` | `generated_parser` |
| `navigation.show-mappings` | `show_mappings` | `navigation` | `navigation_only` | `loaded_graph` |
| `navigation.show-exports` | `show_exports` | `navigation` | `navigation_only` | `loaded_graph` |
| `pending.cancel` | `pending_cancel` | `confirmation_control` | `pending_control` | `pending_action` |
| `pending.confirm` | `pending_confirm` | `confirmation_control` | `pending_control` | `compatible_pending_confirmation` |
| `runtime.stop` | `runtime_stop` | `runtime_control` | `runtime_control` | `active_cancellable_work` |

## Speech-act-only concepts

| ID | Intent | Required context | Reason |
| --- | --- | --- | --- |
| `correction.replace-interpretation` | `correction` | `matching_pending_or_recent_interpretation` | Speech-act control concept; not a standalone planner action. |

## Internal-only intents

These are intentionally not advertised as executable catalog commands because they are clarification guards, read-only summaries, local-model strategy helpers, or manual-route placeholders:

- `ambiguous_clear` - Clarification-only guard for short unclear destructive commands.
- `ambiguous_action` - Clarification-only guard for pronoun actions such as run it/apply that.
- `local_runtime_setup_help` - Read-only setup help handled by runtime diagnostics/help UI.
- `local_model_status` - Read-only status summary.
- `local_model_explain_strategy` - Model-backed explanatory task, not a deterministic command.
- `explain_mapping` - Read-only mapping explanation.
- `explain_file_roles` - Read-only file-role explanation.
- `explain_uploaded_files` - Read-only upload detection explanation.
- `compare_datasets` - Read-only batch comparison.
- `compare_formats` - Read-only format comparison.
- `diagnose_error` - Read-only diagnostics response.
- `batch_updates_placeholder` - Panel-only manual feature placeholder.
- `freeform_placeholder` - Manual route placeholder.
- `switch_tab` - Input route switching is documented through dashboard-control and route-specific Help entries.
- `show_graph_preview` - Graph preview navigation is documented through dashboard-control Help entries.
- `show_stats` - Statistics navigation is documented through dashboard-control Help entries.
- `select_export_preview` - Export preview selection is documented through dashboard-control/export Help entries.
- `clear_graph_request` - Graph clearing is documented through the typed graph mutation catalog entry.
- `apply_custom_parser_request` - Parser-result application is documented through the typed parser workflow catalog entry.
- `run_custom_parser_request` - Custom Parser run is documented through the typed parser workflow catalog entry.
- `route_uploaded_files` - Parameterized upload route selection is routed by legacy planner state and route metadata.
- `change_visual_limit` - Visualization limit changes are documented through dashboard-control Help entries.
- `parse_guidance` - Read-only input-format guidance.
- `custom_parser_guidance` - Read-only Custom Parser workflow guidance.
- `visualization_guidance` - Read-only visualization guidance.
- `export_guidance` - Read-only export guidance.
- `explain_concept` - Read-only format/concept explanation.
- `help` - General Help fallback; catalog-specific Help is handled by help_query.
- `ambiguous_edge_list_export` - Clarification-only guard for ambiguous edge-list export requests.
- `external_ai_prompt` - AI Prompt route copy/preparation is documented by dashboard/export Help and never calls an external API.

## Authority rule

The command catalog, deterministic control planner, conversational intent resolver, and coverage tests import the action registry instead of duplicating the public action list. Public entries become Help catalog cards; internal entries remain traceable but are not exposed as executable user commands. Speech-act-only entries can be documented as safety concepts, but `findActionIntentForText(...)` will not match them as public planner actions.
