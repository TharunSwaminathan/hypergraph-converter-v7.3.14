#!/usr/bin/env python3
"""Create a portable source ZIP with normalized POSIX entry names.

This script intentionally uses only the Python standard library. It exists
because Windows archive tooling can create entries containing backslashes,
which extract poorly on Linux/WSL and with Python's zipfile.extractall().
"""

from __future__ import annotations

import argparse
import fnmatch
import stat
import sys
import zipfile
from pathlib import Path


EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "__MACOSX",
    "coverage",
    ".cache",
    ".pytest_cache",
    ".vite",
    "tmp",
    "temp",
    "artifacts",
    "upload",
    "uploads",
    "__pycache__",
}

EXCLUDED_FILES = {
    ".DS_Store",
    "Thumbs.db",
}

EXCLUDED_PATTERNS = [
    "*.log",
    "*.tmp",
    "*.temp",
    "core",
    "core.*",
    "*-independent-review-handoff.txt",
    "stage*-review.txt",
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "id_rsa*",
    "*.gguf",
    "*.safetensors",
    "*.onnx",
    "*.pt",
    "*.pth",
    "*.ckpt",
]

# V7310-D19: explicit, normalized permission policy for every ZIP entry —
# never copy the source filesystem's current mode bits (zipfile.write()'s
# default behavior), since a checkout with a loose umask, an extraction from
# a badly-permissioned archive, or a Windows build machine can silently
# propagate world-writable (0666/0777) entries into a released archive.
# Every file gets exactly one of these two modes; there is no "inherit from
# disk" path anywhere in this script.
REGULAR_FILE_MODE = 0o644
EXECUTABLE_FILE_MODE = 0o755
DIRECTORY_MODE = 0o755

# Only these extensions are ever marked executable — deliberately narrow, so
# adding a new file type to the release requires an explicit decision here
# rather than silently inheriting whatever bit happened to be set on disk.
EXECUTABLE_EXTENSIONS = {".sh", ".bat", ".ps1"}


def entry_mode(path: Path) -> int:
    """Returns the POSIX mode this script assigns to `path` in the archive,
    based solely on a fixed extension allowlist — never on the source
    file's actual on-disk permission bits."""
    return EXECUTABLE_FILE_MODE if path.suffix.lower() in EXECUTABLE_EXTENSIONS else REGULAR_FILE_MODE

REQUIRED_FILES = [
    "package.json",
    "package-lock.json",
    "README.md",
    "MODEL_SETUP.md",
    "local-runtime-bridge.js",
    "check-local-model-runtime.ps1",
    "check-local-model-runtime.sh",
    "configure-ollama-origins.example.bat",
    "configure-ollama-origins.example.ps1",
    "configure-ollama-origins.example.sh",
    "run-local-runtime-bridge.bat",
    "run-local-runtime-bridge.sh",
    "run-with-ollama.bat",
    "run-with-ollama.sh",
    "setup-ollama-model.bat",
    "setup-ollama-model.sh",
    "src/App.jsx",
    "src/agent/canonicalIntentResolver.js",
    "src/agent/conversationIntentResolver.js",
    "src/agent/conversationMemory.js",
    "src/agent/actionIntentRegistry.js",
    "src/agent/actionContextPolicy.js",
    "src/agent/confirmationPolicy.js",
    "src/agent/parameterizedCommandExecutor.js",
    "src/agent/pendingSubmissionRouter.js",
    "src/agent/submissionRequestCoordinator.js",
    "src/agent/deterministicControlPlanner.js",
    "src/agent/customParserContinuation.js",
    "src/agent/customParserConversation.js",
    "src/agent/datasetMappingBootstrap.js",
    "src/agent/datasetMappingIntent.js",
    "src/agent/datasetMappingReferenceResolver.js",
    "src/agent/deterministicDatasetMappingPatch.js",
    "src/agent/graphMutationConversation.js",
    "src/agent/parserProfiles.js",
    "src/agent/localModelClient.js",
    "src/agent/localModelRequestCoordinator.js",
    "src/agent/localModelRuntimeState.js",
    "src/agent/localModelSettings.js",
    "src/agent/localRuntimeDiagnostics.js",
    "src/agent/ollamaMetrics.js",
    "src/agent/ollamaConnectionManager.js",
    "src/agent/ollamaActionPlanValidator.js",
    "src/agent/graphConversationReferences.js",
    "src/agent/deterministicNlu/actionLexicon.js",
    "src/agent/deterministicNlu/ambiguityBuilder.js",
    "src/agent/deterministicNlu/clauseParser.js",
    "src/agent/deterministicNlu/confidenceScorer.js",
    "src/agent/deterministicNlu/compileDeterministicAction.js",
    "src/agent/deterministicNlu/canonicalOperation.js",
    "src/agent/deterministicNlu/commandCatalog.js",
    "src/agent/deterministicNlu/commandCatalogFormatter.js",
    "src/agent/deterministicNlu/commandCatalogSchema.js",
    "src/agent/deterministicNlu/commandCatalogSearch.js",
    "src/agent/deterministicNlu/contextBinding.js",
    "src/agent/deterministicNlu/correctionResolver.js",
    "src/agent/deterministicNlu/deterministicNlu.js",
    "src/agent/deterministicNlu/discourseReferences.js",
    "src/agent/deterministicNlu/dispatchCompiledAction.js",
    "src/agent/deterministicNlu/domainLexicon.js",
    "src/agent/deterministicNlu/entityExtractor.js",
    "src/agent/deterministicNlu/helpSeekingGuards.js",
    "src/agent/deterministicNlu/intentClassifier.js",
    "src/agent/deterministicNlu/interpretationTrace.js",
    "src/agent/deterministicNlu/negationResolver.js",
    "src/agent/deterministicNlu/nluTypes.js",
    "src/agent/deterministicNlu/normalizeInput.js",
    "src/agent/deterministicNlu/prepareDeterministicTurn.js",
    "src/agent/deterministicNlu/protectedText.js",
    "src/agent/deterministicNlu/requestSemantics.js",
    "src/agent/deterministicNlu/responseComposer.js",
    "src/agent/deterministicNlu/runtimeInstrumentation.js",
    "src/agent/deterministicNlu/semanticConfidence.js",
    "src/agent/deterministicNlu/sideEffectPolicy.js",
    "src/agent/deterministicNlu/speechActClassifier.js",
    "src/agent/deterministicNlu/tokenizeInput.js",
    "src/agent/deterministicNlu/domains/dashboardActionGrammar.js",
    "src/agent/deterministicNlu/domains/datasetGroupingGrammar.js",
    "src/agent/deterministicNlu/domains/datasetMappingGrammar.js",
    "src/agent/deterministicNlu/domains/graphMutationGrammar.js",
    "src/agent/deterministicNlu/domains/groundedQuestionGrammar.js",
    "src/agent/deterministicNlu/domains/helpGrammar.js",
    "src/agent/deterministicNlu/domains/legacyActionGrammar.js",
    "src/agent/deterministicNlu/domains/parserWorkflowGrammar.js",
    "src/agent/deterministicNlu/runtime/createProductionDeterministicHandlers.js",
    "src/agent/deterministicNlu/runtime/executeCompiledDashboardControl.js",
    "src/agent/deterministicNlu/runtime/executeCompiledGraphMutation.js",
    "src/agent/deterministicNlu/runtime/executeCompiledGroundedQuestion.js",
    "src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js",
    "src/agent/deterministicNlu/runtime/executeCompiledMapping.js",
    "src/agent/deterministicNlu/runtime/executeCompiledParserWorkflow.js",
    "src/components/AgentChatPanel.jsx",
    "src/components/AgentChatPanel.css",
    "src/components/DeterministicCommandHelp.jsx",
    "src/components/DeterministicCommandHelp.css",
    "src/components/agent/AgentComposer.jsx",
    "src/components/agent/AgentMessage.jsx",
    "src/components/LocalRuntimeDiagnosticsPanel.jsx",
    "src/graph/graphFingerprint.js",
    "src/graph/graphHistory.js",
    "src/graph/graphIdentity.js",
    "src/graph/graphMutationEngine.js",
    "src/graph/graphMutationPreview.js",
    "src/graph/graphMutationSchema.js",
    "src/graph/graphMutationValidator.js",
    "tests/agent-local-model.test.mjs",
    "tests/intent-heldout.test.mjs",
    "tests/graph-mutation.test.mjs",
    "tests/conversational-graph-mutation.test.mjs",
    "tests/custom-parser-conversation.test.mjs",
    "tests/parser-sandbox.test.mjs",
    "tests/regression-v7-2.test.mjs",
    "tests/graph-mutation-model-planner.test.mjs",
    "tests/graph-mutation-conversation-heldout.test.mjs",
    "tests/graph-mutation-pending-correction.test.mjs",
    "tests/graph-mutation-noop.test.mjs",
    "tests/regression-v7-2-1.test.mjs",
    "tests/local-model-request-coordinator.test.mjs",
    "tests/local-model-cancellation.test.mjs",
    "tests/local-model-runtime-state.test.mjs",
    "tests/graph-mutation-planner-budget.test.mjs",
    "tests/ollama-metrics.test.mjs",
    "tests/graph-conversation-references.test.mjs",
    "tests/regression-v7-2-2.test.mjs",
    "tests/dataset-mapping-intent.test.mjs",
    "tests/deterministic-dataset-mapping-patch.test.mjs",
    "tests/dataset-mapping-bootstrap.test.mjs",
    "tests/dataset-mapping-runtime-state.test.mjs",
    "tests/dataset-mapping-chat-routing.test.mjs",
    "tests/portable-zip-paths.test.mjs",
    "tests/regression-v7-3-1.test.mjs",
    "tests/deterministic-nlu-normalization.test.mjs",
    "tests/deterministic-nlu-tokenizer.test.mjs",
    "tests/deterministic-nlu-clauses.test.mjs",
    "tests/deterministic-nlu-intent.test.mjs",
    "tests/deterministic-nlu-negation.test.mjs",
    "tests/deterministic-nlu-corrections.test.mjs",
    "tests/deterministic-nlu-references.test.mjs",
    "tests/deterministic-nlu-confidence.test.mjs",
    "tests/deterministic-nlu-response-composer.test.mjs",
    "tests/deterministic-nlu-dataset-mapping.test.mjs",
    "tests/deterministic-nlu-dataset-grouping.test.mjs",
    "tests/deterministic-nlu-parser-workflow.test.mjs",
    "tests/deterministic-nlu-graph-mutation.test.mjs",
    "tests/deterministic-nlu-dashboard.test.mjs",
    "tests/deterministic-nlu-compound.test.mjs",
    "tests/deterministic-nlu-adversarial.test.mjs",
    "tests/deterministic-nlu-heldout-corpus.test.mjs",
    "tests/deterministic-nlu-corpus-integrity.test.mjs",
    "tests/deterministic-nlu-semantic-evaluation.test.mjs",
    "tests/deterministic-nlu-quality-metrics.test.mjs",
    "tests/deterministic-nlu-authoritative-routing.test.mjs",
    "tests/deterministic-nlu-false-mutation.test.mjs",
    "tests/deterministic-nlu-template-diversity.test.mjs",
    "tests/deterministic-nlu-legacy-adapters.test.mjs",
    "tests/regression-v7-3-2.test.mjs",
    "tests/regression-v7-3-3.test.mjs",
    "tests/deterministic-nlu-runtime-coordinator.test.mjs",
    "tests/deterministic-nlu-runtime-dispatch.test.mjs",
    "tests/deterministic-nlu-single-compilation.test.mjs",
    "tests/deterministic-nlu-graph-deterministic-first.test.mjs",
    "tests/deterministic-nlu-dashboard-canonical-dispatch.test.mjs",
    "tests/deterministic-nlu-mapping-precompiled-patch.test.mjs",
    "tests/deterministic-nlu-integrated-call-metrics.test.mjs",
    "tests/deterministic-nlu-stale-binding.test.mjs",
    "tests/deterministic-nlu-canonical-operation-match.test.mjs",
    "tests/deterministic-nlu-metric-denominators.test.mjs",
    "tests/deterministic-nlu-corpus-completion.test.mjs",
    "tests/regression-v7-3-4.test.mjs",
    "tests/deterministic-nlu-graph-option-forwarding.test.mjs",
    "tests/deterministic-nlu-speech-act-safety.test.mjs",
    "tests/deterministic-nlu-question-safety.test.mjs",
    "tests/deterministic-nlu-completed-trace.test.mjs",
    "tests/deterministic-nlu-corpus-authenticity.test.mjs",
    "tests/deterministic-nlu-integrated-cross-domain.test.mjs",
    "tests/deterministic-nlu-production-handler-spies.test.mjs",
    "tests/regression-v7-3-5.test.mjs",
    "tests/deterministic-command-catalog-integrity.test.mjs",
    "tests/deterministic-command-catalog-coverage.test.mjs",
    "tests/deterministic-command-catalog-examples.test.mjs",
    "tests/deterministic-command-catalog-routing.test.mjs",
    "tests/deterministic-help-query.test.mjs",
    "tests/deterministic-help-search.test.mjs",
    "tests/deterministic-help-try-command.test.mjs",
    "tests/deterministic-help-safety-boundary.test.mjs",
    "tests/deterministic-help-politeness-distinction.test.mjs",
    "tests/deterministic-action-intent-registry.test.mjs",
    "tests/deterministic-command-catalog-legacy-actions.test.mjs",
    "tests/deterministic-command-catalog-authoritative-coverage.test.mjs",
    "tests/deterministic-command-catalog-control-entries.test.mjs",
    "tests/deterministic-help-algorithm-filter.test.mjs",
    "tests/deterministic-help-quoted-diagnostics.test.mjs",
    "tests/deterministic-help-deep-link.test.mjs",
    "tests/deterministic-help-search-legacy-actions.test.mjs",
    "tests/deterministic-command-reference-doc.test.mjs",
    "tests/regression-v7-3-7.test.mjs",
    "tests/regression-v7-3-8.test.mjs",
    "tests/deterministic-help-generalized-speech.test.mjs",
    "tests/deterministic-help-pending-state-protection.test.mjs",
    "tests/deterministic-help-runtime-stop-protection.test.mjs",
    "tests/deterministic-help-state-preservation-matrix.test.mjs",
    "tests/deterministic-help-action-contrast-matrix.test.mjs",
    "tests/deterministic-help-phrase-families.test.mjs",
    "tests/deterministic-action-registry-exact-match.test.mjs",
    "tests/deterministic-action-registry-edit-mapping.test.mjs",
    "tests/deterministic-command-catalog-parameterized-actions.test.mjs",
    "tests/deterministic-command-control-contexts.test.mjs",
    "tests/deterministic-help-v2v-search.test.mjs",
    "tests/deterministic-help-keyboard-accessibility.test.mjs",
    "tests/regression-v7-3-9.test.mjs",
    "tests/action-registry-runtime-authority-v7-3-10.test.mjs",
    "tests/agent-chat-pending-router-integration-v7-3-10.test.mjs",
    "tests/confirmation-policy-authority-v7-3-10.test.mjs",
    "tests/confirmation-selection-staleness-v7-3-10.test.mjs",
    "tests/correction-safety-v7-3-10.test.mjs",
    "tests/deterministic-compositional-help-safety-v7-3-10.test.mjs",
    "tests/deterministic-explicit-no-action-safety-v7-3-10.test.mjs",
    "tests/deterministic-pending-submission-router-v7-3-10.test.mjs",
    "tests/deterministic-runtime-outcome-trace-v7-3-10.test.mjs",
    "tests/parameterized-command-execution-v7-3-10.test.mjs",
    "tests/submission-request-coordinator-v7-3-10.test.mjs",
    "tests/helpers/evaluateDeterministicNluCorpus.mjs",
    "tests/helpers/evaluateIntegratedRouting.mjs",
    "tests/helpers/deterministicCommandCatalogTestHelpers.mjs",
    "tests/helpers/nluCorpusIntegrity.mjs",
    "tests/fixtures/deterministic-nlu/core-regressions.mjs",
    "tests/fixtures/deterministic-nlu/semantic-corpus.mjs",
    "tests/fixtures/deterministic-nlu/CORPUS_MANIFEST.md",
    "tests/fixtures/deterministic-nlu/dataset-mapping-actions.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/dataset-mapping-questions.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/dataset-grouping-actions.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/dataset-grouping-questions.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/graph-mutation-actions.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/graph-mutation-questions.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/parser-workflow.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/dashboard-control.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/corrections.heldout.jsonl",
    "tests/fixtures/deterministic-nlu/negative-ambiguous-adversarial.heldout.jsonl",
    "tests/fixtures/contexts/three-table-authorship.json",
    "tests/fixtures/contexts/ambiguous-paper-files.json",
    "tests/fixtures/contexts/adversarial-identifiers.json",
    "tests/fixtures/contexts/grouped-monthly-datasets.json",
    "tests/fixtures/contexts/catalog-monthly-datasets.json",
    "tests/fixtures/contexts/parser-plan-ready.json",
    "tests/fixtures/contexts/parser-generated.json",
    "tests/fixtures/contexts/graph-basic.json",
    "tests/fixtures/contexts/graph-named.json",
    "tests/fixtures/contexts/graph-researchers.json",
    "tests/fixtures/contexts/graph-researchers-with-alice.json",
    "tests/fixtures/contexts/graph-selected-hyperedge.json",
    "tests/fixtures/contexts/graph-stale-reference.json",
    "tests/fixtures/contexts/dashboard-workspace.json",
    "tests/fixtures/contexts/graph-with-history.json",
    "tests/fixtures/contexts/grouping-extended.json",
    "tests/fixtures/contexts/parser-result-ready.json",
    "tests/fixtures/v7.3.14/evidence/v7.3.14-stage8-corrective-truncation-prechange.json",
    "tests/fixtures/v7.3.14/evidence/v7.3.14-stage8-corrective2-prechange.json",
    "tests/fixtures/v7.3.14/evidence/v7.3.14-stage8-corrective2-preservation.json",
    "tests/fixtures/v7.3.14/evidence/v7.3.14-stage8-corrective3-prechange.json",
    "tests/fixtures/v7.3.14/evidence/v7.3.14-stage8-corrective3-preservation.json",
    "docs/V7_2_BASELINE_AUDIT.md",
    "docs/GRAPH_MUTATION_ARCHITECTURE.md",
    "docs/GRAPH_MUTATION_SCHEMA.md",
    "docs/CONVERSATIONAL_MUTATION_PLANNER.md",
    "docs/LOCAL_MODEL_RUNTIME_RELIABILITY.md",
    "docs/V7_2_1_TEST_REPORT.md",
    "docs/V7_2_2_REMEDIATION.md",
    "docs/V7_2_2_TEST_REPORT.md",
    "docs/CUSTOM_PARSER_CONVERSATION.md",
    "docs/PARSER_PROFILE_SCHEMA.md",
    "docs/V7_2_MIGRATION.md",
    "docs/V7_2_TEST_REPORT.md",
    "docs/V7_2_KNOWN_LIMITATIONS.md",
    "docs/V7_3_1_REMEDIATION.md",
    "docs/DATASET_MAPPING_CHAT_ROUTING.md",
    "docs/V7_3_1_TEST_REPORT.md",
    "docs/V7_3_2_IMPLEMENTATION.md",
    "docs/DETERMINISTIC_CONVERSATIONAL_NLU.md",
    "docs/DETERMINISTIC_NLU_LEXICON.md",
    "docs/DETERMINISTIC_NLU_REFERENCE_RESOLUTION.md",
    "docs/DETERMINISTIC_NLU_RESPONSE_COMPOSER.md",
    "docs/V7_3_2_TEST_REPORT.md",
    "docs/V7_3_3_IMPLEMENTATION.md",
    "docs/V7_3_3_TEST_REPORT.md",
    "docs/DETERMINISTIC_NLU_AUTHORITATIVE_COMPILERS.md",
    "docs/DETERMINISTIC_NLU_CORPUS_GUIDE.md",
    "docs/DETERMINISTIC_NLU_QUALITY_METRICS.md",
    "docs/LEGACY_PARSER_MIGRATION.md",
    "docs/V7_3_4_IMPLEMENTATION.md",
    "docs/V7_3_4_TEST_REPORT.md",
    "docs/DETERMINISTIC_NLU_RUNTIME_DISPATCH.md",
    "docs/DETERMINISTIC_NLU_INTEGRATED_METRICS.md",
    "docs/DETERMINISTIC_NLU_CORPUS_COMPLETION.md",
    "docs/CANONICAL_DASHBOARD_DISPATCH.md",
    "docs/DETERMINISTIC_FIRST_GRAPH_ROUTING.md",
    "docs/V7_3_5_IMPLEMENTATION.md",
    "docs/V7_3_5_TEST_REPORT.md",
    "docs/DETERMINISTIC_NLU_SPEECH_ACTS.md",
    "docs/DETERMINISTIC_NLU_SIDE_EFFECT_POLICY.md",
    "docs/DETERMINISTIC_NLU_CORPUS_AUTHENTICITY.md",
    "docs/DETERMINISTIC_NLU_PRODUCTION_HANDLER_TESTING.md",
    "docs/DETERMINISTIC_RUNTIME_TRACE_LIFECYCLE.md",
    "docs/DETERMINISTIC_COMMAND_REFERENCE.md",
    "docs/DETERMINISTIC_HELP_ARCHITECTURE.md",
    "docs/DETERMINISTIC_ACTION_INTENT_INVENTORY.md",
    "docs/DETERMINISTIC_HELP_SAFETY_BOUNDARY.md",
    "docs/COMMAND_CATALOG_MIGRATION_V7_3_8.md",
    "docs/V7_3_7_IMPLEMENTATION.md",
    "docs/V7_3_7_TEST_REPORT.md",
    "docs/V7_3_8_IMPLEMENTATION.md",
    "docs/V7_3_8_TEST_REPORT.md",
    "docs/V7_3_9_IMPLEMENTATION.md",
    "docs/V7_3_9_TEST_REPORT.md",
    "docs/GENERALIZED_HELP_SPEECH_CLASSIFICATION.md",
    "docs/PENDING_STATE_HELP_SAFETY.md",
    "docs/ACTION_REGISTRY_AUTHORITY.md",
    "docs/COMMAND_CATALOG_PARAMETERIZED_ACTIONS.md",
    "docs/COMPOSITIONAL_HELP_INTENT_SAFETY.md",
    "docs/RELEASE_v7.3.10.md",
    "docs/V7_3_10_TEST_REPORT.md",
    "scripts/deterministicSafetyMatrix.mjs",
    "scripts/generate-deterministic-command-reference.mjs",
    "scripts/verify-portable-archive.py",
    "scripts/verify-compositional-help-safety.mjs",
    "scripts/verify-explicit-no-action-safety.mjs",
    "smoke-test-qwen3-8b.sh",
    "smoke-test-qwen3-8b.ps1",
    "scripts/smoke-test-graph-mutation-planner.mjs",
]


def project_root_from_script() -> Path:
    return Path(__file__).resolve().parents[1]


def is_excluded(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    parts = set(rel.parts)
    if parts & EXCLUDED_DIRS:
        return True
    if path.name in EXCLUDED_FILES:
        return True
    lowered_name = path.name.lower()
    return any(fnmatch.fnmatch(lowered_name, pattern.lower()) for pattern in EXCLUDED_PATTERNS)


def source_sort_key(path: Path, root: Path) -> str:
    """Return the host-independent archive ordering key for a source path.

    Concrete ``Path`` comparison follows the host path flavor (notably,
    Windows comparisons case-fold path components).  Sorting the normalized
    relative POSIX spelling instead gives every host the same ordinal Unicode
    string order and does not depend on filesystem enumeration order.
    """
    return path.relative_to(root).as_posix()


def iter_source_files(root: Path) -> list[Path]:
    return [
        path
        for path in sorted(root.rglob("*"), key=lambda path: source_sort_key(path, root))
        if path.is_file() and not is_excluded(path, root)
    ]


def create_zip(root: Path, output: Path) -> dict[str, int]:
    files = iter_source_files(root)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    # A fixed timestamp (rather than each file's on-disk mtime) makes
    # repeated packaging from identical sources byte-for-byte reproducible,
    # and sidesteps zipfile's requirement that DOS timestamps be >= 1980.
    fixed_date_time = (2024, 1, 1, 0, 0, 0)

    directory_names = {f"{root.name}/"}
    for path in files:
        parts = (Path(root.name) / path.relative_to(root)).parts[:-1]
        for index in range(1, len(parts) + 1):
            directory_names.add("/".join(parts[:index]) + "/")

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for arcname in sorted(directory_names):
            info = zipfile.ZipInfo(arcname, date_time=fixed_date_time)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = ((stat.S_IFDIR | DIRECTORY_MODE) << 16) | 0x10
            info.create_system = 3
            zf.writestr(info, b"")

        for path in files:
            rel = path.relative_to(root)
            arcname = (Path(root.name) / rel).as_posix()
            if "\\" in arcname:
                raise RuntimeError(f"Non-portable archive path generated: {arcname}")
            if path.is_symlink():
                raise RuntimeError(f"Symlinks are not permitted in the portable package: {arcname}")

            info = zipfile.ZipInfo(arcname, date_time=fixed_date_time)
            info.compress_type = zipfile.ZIP_DEFLATED
            # external_attr packs (unix mode << 16) | (MS-DOS attribute byte).
            # This is the only place a mode bit is ever written for an entry —
            # explicitly chosen per entry_mode(), never read from path.stat().
            info.external_attr = (stat.S_IFREG | entry_mode(path)) << 16
            info.create_system = 3  # unix, so external_attr's mode bits are honored on extraction
            data = path.read_bytes()
            zf.writestr(info, data)

    with zipfile.ZipFile(output, "r") as zf:
        names = zf.namelist()
        backslash_entries = [name for name in names if "\\" in name]
        if backslash_entries:
            raise RuntimeError(f"Backslash entries found: {backslash_entries[:5]}")
        required = {(Path(root.name) / item).as_posix() for item in REQUIRED_FILES}
        missing = sorted(required - set(names))
        if missing:
            raise RuntimeError(f"Required files missing from ZIP: {missing}")
        roots = {Path(name).parts[0] for name in names if name}
        if roots != {root.name}:
            raise RuntimeError(f"Expected one project root {root.name!r}, found {sorted(roots)}")
        # Case-insensitive path collisions extract unpredictably on
        # case-insensitive filesystems (macOS default, Windows) even though
        # the archive itself is a valid ZIP — reject them outright.
        seen_lower: dict[str, str] = {}
        collisions = []
        for name in names:
            key = name.lower()
            if key in seen_lower and seen_lower[key] != name:
                collisions.append((seen_lower[key], name))
            else:
                seen_lower[key] = name
        if collisions:
            raise RuntimeError(f"Case-insensitive path collisions found: {collisions[:5]}")
        # Verify every entry's permission bits landed exactly on the policy
        # above — in particular, that nothing is world-writable.
        bad_permissions = []
        for zinfo in zf.infolist():
            mode = (zinfo.external_attr >> 16) & 0o7777
            if mode & 0o022:  # group- or other-writable is never intended
                bad_permissions.append((zinfo.filename, oct(mode)))
        if bad_permissions:
            raise RuntimeError(f"World/group-writable ZIP entries found: {bad_permissions[:5]}")
        counts = {
            "entries": len(names),
            "backslash_entries": len(backslash_entries),
            "project_roots": len(roots),
            "node_modules_entries": sum("/node_modules/" in name for name in names),
            "dist_entries": sum("/dist/" in name for name in names),
            "git_entries": sum("/.git/" in name for name in names),
            "artifacts_entries": sum("/artifacts/" in name for name in names),
            "coverage_entries": sum("/coverage/" in name for name in names),
            "macos_entries": sum("__MACOSX" in name for name in names),
            "ds_store_entries": sum(name.endswith("/.DS_Store") or name.endswith(".DS_Store") for name in names),
            "temporary_cache_entries": sum(
                any(token in name for token in ["/.cache/", "/coverage/", "/tmp/", "/temp/"])
                or name.endswith((".tmp", ".temp"))
                for name in names
            ),
            "directory_entries": sum(zi.is_dir() for zi in zf.infolist()),
            "executable_entries": sum(
                not zi.is_dir() and ((zi.external_attr >> 16) & 0o7777) == EXECUTABLE_FILE_MODE
                for zi in zf.infolist()
            ),
        }
    return counts


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Package Hypergraph Converter Studio source as a portable ZIP.")
    parser.add_argument("--root", type=Path, default=project_root_from_script(), help="Project root to package.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output ZIP path. Defaults to ../<project-root>-portable.zip",
    )
    args = parser.parse_args(argv)

    root = args.root.resolve()
    output = (args.output or root.parent / f"{root.name}-portable.zip").resolve()
    counts = create_zip(root, output)
    print(f"Created: {output}")
    for key, value in counts.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
